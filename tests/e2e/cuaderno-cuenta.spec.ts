/**
 * Cuenta (HU-E4.2) en un teléfono de 360 px. El CORE y Google se reemplazan interceptando la red:
 * esta prueba no ve Google de verdad (P17). La entrada real se prueba en staging (P16).
 * Fuera de producción el cuaderno usa el CORE de staging (`celdas.json`).
 */
import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { FINCA_ENSAYO_UNO } from '../fixtures/fincas.ts';
import { APP, configurar } from './ayudas.ts';

// Las direcciones reales de staging: la CSP del cuaderno solo deja conectarse a ellas (HU-E0.5).
const { core, celdas } = JSON.parse(readFileSync('infrastructure/celdas.json', 'utf8')) as {
  core: { url_staging: string };
  celdas: { api_staging: string }[];
};
const CORE = core.url_staging;
const API_STAGING = celdas[0]?.api_staging ?? '';

const sesion = {
  acceso: 'acceso-e2e',
  acceso_vence: Date.now() + 12 * 60 * 60 * 1000,
  refresh: 'refresh-e2e',
  refresh_vence: Date.now() + 60 * 24 * 60 * 60 * 1000,
  usuario: { nombre: 'Persona Ensayo', email: 'ensayo@example.com' },
  organizaciones: [],
  org_id: null,
  aviso: null,
};

/** CORE falso: el inicio «vuelve de Google» con un código; el canje entrega la sesión. */
async function coreFalso(page: Page, conSesion: object = sesion) {
  const canjes: { url: string; cuerpo: unknown }[] = [];
  await page.route(`${CORE}/api/core/auth/google/inicio?*`, async (ruta) => {
    const vuelta = new URL(ruta.request().url()).searchParams.get('vuelta');
    await ruta.fulfill({ status: 302, headers: { location: `${vuelta}#entrar=codigo-e2e` } });
  });
  await page.route(`${CORE}/api/core/auth/canje`, async (ruta) => {
    canjes.push({ url: ruta.request().url(), cuerpo: ruta.request().postDataJSON() });
    await ruta.fulfill({
      json: conSesion,
      headers: { 'access-control-allow-origin': new URL(page.url()).origin },
    });
  });
  // Cuenta lista los teléfonos y el equipo (HU-E4.6): por defecto, vacíos. Ninguna prueba sale
  // al CORE de staging de verdad; las que los prueban registran sus propias respuestas después.
  for (const [ruta, json] of [
    ['telefonos/ver', { telefonos: [] }],
    ['equipo/ver', { miembros: [] }],
  ] as const) {
    await page.route(`${CORE}/api/core/${ruta}`, (r) =>
      r.fulfill({ json, headers: { 'access-control-allow-origin': '*' } }),
    );
  }
  return canjes;
}

const cuenta = (page: Page) => page.goto(`${APP}cuenta/`);

/** Acepta la política (HU-E0.5) y toca «Entrar con Google». */
async function entrar(page: Page) {
  await page.getByLabel(/Leí y acepto la política de tratamiento de datos/).check();
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
}

test('sin cuenta: el cuaderno no la exige y ofrece entrar con Google', async ({ page }) => {
  await cuenta(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Cuenta' })).toBeVisible();
  await expect(page.getByText('El cuaderno funciona sin cuenta.')).toBeVisible();
  // HU-E0.5, CA3: sin aceptar la política no se puede entrar; aceptada, sí.
  const boton = page.getByRole('button', { name: 'Entrar con Google' });
  await expect(boton).toBeDisabled();
  await expect(
    page.getByRole('link', { name: 'política de tratamiento de datos' }),
  ).toHaveAttribute('href', '/agro/privacidad/');
  await page.getByLabel(/Leí y acepto la política de tratamiento de datos/).check();
  await expect(boton).toBeEnabled();
});

test('HU-E0.5 CA3: al entrar se manda la versión de la política aceptada', async ({ page }) => {
  let pedido = '';
  await page.route(`${CORE}/api/core/auth/google/inicio?*`, async (ruta) => {
    pedido = ruta.request().url();
    await ruta.fulfill({ status: 400, body: 'fin de la prueba' });
  });
  await cuenta(page);
  await entrar(page);
  await expect
    .poll(() => new URL(pedido || 'http://x').searchParams.get('politica'))
    .toBe(JSON.parse(readFileSync('content/agro/privacidad/politica.json', 'utf8')).version);
});

test('CA1 y CA4: entrar, canjear por POST, y ningún código ni token en la URL ni en localStorage', async ({
  page,
}) => {
  const canjes = await coreFalso(page);
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await cuenta(page);
  await entrar(page);
  await expect(page.locator('[data-prueba="cuenta-usuario"]')).toContainText('Persona Ensayo');
  await expect(page.locator('[data-prueba="cuenta-estado"]')).toHaveText('Sesión activa.');
  await expect(page.locator('[data-prueba="finca-en-la-nube"]')).toContainText(
    'Configura tu finca en «Áreas» para poder subirla.',
  );

  expect(canjes).toHaveLength(1);
  expect(canjes[0]?.cuerpo).toMatchObject({
    codigo: 'codigo-e2e',
    dispositivo: expect.any(String),
  });
  expect(new URL(page.url()).hash).toBe(''); // el código salió de la barra de direcciones
  for (const url of urls) {
    expect(url).not.toContain('codigo-e2e');
    expect(url).not.toContain('acceso-e2e');
    expect(url).not.toContain('refresh-e2e');
  }
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe('{}');
});

test('volver de Google con un error lo dice en palabras', async ({ page }) => {
  await page.goto(`${APP}cuenta/#entrar-error=cancelada`);
  await expect(page.locator('[data-prueba="cuenta-mensaje"]')).toHaveText(
    'Cancelaste la entrada con Google. Puedes intentarlo cuando quieras.',
  );
  expect(new URL(page.url()).hash).toBe('');
});

test('sin señal no se puede entrar, y se dice que se puede seguir registrando', async ({
  page,
  context,
}) => {
  await cuenta(page);
  await page.getByLabel(/Leí y acepto la política de tratamiento de datos/).check();
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeEnabled();
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeDisabled();
  await expect(
    page.getByText('Necesitas señal para entrar. Puedes seguir registrando.'),
  ).toBeVisible();
});

test('salir de la cuenta borra la sesión del teléfono y vuelve a ofrecer entrar', async ({
  page,
}) => {
  await coreFalso(page);
  await cuenta(page);
  await entrar(page);
  await expect(page.locator('[data-prueba="cuenta-estado"]')).toBeVisible();
  await page.getByRole('button', { name: 'Salir de la cuenta' }).click();
  await expect(page.locator('[data-prueba="cuenta-mensaje"]')).toHaveText(
    'Saliste de la cuenta. Tus registros siguen en este teléfono.',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();
});

/** La celda y el resto del CORE falsos: crear la organización, renovar hacia ella y el push. */
async function nubeFalsa(
  page: Page,
  respuesta: (op: { id: string; entidad: string }) => object,
  extra: object = {},
) {
  const API = API_STAGING;
  const permitir = { 'access-control-allow-origin': '*' };
  let org = '';
  await page.route(`${CORE}/api/core/organizaciones`, async (ruta) => {
    org = (ruta.request().postDataJSON() as { id: string }).id;
    await ruta.fulfill({
      status: 201,
      json: { org_id: org, nombre: 'Finca Ensayo Uno', ya_existia: false },
      headers: permitir,
    });
  });
  await page.route(`${CORE}/api/core/auth/refrescar`, async (ruta) => {
    await ruta.fulfill({
      json: {
        ...sesion,
        refresh: null,
        org_id: org,
        url_api: API,
        organizaciones: [{ org_id: org, nombre: 'Finca Ensayo Uno', rol: 'propietario' }],
      },
      headers: permitir,
    });
  });
  await page.route(`${API}/api/v1/sync/pull?*`, async (ruta) => {
    await ruta.fulfill({
      json: { catalogos: [], registros: [], cursor: { registro: 0, catalogo: 0 }, mas: false },
      headers: permitir,
    });
  });
  const lotes: number[] = [];
  await page.route(`${API}/api/v1/sync/push`, async (ruta) => {
    const { ops } = ruta.request().postDataJSON() as { ops: { id: string; entidad: string }[] };
    lotes.push(ops.length);
    await ruta.fulfill({ json: { acks: ops.map(respuesta), ...extra }, headers: permitir });
  });
  return lotes;
}

async function fincaConUnClima(page: Page) {
  await configurar(page, FINCA_ENSAYO_UNO);
  await page
    .getByRole('navigation', { name: 'Secciones del cuaderno' })
    .getByRole('link', { name: 'Registrar' })
    .click();
  await page
    .getByLabel('Área', { exact: true })
    .selectOption({ label: FINCA_ENSAYO_UNO.areas[0]?.nombre ?? '' });
  await page.getByLabel('Temperatura del aire (°C)').fill('24');
  await page.getByLabel('Humedad relativa (%)').fill('70');
  await page.getByRole('button', { name: 'Guardar clima' }).click();
  await expect(page.locator('[data-prueba="indicador-datos"]')).toHaveText(
    '1 registro solo en este teléfono',
  );
}

test('HU-E4.3 y E5.2: subir la finca deja todo en la nube y el indicador sin pendientes', async ({
  page,
}) => {
  await fincaConUnClima(page);
  await coreFalso(page);
  const lotes = await nubeFalsa(page, (op) => ({ id: op.id, estado: 'aceptado' }));
  await cuenta(page);
  await entrar(page);
  await expect(page.locator('[data-prueba="nube-sin-subir"]')).toContainText(
    '«Finca Ensayo Uno» está solo en este teléfono.',
  );
  await page.getByRole('button', { name: 'Subir mi finca a la nube' }).click();
  await expect(page.locator('[data-prueba="nube-vinculada"]')).toBeVisible();
  await expect(page.locator('[data-prueba="nube-sync"]')).toContainText(
    'Todo lo tuyo está en la nube.',
  );
  await expect(page.locator('[data-prueba="nube-pendientes"]')).toHaveText(
    'Nada pendiente por subir.',
  );
  await expect(page.locator('[data-prueba="indicador-datos"]')).toHaveText(
    'Sin registros pendientes',
  );
  expect(lotes.every((n) => n <= 25)).toBe(true);
});

test('HU-E3.14 CA3: lo que la nube no acepta se ve en rojo con su motivo, y sigue en el teléfono', async ({
  page,
}) => {
  await fincaConUnClima(page);
  await coreFalso(page);
  await nubeFalsa(page, (op) =>
    op.entidad === 'registro'
      ? {
          id: op.id,
          estado: 'cuarentena',
          motivo: 'Registro inválido: «datos.humedadRelativaPct» fuera de rango',
        }
      : { id: op.id, estado: 'aceptado' },
  );
  await cuenta(page);
  await entrar(page);
  await page.getByRole('button', { name: 'Subir mi finca a la nube' }).click();
  await expect(page.locator('[data-prueba="nube-rechazos"]')).toContainText(
    '«datos.humedadRelativaPct» fuera de rango',
  );
  await page.locator('[data-prueba="indicador-datos"]').click();
  await expect(page.locator('[data-prueba="datos-rechazados"]')).toHaveText(
    '1 dato no fue aceptado por la nube. Siguen en este teléfono; en «Cuenta» ves por qué.',
  );
  await page
    .getByRole('navigation', { name: 'Secciones del cuaderno' })
    .getByRole('link', { name: 'Historial' })
    .click();
  await expect(page.getByText('24').first()).toBeVisible(); // el registro sigue ahí
});

test('HU-E5.3 CA4: un teléfono nuevo baja la finca de su cuenta y la ve en Áreas', async ({
  page,
}) => {
  const API = API_STAGING;
  const permitir = { 'access-control-allow-origin': '*' };
  const ORG = '0199a1b2-0000-7000-8000-0000000000aa';
  const FINCA = '0199a1b2-0000-7000-8000-0000000000bb';
  const AREA = '0199a1b2-0000-7000-8000-0000000000cc';
  const conFinca = {
    ...sesion,
    organizaciones: [{ org_id: ORG, nombre: 'Finca Ensayo Dos', rol: 'propietario' }],
  };
  await coreFalso(page, conFinca);
  await page.route(`${CORE}/api/core/auth/refrescar`, async (ruta) => {
    await ruta.fulfill({
      json: { ...conFinca, refresh: null, org_id: ORG, url_api: API },
      headers: permitir,
    });
  });
  const actualizado = '2026-10-01T12:00:00.000Z';
  await page.route(`${API}/api/v1/sync/pull?*`, async (ruta) => {
    await ruta.fulfill({
      headers: permitir,
      json: {
        catalogos: [
          {
            entidad: 'finca',
            datos: {
              id: FINCA,
              org_id: ORG,
              version: 1,
              actualizado,
              nombre: 'Finca Ensayo Dos',
              municipio: 'Municipio Ensayo',
              regimen: 'convencional',
            },
          },
          {
            entidad: 'area',
            datos: {
              id: AREA,
              org_id: ORG,
              version: 1,
              actualizado,
              finca_id: FINCA,
              padre_id: null,
              tipo: 'bloque',
              nombre: 'Bloque 1',
              area_m2: 800,
              capacidad_plantas: null,
              activa: true,
            },
          },
        ],
        registros: [],
        cursor: { registro: 0, catalogo: 2 },
        mas: false,
      },
    });
  });
  await cuenta(page);
  await entrar(page);
  await expect(page.locator('[data-prueba="nube-para-bajar"]')).toBeVisible();
  await page.getByRole('button', { name: 'Bajar «Finca Ensayo Dos» a este teléfono' }).click();
  await expect(page.locator('[data-prueba="nube-sync"]')).toContainText(
    'Se bajaron 2 cambios del equipo.',
  );
  await page
    .getByRole('navigation', { name: 'Secciones del cuaderno' })
    .getByRole('link', { name: 'Áreas' })
    .click();
  await expect(page.getByText('Bloque 1')).toBeVisible();
  await expect(page.locator('[data-prueba="indicador-datos"]')).toHaveText(
    'Sin registros pendientes',
  );
});

test('HU-E5.5 CA2: si la nube dice que esta versión es vieja, el aviso lo dice y los datos suben igual', async ({
  page,
}) => {
  await fincaConUnClima(page);
  await coreFalso(page);
  await nubeFalsa(page, (op) => ({ id: op.id, estado: 'aceptado' }), {
    actualizar: {
      minima: '9.9.9',
      motivo:
        'Esta versión del cuaderno ya es vieja. Actualízala para seguir sincronizando sin problemas; lo que registraste se está enviando igual.',
    },
  });
  await cuenta(page);
  await entrar(page);
  await page.getByRole('button', { name: 'Subir mi finca a la nube' }).click();
  await expect(page.locator('[data-prueba="pedido-actualizar"]')).toContainText(
    'Esta versión del cuaderno ya es vieja.',
  );
  await expect(page.locator('[data-prueba="indicador-datos"]')).toHaveText(
    'Sin registros pendientes',
  );
});

test('bitácora agro 22: lo que se registra con la finca en la nube sube solo, sin recargar', async ({
  page,
}) => {
  await fincaConUnClima(page);
  await coreFalso(page);
  const lotes = await nubeFalsa(page, (op) => ({ id: op.id, estado: 'aceptado' }));
  await cuenta(page);
  await entrar(page);
  await page.getByRole('button', { name: 'Subir mi finca a la nube' }).click();
  await expect(page.locator('[data-prueba="nube-sync"]')).toContainText(
    'Lo del equipo se revisó a las',
  );
  const antes = lotes.length;
  // Un registro nuevo, sin tocar «Sincronizar ahora» ni recargar.
  await page
    .getByRole('navigation', { name: 'Secciones del cuaderno' })
    .getByRole('link', { name: 'Registrar' })
    .click();
  await page
    .getByLabel('Área', { exact: true })
    .selectOption({ label: FINCA_ENSAYO_UNO.areas[0]?.nombre ?? '' });
  await page.getByLabel('Temperatura del aire (°C)').fill('25');
  await page.getByLabel('Humedad relativa (%)').fill('65');
  await page.getByRole('button', { name: 'Guardar clima' }).click();
  const indicador = page.locator('[data-prueba="indicador-datos"]');
  await expect(indicador).toHaveText('1 registro solo en este teléfono');
  // Sube solo a los pocos segundos de guardar.
  await expect(indicador).toHaveText('Sin registros pendientes', { timeout: 15_000 });
  expect(lotes.length).toBe(antes + 1);
});

test('bitácora agro 26: en el computador, volver a la ventana o tocar la página trae lo del equipo', async ({
  page,
}) => {
  await page.clock.install();
  await fincaConUnClima(page);
  await coreFalso(page);
  await nubeFalsa(page, (op) => ({ id: op.id, estado: 'aceptado' }));
  let pulls = 0;
  await page.route(`${API_STAGING}/api/v1/sync/pull?*`, async (ruta) => {
    pulls++;
    await ruta.fulfill({
      json: { catalogos: [], registros: [], cursor: { registro: 0, catalogo: 0 }, mas: false },
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await cuenta(page);
  await entrar(page);
  await page.getByRole('button', { name: 'Subir mi finca a la nube' }).click();
  await expect(page.locator('[data-prueba="nube-sync"]')).toContainText(
    'Lo del equipo se revisó a las',
  );
  const antes = pulls;
  // Muy pronto: no vuelve a pedir.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.clock.fastForward(1_000);
  expect(pulls).toBe(antes);
  // Pasados 30 s, volver a la ventana revisa lo del equipo.
  await page.clock.fastForward(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => pulls).toBe(antes + 1);
  // Y también tocar la página.
  await page.clock.fastForward(31_000);
  await page.locator('h1').click();
  await expect.poll(() => pulls).toBe(antes + 2);
});

test('HU-E8.6: con la cuota agotada, el aviso dice hasta qué hora y que los datos están a salvo', async ({
  page,
}) => {
  await fincaConUnClima(page);
  await coreFalso(page);
  await nubeFalsa(page, (op) => ({ id: op.id, estado: 'aceptado' }));
  // La nube llegó a su límite: el push responde «bloqueo» (registrado después, manda).
  await page.route(`${API_STAGING}/api/v1/sync/push`, async (ruta) => {
    await ruta.fulfill({
      status: 503,
      headers: { 'access-control-allow-origin': '*', 'retry-after': '600' },
      json: { estado: 'bloqueo', motivo: 'límite', reanuda: '2099-01-01T00:00:00.000Z' },
    });
  });
  await cuenta(page);
  await entrar(page);
  await page.getByRole('button', { name: 'Subir mi finca a la nube' }).click();
  const aviso = page.locator('[data-prueba="aviso-pausa"]');
  await expect(aviso).toContainText('La sincronización está en pausa hasta las 19:00');
  await expect(aviso).toContainText('(hora de Colombia)');
  await expect(aviso).toContainText('Tus registros están guardados en este teléfono.');
  await expect(page.locator('[data-prueba="nube-sync"]')).toContainText(
    'la nube llegó a su límite de hoy',
  );
  await expect(page.locator('[data-prueba="indicador-datos"]')).toHaveText(
    '1 registro solo en este teléfono',
  );
});

test('HU-E5.6 CA3: si la nube ve la hora del teléfono adelantada, el aviso pide corregirla', async ({
  page,
}) => {
  await fincaConUnClima(page);
  await coreFalso(page);
  await nubeFalsa(page, (op) =>
    op.entidad === 'registro'
      ? { id: op.id, estado: 'aceptado', aviso: 'reloj-corrido' }
      : { id: op.id, estado: 'aceptado' },
  );
  await cuenta(page);
  await entrar(page);
  await page.getByRole('button', { name: 'Subir mi finca a la nube' }).click();
  const aviso = page.locator('[data-prueba="aviso-reloj"]');
  await expect(aviso).toContainText('La hora de este teléfono está adelantada.');
  await expect(aviso).toContainText('activa «hora automática»');
  await expect(page.locator('[data-prueba="indicador-datos"]')).toHaveText(
    'Sin registros pendientes',
  );
});

test.describe('HU-E4.4 · invitar al equipo por WhatsApp', () => {
  const permitir = { 'access-control-allow-origin': '*' };
  const CODIGO = 'invitacion-e2e';
  const ORG = '0199a1b2-0000-7000-8000-0000000000dd';

  test('CA1: el propietario elige el rol y el mensaje sale listo para WhatsApp', async ({
    page,
  }) => {
    await fincaConUnClima(page);
    await coreFalso(page);
    await nubeFalsa(page, (op) => ({ id: op.id, estado: 'aceptado' }));
    const pedidos: unknown[] = [];
    await page.route(`${CORE}/api/core/invitaciones`, async (ruta) => {
      pedidos.push(ruta.request().postDataJSON());
      await ruta.fulfill({
        status: 201,
        json: { codigo: CODIGO, rol: 'supervisor', expira: '2026-10-08T12:00:00.000Z' },
        headers: permitir,
      });
    });
    await cuenta(page);
    await entrar(page);
    await page.getByRole('button', { name: 'Subir mi finca a la nube' }).click();
    const equipo = page.locator('[data-prueba="tu-equipo"]');
    await expect(equipo).toBeVisible();
    await equipo.getByLabel('Rol').selectOption('supervisor');
    await equipo.getByRole('button', { name: 'Preparar invitación' }).click();
    const enviar = page.locator('[data-prueba="enviar-whatsapp"]');
    await expect(enviar).toBeVisible();
    const href = (await enviar.getAttribute('href')) ?? '';
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    const mensaje = new URL(href).searchParams.get('text') ?? '';
    expect(mensaje).toContain('Finca Ensayo Uno como supervisor');
    expect(mensaje).toContain(`/agro/app/unirme/#invitacion=${CODIGO}`);
    expect(pedidos).toEqual([{ rol: 'supervisor' }]);
  });

  test('CA2 y CA4: quien recibe el enlace entra con Google, se une y la finca baja a su teléfono', async ({
    page,
  }) => {
    const urls: string[] = [];
    const cuerpos: unknown[] = [];
    page.on('request', (r) => {
      if (r.resourceType() !== 'document') urls.push(r.url());
    });
    await coreFalso(page);
    await page.route(`${CORE}/api/core/invitaciones/ver`, async (ruta) => {
      cuerpos.push(ruta.request().postDataJSON());
      await ruta.fulfill({
        json: {
          estado: 'vigente',
          finca: 'Finca Ensayo Dos',
          rol: 'operario',
          invita: 'Persona Ensayo',
          expira: '2026-10-08T12:00:00.000Z',
        },
        headers: permitir,
      });
    });
    await page.route(`${CORE}/api/core/invitaciones/aceptar`, async (ruta) => {
      cuerpos.push(ruta.request().postDataJSON());
      await ruta.fulfill({
        json: { org_id: ORG, finca: 'Finca Ensayo Dos', rol: 'operario' },
        headers: permitir,
      });
    });
    await page.route(`${CORE}/api/core/auth/refrescar`, async (ruta) => {
      await ruta.fulfill({
        json: {
          ...sesion,
          refresh: null,
          org_id: ORG,
          url_api: API_STAGING,
          organizaciones: [{ org_id: ORG, nombre: 'Finca Ensayo Dos', rol: 'operario' }],
        },
        headers: permitir,
      });
    });
    await page.route(`${API_STAGING}/api/v1/sync/pull?*`, async (ruta) => {
      await ruta.fulfill({
        json: { catalogos: [], registros: [], cursor: { registro: 0, catalogo: 0 }, mas: false },
        headers: permitir,
      });
    });

    await page.goto(`${APP}unirme/#invitacion=${CODIGO}`);
    await expect(page.locator('[data-prueba="unirme-invitacion"]')).toContainText(
      'Persona Ensayo te invita al cuaderno de Finca Ensayo Dos como operario.',
    );
    expect(new URL(page.url()).hash).toBe(''); // el código salió de la barra de direcciones
    await entrar(page);
    // Cuenta canjea la entrada y, con una invitación pendiente, vuelve a «Unirme».
    await page.getByRole('button', { name: 'Unirme a Finca Ensayo Dos' }).click();
    await expect(page.locator('[data-prueba="unirme-listo"]')).toContainText(
      'Ya eres parte de Finca Ensayo Dos como operario.',
    );
    expect(cuerpos).toEqual([{ codigo: CODIGO }, { codigo: CODIGO }, { codigo: CODIGO }]);
    for (const url of urls) expect(url).not.toContain(CODIGO);
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe('{}');
  });

  test('CA3: un enlace usado o vencido dice por qué y a quién pedir otro', async ({ page }) => {
    await page.route(`${CORE}/api/core/invitaciones/ver`, async (ruta) => {
      await ruta.fulfill({
        status: 410,
        json: {
          estado: 'no-sirve',
          motivo: 'Este enlace ya se usó. Pídele a Persona Ensayo que te mande uno nuevo.',
        },
        headers: permitir,
      });
    });
    await page.goto(`${APP}unirme/#invitacion=${CODIGO}`);
    await expect(page.locator('[data-prueba="unirme-no-sirve"]')).toHaveText(
      'Este enlace ya se usó. Pídele a Persona Ensayo que te mande uno nuevo.',
    );
    await expect(page.getByRole('button', { name: 'Entrar con Google' })).toHaveCount(0);
  });

  test('«Unirme» no aparece en el menú', async ({ page }) => {
    await page.goto(`${APP}unirme/`);
    await expect(page.locator('[data-prueba="unirme-sin-invitacion"]')).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Secciones del cuaderno' }).getByRole('link', {
        name: 'Unirme',
      }),
    ).toHaveCount(0);
  });
});

test.describe('HU-E4.5 · la interfaz esconde lo que el rol no puede (la celda decide)', () => {
  const ORG = '0199a1b2-0000-7000-8000-0000000000ee';
  const conRol = (rol: string) => ({
    ...sesion,
    org_id: ORG,
    organizaciones: [{ org_id: ORG, nombre: 'Finca Ensayo Uno', rol }],
  });
  const ir = (page: Page, seccion: string) =>
    page
      .getByRole('navigation', { name: 'Secciones del cuaderno' })
      .getByRole('link', { name: seccion })
      .click();

  test('operario: registra, pero no cambia áreas, insumos ni personas', async ({ page }) => {
    await page.route(`${API_STAGING}/**`, (ruta) => ruta.abort());
    await configurar(page, FINCA_ENSAYO_UNO);
    await coreFalso(page, conRol('operario'));
    await cuenta(page);
    await entrar(page);
    await expect(page.locator('[data-prueba="cuenta-usuario"]')).toContainText('Persona Ensayo');
    await ir(page, 'Registrar');
    await expect(page.getByRole('button', { name: 'Guardar clima' })).toBeVisible();
    await ir(page, 'Insumos');
    await expect(page.locator('[data-prueba="solo-consulta"]')).toHaveText(
      'Con el rol de operario puedes consultar los insumos. Los cambios los hace quien administra la finca.',
    );
    await expect(page.getByRole('button', { name: 'Agregar insumo' })).toHaveCount(0);
    await ir(page, 'Personas');
    await expect(page.locator('[data-prueba="solo-consulta"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar persona' })).toHaveCount(0);
    await ir(page, 'Áreas');
    await expect(page.locator('[data-prueba="solo-consulta"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar área' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Iniciar ciclo/ })).toHaveCount(0);
    // HU-E6.3: los despachos llevan precios; el operario no los ve.
    await ir(page, 'Lotes');
    await expect(page.getByRole('heading', { level: 1, name: 'Lotes de venta' })).toBeVisible();
    await expect(
      page.locator('[data-prueba="pestanas-lotes"]').getByRole('button', { name: 'Despachos' }),
    ).toHaveCount(0);
  });

  test('asesor: consulta, sin formularios para registrar', async ({ page }) => {
    await page.route(`${API_STAGING}/**`, (ruta) => ruta.abort());
    await configurar(page, FINCA_ENSAYO_UNO);
    await coreFalso(page, conRol('asesor'));
    await cuenta(page);
    await entrar(page);
    await expect(page.locator('[data-prueba="cuenta-usuario"]')).toContainText('Persona Ensayo');
    await ir(page, 'Registrar');
    await expect(page.locator('[data-prueba="solo-consulta"]')).toHaveText(
      'Con el rol de asesor puedes consultar lo que registra el equipo. Los cambios los hace quien administra la finca.',
    );
    await expect(page.getByRole('button', { name: 'Guardar clima' })).toHaveCount(0);
  });

  test('sin finca en la nube, el teléfono es de quien lo configuró y puede todo', async ({
    page,
  }) => {
    await configurar(page, FINCA_ENSAYO_UNO);
    await ir(page, 'Insumos');
    await expect(page.getByRole('button', { name: 'Agregar insumo' })).toBeVisible();
    await expect(page.locator('[data-prueba="solo-consulta"]')).toHaveCount(0);
    await ir(page, 'Lotes');
    await expect(
      page.locator('[data-prueba="pestanas-lotes"]').getByRole('button', { name: 'Despachos' }),
    ).toBeVisible();
  });
});

test.describe('HU-E4.6 · revocar un teléfono o una persona', () => {
  const permitir = { 'access-control-allow-origin': '*' };

  test('CA1 y CA2: retirar un dispositivo perdido dice que tarda hasta 12 h y que lo guardado no se borra', async ({
    page,
  }) => {
    const canjes = await coreFalso(page);
    const retirados: unknown[] = [];
    let este = '';
    await page.route(`${CORE}/api/core/telefonos/ver`, (r) =>
      r.fulfill({
        json: {
          telefonos: [
            { id: 'sesion-1', dispositivo: este, creado: '2026-09-01T12:00:00.000Z' },
            { id: 'sesion-2', dispositivo: 'otro-telefono', creado: '2026-09-15T12:00:00.000Z' },
          ].filter((t) => !retirados.some((x) => (x as { id: string }).id === t.id)),
        },
        headers: permitir,
      }),
    );
    await page.route(`${CORE}/api/core/telefonos/retirar`, async (r) => {
      retirados.push(r.request().postDataJSON());
      await r.fulfill({ json: { id: 'sesion-2', retirado: true }, headers: permitir });
    });
    await cuenta(page);
    // El id de este teléfono es el que mandó al canjear.
    page.on('request', (r) => {
      if (r.url().endsWith('/api/core/auth/canje'))
        este = (r.postDataJSON() as { dispositivo: string }).dispositivo;
    });
    await entrar(page);
    await expect.poll(() => canjes.length).toBe(1);
    const lista = page.locator('[data-prueba="tus-dispositivos"]');
    await expect(lista.locator('[data-prueba="dispositivo"]')).toHaveCount(2);
    await expect(lista).toContainText('Este dispositivo · desde el 1 sep 2026');
    await expect(lista).toContainText('Otro dispositivo · desde el 15 sep 2026');
    // Este dispositivo no se retira desde aquí (para eso está «Salir de la cuenta»).
    await expect(lista.getByRole('button', { name: /^Retirar acceso/ })).toHaveCount(1);
    await lista
      .getByRole('button', {
        name: 'Retirar acceso al dispositivo que entró el 15 de septiembre de 2026',
      })
      .click();
    await expect(lista.locator('[data-prueba="confirmar-retirar"]')).toContainText(
      'Deja de sincronizar en máximo 12 horas. Lo que ya está guardado en él no se puede borrar a distancia.',
    );
    await lista.getByRole('button', { name: 'Sí, retirar acceso' }).click();
    await expect(lista.getByRole('status')).toContainText('deja de sincronizar en máximo 12 horas');
    // Lista plana: las filas no son tarjetas.
    await expect(lista.locator('.area')).toHaveCount(0);
    expect(retirados).toEqual([{ id: 'sesion-2' }]);
    await expect(lista.locator('[data-prueba="dispositivo"]')).toHaveCount(1);
  });

  test('el propietario cambia el rol de alguien y le quita el acceso, con confirmación', async ({
    page,
  }) => {
    await fincaConUnClima(page);
    await coreFalso(page);
    await nubeFalsa(page, (op) => ({ id: op.id, estado: 'aceptado' }));
    const pedidos: { ruta: string; cuerpo: unknown }[] = [];
    let quitado = false;
    await page.route(`${CORE}/api/core/equipo/ver`, (r) =>
      r.fulfill({
        json: {
          miembros: [
            { usuario_id: 'u1', nombre: 'Persona Ensayo', rol: 'propietario', tu: true },
            ...(quitado
              ? []
              : [{ usuario_id: 'u2', nombre: 'Persona Ensayo Dos', rol: 'operario', tu: false }]),
          ],
        },
        headers: permitir,
      }),
    );
    for (const ruta of ['rol', 'quitar']) {
      await page.route(`${CORE}/api/core/equipo/${ruta}`, async (r) => {
        pedidos.push({ ruta, cuerpo: r.request().postDataJSON() });
        if (ruta === 'quitar') quitado = true;
        await r.fulfill({ json: {}, headers: permitir });
      });
    }
    await cuenta(page);
    await entrar(page);
    await page.getByRole('button', { name: 'Subir mi finca a la nube' }).click();
    const acceso = page.locator('[data-prueba="personas-con-acceso"]');
    await expect(acceso.locator('[data-prueba="miembro"]')).toHaveCount(2);
    await expect(acceso).toContainText('Persona Ensayo · propietario (tú)');
    // Nadie se cambia ni se quita a sí mismo.
    await expect(acceso.getByRole('button', { name: 'Quitar acceso' })).toHaveCount(1);
    await acceso.getByLabel('Rol de Persona Ensayo Dos').selectOption('supervisor');
    await expect(acceso.getByRole('status')).toContainText(
      'Persona Ensayo Dos ahora es supervisor',
    );
    await acceso.getByRole('button', { name: 'Quitar acceso' }).click();
    await expect(acceso.locator('[data-prueba="confirmar-quitar"]')).toContainText(
      'Lo que ya está guardado en su teléfono no se puede borrar a distancia. Lo que anotó se queda en la finca.',
    );
    await acceso.getByRole('button', { name: 'Sí, quitar acceso' }).click();
    await expect(acceso.getByRole('status')).toHaveText(
      'Persona Ensayo Dos ya no tiene acceso a la finca.',
    );
    await expect(acceso.locator('[data-prueba="miembro"]')).toHaveCount(1);
    expect(pedidos).toEqual([
      { ruta: 'rol', cuerpo: { usuario_id: 'u2', rol: 'supervisor' } },
      { ruta: 'quitar', cuerpo: { usuario_id: 'u2' } },
    ]);
  });
});

test('HU-E5.4 CA2: si otra persona reemplazó mi cambio, lo dice y puedo volver a ponerlo', async ({
  page,
}) => {
  await fincaConUnClima(page);
  await coreFalso(page);
  const subidas: {
    dispositivo: string;
    ops: { entidad: string; datos: Record<string, unknown> }[];
  }[] = [];
  await nubeFalsa(page, (op) => ({ id: op.id, estado: 'aceptado' }));
  page.on('request', (r) => {
    if (r.url().endsWith('/api/v1/sync/push') && r.method() === 'POST')
      subidas.push(r.postDataJSON());
  });
  await cuenta(page);
  await entrar(page);
  await page.getByRole('button', { name: 'Subir mi finca a la nube' }).click();
  await expect(page.locator('[data-prueba="nube-pendientes"]')).toHaveText(
    'Nada pendiente por subir.',
  );
  const area = subidas.flatMap((s) => s.ops).find((o) => o.entidad === 'area')?.datos;
  const dispositivo = subidas[0]?.dispositivo;
  if (!area || !dispositivo) throw new Error('no subió el área');
  const version = area['version'] as number;
  // La nube: otra persona editó la misma área sin señal y ganó.
  let entregado = false;
  await page.route(`${API_STAGING}/api/v1/sync/pull?*`, async (ruta) => {
    const catalogos = entregado
      ? []
      : [
          {
            entidad: 'area',
            datos: { ...area, version: version + 1, nombre: 'Nombre de otro teléfono' },
            reemplazo: { version, dispositivo, por_usuario: null },
          },
        ];
    entregado = true;
    await ruta.fulfill({
      json: { catalogos, registros: [], cursor: { registro: 0, catalogo: 99 }, mas: false },
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.getByRole('button', { name: 'Sincronizar ahora' }).click();
  const aviso = page.locator('[data-prueba="aviso-reemplazo"]');
  await expect(aviso).toContainText(
    `Tu cambio en el área «${String(area['nombre'])}» fue reemplazado por el de otra persona del equipo, que editó lo mismo sin señal.`,
  );
  const antes = subidas.length;
  await aviso.getByRole('button', { name: 'Volver a poner mi cambio' }).click();
  await expect(aviso).toHaveCount(0);
  await expect.poll(() => subidas.length).toBeGreaterThan(antes);
  const reaplicada = subidas
    .slice(antes)
    .flatMap((s) => s.ops)
    .find((o) => o.entidad === 'area')?.datos;
  expect(reaplicada).toMatchObject({ nombre: area['nombre'], version: version + 2 });
});
