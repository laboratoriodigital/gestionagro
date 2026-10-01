/**
 * Cuenta (HU-E4.2) en un teléfono de 360 px. El CORE y Google se reemplazan interceptando la red:
 * esta prueba no ve Google de verdad (P17). La entrada real se prueba en staging (P16).
 * Fuera de producción el cuaderno usa el CORE de staging (`celdas.json`).
 */
import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { FINCA_ENSAYO_UNO } from '../fixtures/fincas.ts';
import { APP, configurar } from './ayudas.ts';

const { core } = JSON.parse(readFileSync('infrastructure/celdas.json', 'utf8')) as {
  core: { url_staging: string };
};
const CORE = core.url_staging;

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
  return canjes;
}

const cuenta = (page: Page) => page.goto(`${APP}cuenta/`);

test('sin cuenta: el cuaderno no la exige y ofrece entrar con Google', async ({ page }) => {
  await cuenta(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Cuenta' })).toBeVisible();
  await expect(page.getByText('El cuaderno funciona sin cuenta.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeEnabled();
});

test('CA1 y CA4: entrar, canjear por POST, y ningún código ni token en la URL ni en localStorage', async ({
  page,
}) => {
  const canjes = await coreFalso(page);
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await cuenta(page);
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
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
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
  await expect(page.locator('[data-prueba="cuenta-estado"]')).toBeVisible();
  await page.getByRole('button', { name: 'Salir de la cuenta' }).click();
  await expect(page.locator('[data-prueba="cuenta-mensaje"]')).toHaveText(
    'Saliste de la cuenta. Tus registros siguen en este teléfono.',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();
});

/** La celda y el resto del CORE falsos: crear la organización, renovar hacia ella y el push. */
async function nubeFalsa(page: Page, respuesta: (op: { id: string; entidad: string }) => object) {
  const API = 'https://agro-api-c0-staging.ejemplo.test';
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
    await ruta.fulfill({ json: { acks: ops.map(respuesta) }, headers: permitir });
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
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
  await expect(page.locator('[data-prueba="nube-sin-subir"]')).toContainText(
    '«Finca Ensayo Uno» está solo en este teléfono.',
  );
  await page.getByRole('button', { name: 'Subir mi finca a la nube' }).click();
  await expect(page.locator('[data-prueba="nube-vinculada"]')).toBeVisible();
  await expect(page.locator('[data-prueba="nube-sync"]')).toContainText('Todo está en la nube.');
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
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
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
  const API = 'https://agro-api-c0-staging.ejemplo.test';
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
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
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
