/**
 * HU-C7.3: entrar a la cuenta y salir, en el navegador. El CORE se simula en el mismo origen de la
 * cuenta (como en producción, donde el Worker del CORE la sirve): sus pruebas de verdad están en
 * `apps/core/src/entrar.test.ts`. Aquí se prueba la página: el formulario, el canje, volver y salir.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const CUENTA = 'http://localhost:4330';

/** Sesiones, pagos y actividad vacíos (HU-C7.5, HU-C7.6, HU-C7.8), salvo que la prueba diga otra cosa. */
async function loMioVacio(page: Page) {
  for (const [ruta, json] of [
    ['sesiones', { sesiones: [] }],
    ['pagos', { pagos: [] }],
    ['actividad', { hechos: [] }],
    ['asistentes', { asistentes: [] }],
    ['radicados', { radicados: [] }],
  ] as const) {
    await page.route(`${CUENTA}/api/core/cuenta/${ruta}`, (r) => r.fulfill({ json }));
  }
}

/** El CORE falso: anota lo que le piden y responde como el de verdad. */
async function coreFalso(page: Page, canje: { status: number; json: unknown }) {
  const pedidos: { ruta: string; url: string; cuerpo: unknown }[] = [];
  await loMioVacio(page);
  await page.route(`${CUENTA}/api/core/auth/google/inicio?*`, async (ruta) => {
    pedidos.push({ ruta: 'inicio', url: ruta.request().url(), cuerpo: null });
    await ruta.fulfill({ status: 302, headers: { location: `${CUENTA}/#entrar=codigo-e2e` } });
  });
  await page.route(`${CUENTA}/api/core/auth/canje`, async (ruta) => {
    pedidos.push({ ruta: 'canje', url: '', cuerpo: ruta.request().postDataJSON() });
    await ruta.fulfill(canje);
  });
  await page.route(`${CUENTA}/api/core/auth/salir`, async (ruta) => {
    pedidos.push({ ruta: 'salir', url: '', cuerpo: ruta.request().postDataJSON() });
    await ruta.fulfill({ json: { estado: 'fuera' } });
  });
  // Sin espacios, salvo que la prueba diga otra cosa (HU-C7.4).
  await page.route(`${CUENTA}/api/core/cuenta/espacios`, (ruta) =>
    ruta.fulfill({ json: { espacios: [] } }),
  );
  return pedidos;
}

/** Una persona que ya había entrado: su refresh guardado y el CORE que lo renueva. */
async function conSesionGuardada(page: Page, espacios: { status: number; json: unknown }[]) {
  await page.addInitScript(() =>
    localStorage.setItem('ed1-cuenta', JSON.stringify({ refresh: 'r-guardado', nombre: 'Ana' })),
  );
  const pedidos: { ruta: string; autorizacion: string | null }[] = [];
  await loMioVacio(page);
  await page.route(`${CUENTA}/api/core/auth/refrescar`, (ruta) =>
    ruta.fulfill({ json: { acceso: 'acceso-cuenta', refresh: null } }),
  );
  await page.route(`${CUENTA}/api/core/cuenta/espacios`, async (ruta) => {
    pedidos.push({
      ruta: 'espacios',
      autorizacion: ruta.request().headers()['authorization'] ?? null,
    });
    await ruta.fulfill(espacios.shift() ?? { status: 500, json: {} });
  });
  return pedidos;
}

const DOS_ESPACIOS = {
  espacios: [
    {
      org_id: 'o1',
      nombre: 'Finca La Esperanza',
      producto: 'agro',
      producto_nombre: 'CultivoPro',
      rol: 'propietario',
      plan: 'finca',
      plan_nombre: 'Finca',
      plan_vence: '2027-02-28T15:00:00.000Z',
      abrir: 'https://cultivopro.co/agro/app/',
    },
    {
      org_id: 'o2',
      nombre: 'Panadería de prueba',
      producto: 'ensayo',
      producto_nombre: 'Ensayo',
      rol: 'dueno',
      plan: 'gratis',
      plan_nombre: 'Gratis',
      plan_vence: null,
      abrir: 'https://ed1-ensayo-staging.laboratoriodigital-la.workers.dev/',
    },
  ],
};

test('HU-C7.4 · CA1: una tarjeta por espacio de cada producto, con su plan y el botón que lo abre', async ({
  page,
}) => {
  const pedidos = await conSesionGuardada(page, [{ status: 200, json: DOS_ESPACIOS }]);
  await page.goto(`${CUENTA}/`);
  const lista = page.getByRole('list', { name: 'Tus espacios' });
  await expect(lista.getByRole('listitem')).toHaveCount(2);
  await expect(lista.getByText('CultivoPro · Propietario')).toBeVisible();
  await expect(lista.getByText('28 feb 2027')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir en CultivoPro' })).toHaveAttribute(
    'href',
    'https://cultivopro.co/agro/app/',
  );
  await expect(page.getByRole('link', { name: 'Abrir en Ensayo' })).toBeVisible();
  expect(pedidos).toEqual([{ ruta: 'espacios', autorizacion: 'Bearer acceso-cuenta' }]);
  // axe mide el estado final: el revelado al desplazar (HU-C6.5) baja la opacidad solo mientras
  // un elemento entra a la pantalla, y a media animación el contraste no es el que se lee.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('HU-C7.4 · CA2: sin espacios dice qué hacer; con un error, la causa y cómo reintentar', async ({
  page,
}) => {
  await conSesionGuardada(page, [
    {
      status: 503,
      json: { estado: 'apagado', motivo: 'Entrar está en pausa. Intenta más tarde.' },
    },
    { status: 200, json: { espacios: [] } },
  ]);
  await page.goto(`${CUENTA}/`);
  await expect(page.getByText('Entrar está en pausa. Intenta más tarde.')).toBeVisible();
  await page
    .getByRole('region', { name: 'Tus espacios' })
    .getByRole('button', { name: 'Intentar de nuevo' })
    .click();
  await expect(page.getByText(/Todavía no tienes espacios/)).toBeVisible();
  await expect(page.getByText('Entrar está en pausa. Intenta más tarde.')).toBeHidden();
  await expect(page.getByRole('link', { name: 'Conocer CultivoPro' })).toBeVisible();
});

test('HU-C7.3 · CA1 y CA3: entrar con la política aceptada, ver quién entró y salir en el CORE', async ({
  page,
}) => {
  const pedidos = await coreFalso(page, {
    status: 200,
    json: { refresh: 'refresh-e2e', usuario: { nombre: 'Ana Restrepo', email: 'ana@x.co' } },
  });
  await page.goto(`${CUENTA}/`);
  const entrar = page.getByRole('button', { name: 'Entrar con Google' });
  // Sin aceptar la política, el navegador no deja salir el formulario.
  await entrar.click();
  expect(pedidos).toEqual([]);
  await page.getByLabel(/Leí y acepto la política/).check();
  await entrar.click();

  await expect(page.getByText('Entraste como Ana Restrepo.')).toBeVisible();
  const inicio = new URL(pedidos[0]?.url ?? '');
  expect(Object.fromEntries(inicio.searchParams)).toMatchObject({
    producto: 'cuenta',
    politica: '1',
    vuelta: `${CUENTA}/`,
  });
  expect(pedidos[1]).toMatchObject({ ruta: 'canje', cuerpo: { codigo: 'codigo-e2e' } });
  // El código no se queda en la barra de direcciones.
  expect(page.url()).toBe(`${CUENTA}/`);

  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(entrar).toBeVisible();
  expect(pedidos[2]).toEqual({ ruta: 'salir', url: '', cuerpo: { refresh: 'refresh-e2e' } });
  // Al volver a la página, sigue sin sesión.
  await page.reload();
  await expect(entrar).toBeVisible();
});

test('HU-C7.3 · CA2: si viene de una app declarada, dice a cuál vuelve; de otra, no', async ({
  page,
  browser,
}) => {
  await coreFalso(page, {
    status: 200,
    json: { refresh: 'refresh-e2e', usuario: { nombre: 'Ana Restrepo' } },
  });
  await page.goto(`${CUENTA}/?vuelve=${encodeURIComponent('https://cultivopro.co/agro/app/')}`);
  await expect(page.getByText('Después de entrar puedes volver a CultivoPro.')).toBeVisible();
  await page.getByLabel(/Leí y acepto la política/).check();
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
  const volver = page.getByRole('link', { name: 'Volver a CultivoPro' });
  await expect(volver).toHaveAttribute('href', 'https://cultivopro.co/agro/app/');

  // Otro navegador, sin sesión guardada.
  const otra = await (await browser.newContext()).newPage();
  await otra.goto(`${CUENTA}/?vuelve=${encodeURIComponent('https://otro.ejemplo.test/robar')}`);
  await expect(otra.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();
  await expect(otra.getByText(/puedes volver a/)).toBeHidden();
});

test('HU-C7.3 · si el canje falla, lo dice junto a la acción', async ({ page }) => {
  await coreFalso(page, {
    status: 401,
    json: { estado: 'sin-sesion', motivo: 'Este enlace de entrada ya se usó o venció.' },
  });
  await page.goto(`${CUENTA}/#entrar=codigo-viejo`);
  await expect(page.getByText('Este enlace de entrada ya se usó o venció.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();
});

test('HU-C7.3 · la portada y la política no tienen violaciones de accesibilidad', async ({
  page,
}) => {
  // axe mide el estado final: el revelado al desplazar (HU-C6.5) baja la opacidad solo mientras
  // un elemento entra a la pantalla, y a media animación el contraste no es el que se lee.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const ruta of ['/', '/privacidad/']) {
    await page.goto(`${CUENTA}${ruta}`);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${ruta} ${v.id}: ${v.help}`)).toEqual([]);
  }
});

test.describe('HU-C7.5, HU-C7.6 y HU-C7.8 · lo mío en la cuenta', () => {
  const SESIONES = {
    sesiones: [
      {
        id: 's-esta',
        producto_nombre: 'Laboratorio Digital',
        dispositivo: 'a1b2c3',
        creado: '2026-10-12T14:00:00.000Z',
        ultimo_uso: '2026-10-12T14:00:00.000Z',
        esta: true,
      },
      {
        id: 's-telefono',
        producto_nombre: 'CultivoPro',
        dispositivo: '9f8e7d',
        creado: '2026-09-30T12:00:00.000Z',
        ultimo_uso: '2026-10-11T22:00:00.000Z',
        esta: false,
      },
    ],
  };

  test('HU-C7.5 · cerrar la sesión de un teléfono pide entrar de nuevo y luego la cierra', async ({
    page,
  }) => {
    await conSesionGuardada(page, [{ status: 200, json: { espacios: [] } }]);
    const cierres: unknown[] = [];
    let respuestas = [
      {
        status: 403,
        json: {
          estado: 'entrar-de-nuevo',
          motivo: 'Para cerrar sesiones, vuelve a entrar con Google. Así sabemos que eres tú.',
        },
      },
      { status: 200, json: { cerradas: 1 } },
    ];
    let lista = SESIONES;
    await page.route(`${CUENTA}/api/core/cuenta/sesiones`, (r) => r.fulfill({ json: lista }));
    await page.route(`${CUENTA}/api/core/cuenta/sesiones/cerrar`, async (r) => {
      cierres.push(r.request().postDataJSON());
      const [primera, ...resto] = respuestas;
      respuestas = resto;
      await r.fulfill(primera ?? { status: 500, json: {} });
    });
    await page.goto(`${CUENTA}/`);
    const bloque = page.getByRole('region', { name: 'Dónde has entrado' });
    await expect(bloque.getByRole('listitem')).toHaveCount(2);
    await expect(bloque.getByText('Este navegador')).toBeVisible();
    await expect(bloque.getByText(/Equipo …9f8e7d · entró el 30 sept 2026/)).toBeVisible();
    // La propia no se cierra desde aquí: para eso está «Salir».
    await expect(bloque.getByRole('button', { name: /^Cerrar la sesión/ })).toHaveCount(1);

    await bloque
      .getByRole('button', { name: 'Cerrar la sesión de CultivoPro en el equipo …9f8e7d' })
      .click();
    const aviso = bloque.getByRole('alert').filter({ hasText: 'vuelve a entrar con Google' });
    await expect(aviso).toBeVisible();
    await expect(aviso).toBeInViewport();
    await aviso.getByRole('button', { name: 'Entrar de nuevo' }).click();
    await expect(page.getByRole('checkbox', { name: /Leí y acepto/ })).toBeFocused();

    // Como si ya hubiera vuelto de Google: el mismo botón ahora cierra.
    lista = { sesiones: SESIONES.sesiones.slice(0, 1) };
    await bloque
      .getByRole('button', { name: 'Cerrar la sesión de CultivoPro en el equipo …9f8e7d' })
      .click();
    await expect(bloque.getByText('No tienes otras sesiones abiertas.')).toBeVisible();
    expect(cierres).toEqual([{ sesion: 's-telefono' }, { sesion: 's-telefono' }]);
  });

  test('HU-C7.6 · mis pagos con el periodo, el monto en cifras y el estado; HU-C7.8 · la actividad en frases', async ({
    page,
  }) => {
    await conSesionGuardada(page, [{ status: 200, json: { espacios: [] } }]);
    await page.route(`${CUENTA}/api/core/cuenta/pagos`, (r) =>
      r.fulfill({
        json: {
          pagos: [
            {
              espacio: 'Finca La Esperanza',
              plan_nombre: 'Finca',
              meses: 6,
              monto_cop: 210000,
              estado: 'aprobado',
              creado: '2026-11-01T15:00:00.000Z',
              periodo_desde: '2026-11-01T05:00:00.000Z',
              periodo_hasta: '2027-05-01T05:00:00.000Z',
            },
          ],
        },
      }),
    );
    await page.route(`${CUENTA}/api/core/cuenta/actividad`, (r) =>
      r.fulfill({
        json: {
          hechos: [
            {
              espacio: 'Finca La Esperanza',
              instante: '2026-11-02T13:30:00.000Z',
              frase: 'Ana cambió a Luis de operario a supervisor.',
            },
          ],
        },
      }),
    );
    await page.goto(`${CUENTA}/`);
    const pagos = page.getByRole('region', { name: 'Tus pagos' });
    await expect(pagos.getByText('Finca · Finca La Esperanza')).toBeVisible();
    const monto = pagos.getByText('COP 210.000');
    await expect(monto).toBeVisible();
    expect(await monto.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Geist Mono/);
    await expect(pagos.getByText(/del 01 nov 2026 al 01 may 2027 · Aprobado/)).toBeVisible();
    const actividad = page.getByRole('region', { name: 'Lo que pasó en tus espacios' });
    await expect(actividad.getByText('Ana cambió a Luis de operario a supervisor.')).toBeVisible();
    // La hora de Bogotá: 13:30 UTC son las 8:30 a. m.
    await expect(actividad.getByText(/Finca La Esperanza · 2 de nov,? 8:30/)).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('HU-C7.6 CA2 y HU-C7.8 CA2 · quien no administra ve que no hay nada, no los de otros', async ({
    page,
  }) => {
    await conSesionGuardada(page, [{ status: 200, json: { espacios: [] } }]);
    await page.goto(`${CUENTA}/`);
    await expect(
      page.getByText('Todavía no hay pagos en los espacios que administras.'),
    ).toBeVisible();
    await expect(page.getByText('Todavía no ha pasado nada que mostrar.')).toBeVisible();
  });
});

test('HU-C9.6 · los asistentes con acceso, con lo que pueden hacer, y «Quitar acceso»', async ({
  page,
}) => {
  await conSesionGuardada(page, [{ status: 200, json: { espacios: [] } }]);
  let lista = [
    {
      id: 'k1',
      cliente: 'Asistente Ensayo',
      espacio: 'Finca La Esperanza',
      producto_nombre: 'CultivoPro',
      puede: ['Leer los registros de tu finca. No puede cambiar nada.'],
      creada: '2026-11-01T15:00:00.000Z',
      ultimo_uso: null,
    },
  ];
  const quitados: unknown[] = [];
  await page.route(`${CUENTA}/api/core/cuenta/asistentes`, (r) =>
    r.fulfill({ json: { asistentes: lista } }),
  );
  await page.route(`${CUENTA}/api/core/cuenta/asistentes/quitar`, async (r) => {
    quitados.push(r.request().postDataJSON());
    lista = [];
    await r.fulfill({ json: { quitado: true } });
  });
  await page.goto(`${CUENTA}/`);
  const bloque = page.getByRole('region', { name: 'Asistentes con acceso' });
  await expect(bloque.getByText('Asistente Ensayo · Finca La Esperanza')).toBeVisible();
  await expect(
    bloque.getByText(/No puede cambiar nada\. · CultivoPro · .* · todavía no lo ha usado/),
  ).toBeVisible();
  await bloque
    .getByRole('button', { name: 'Quitar el acceso de Asistente Ensayo a Finca La Esperanza' })
    .click();
  await expect(bloque.getByText('Ningún asistente tiene acceso a tus espacios.')).toBeVisible();
  expect(quitados).toEqual([{ id: 'k1' }]);
});

test('HU-C7.7 · tus datos: descargarlos y radicar una supresión con su número y su fecha', async ({
  page,
}) => {
  await conSesionGuardada(page, [{ status: 200, json: { espacios: [] } }]);
  const radicados: {
    numero: string;
    tipo: string;
    creado: string;
    vence: string;
    estado: string;
  }[] = [];
  const pedidos: unknown[] = [];
  await page.route(`${CUENTA}/api/core/cuenta/radicados`, (r) =>
    r.fulfill({ json: { radicados } }),
  );
  await page.route(`${CUENTA}/api/core/cuenta/mis-datos`, (r) =>
    r.fulfill({ json: { persona: { id: 'u-ana', nombre: 'Ana' }, espacios: [] } }),
  );
  await page.route(`${CUENTA}/api/core/cuenta/radicar`, async (r) => {
    pedidos.push(r.request().postDataJSON());
    radicados.push({
      numero: 'LD-20261102-A1B2C3',
      tipo: 'supresion',
      creado: '2026-11-02T15:00:00.000Z',
      vence: '2026-11-24',
      estado: 'abierto',
    });
    await r.fulfill({
      status: 201,
      json: {
        numero: 'LD-20261102-A1B2C3',
        vence: '2026-11-24',
        mensaje:
          'Recibimos tu solicitud de supresión con el número LD-20261102-A1B2C3. Te respondemos a más tardar el 24 nov 2026.',
      },
    });
  });
  await page.goto(`${CUENTA}/`);
  const datos = page.getByRole('region', { name: 'Tus datos' });
  await expect(datos.getByText('Todavía no has hecho solicitudes sobre tus datos.')).toBeVisible();

  const descarga = page.waitForEvent('download');
  await datos.getByRole('button', { name: 'Descargar mis datos' }).click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toMatch(
    /^mis-datos-laboratorio-digital-\d{4}-\d{2}-\d{2}\.json$/,
  );
  await expect(datos.getByText('Listo: el archivo quedó en tus descargas.')).toBeVisible();

  await datos.getByLabel('Qué necesitas').selectOption('supresion');
  await datos.getByLabel('Cuéntanos').fill('Borrar');
  await datos.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(datos.getByText('Cuéntanos un poco más: al menos 10 caracteres.')).toBeVisible();
  await expect(datos.getByLabel('Cuéntanos')).toHaveAttribute('aria-invalid', 'true');
  expect(pedidos).toEqual([]);

  await datos.getByLabel('Cuéntanos').fill('Quiero que borren mis datos.');
  await datos.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(datos.getByText(/con el número LD-20261102-A1B2C3/)).toBeVisible();
  await expect(datos.getByText('Supresión · LD-20261102-A1B2C3')).toBeVisible();
  // La fecha límite es un día de Bogotá: no se corre al anterior por el huso.
  await expect(datos.getByText(/te respondemos a más tardar el 24 nov 2026/)).toBeVisible();
  expect(pedidos).toEqual([{ tipo: 'supresion', texto: 'Quiero que borren mis datos.' }]);
  // A 360 px nada se sale de la pantalla.
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter(
          (el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5,
        )
        .map(
          (el) => `${el.tagName}.${el.className} ${Math.round(el.getBoundingClientRect().right)}`,
        ),
    ),
  ).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
