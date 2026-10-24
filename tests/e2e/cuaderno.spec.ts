/**
 * PWA del cuaderno (HU-E3.1) en un teléfono de 360 px. Se esperan estados, no tiempos (P19).
 */
import { expect, type Page, test } from '@playwright/test';
import { abrirSinCuenta } from './ayudas.ts';

const APP = '/agro/app/';

/** Abre la app y espera a que el service worker la controle (segunda carga). */
async function abrirControlada(page: Page) {
  await abrirSinCuenta(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu finca');
}

/** Configura una finca mínima: así ningún formulario queda abierto. */
async function configurarFincaMinima(page: Page) {
  await page.getByLabel('Nombre de la finca').fill('Finca Ensayo Uno');
  await page.getByLabel('Municipio').fill('Municipio Ensayo A');
  await page.getByLabel('Ecológico').check();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Tipo').selectOption({ label: 'Nave' });
  await page.getByLabel('Nombre', { exact: true }).fill('Nave 1');
  await page.getByLabel('Tamaño (m²)').fill('600');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Guardar mi finca' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Finca Ensayo Uno');
}

test('CA4: manifest con nombre, íconos, scope, color y display standalone', async ({ page }) => {
  const r = await page.request.get(`${APP}manifest.webmanifest`);
  expect(r.ok()).toBe(true);
  const m = await r.json();
  expect(m).toMatchObject({
    name: 'CultivoPro · Cuaderno de campo',
    short_name: 'CultivoPro',
    start_url: APP,
    scope: APP,
    display: 'standalone',
    theme_color: '#1f6b3a',
  });
  for (const icono of m.icons as { src: string; sizes: string }[]) {
    const png = await page.request.get(`${APP}${icono.src}`);
    expect(png.ok(), icono.src).toBe(true);
    const cuerpo = await png.body();
    const lado = cuerpo.readUInt32BE(16);
    expect(`${lado}x${cuerpo.readUInt32BE(20)}`).toBe(icono.sizes);
  }
});

test('CA4: el navegador la considera instalable', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Usa el protocolo de Chromium');
  await abrirControlada(page);
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  // «in-incognito» es del perfil temporal de Playwright, no de la app. Cualquier otro motivo falla.
  expect(installabilityErrors.map((e) => e.errorId).filter((id) => id !== 'in-incognito')).toEqual(
    [],
  );
});

test('CA5: noindex en todo /agro/app/, también en rutas internas', async ({ page }) => {
  for (const ruta of [APP, `${APP}una/ruta/interna`]) {
    await page.goto(ruta);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  }
});

test('CA1: abierta una vez, carga completa sin señal en menos de 3 s con CPU ×4', {
  tag: '@rendimiento',
}, async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'La emulación de CPU usa el protocolo de Chromium');
  await abrirControlada(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await context.setOffline(true);
  const inicio = Date.now();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu finca');
  await expect(
    page.getByText(/^CultivoPro · Cuaderno de campo · versión \d+\.\d+\.\d+ · Cómo se usa$/),
  ).toBeVisible();
  const ms = Date.now() - inicio;
  expect(ms, `carga sin señal: ${ms} ms`).toBeLessThan(3000);
  await context.setOffline(false);
});

test('CA3: ninguna respuesta de /api/*, ni de error ni buena, queda en la caché', async ({
  page,
  context,
}) => {
  await abrirControlada(page);
  const estados = await page.evaluate(async () => {
    const error = await fetch('/api/prueba?estado=500');
    const bien = await fetch('/api/prueba?estado=200');
    return [error.status, bien.status];
  });
  expect(estados).toEqual([500, 200]);
  const enCache = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const nombre of await caches.keys()) {
      const cache = await caches.open(nombre);
      urls.push(...(await cache.keys()).map((r) => r.url));
    }
    return urls;
  });
  expect(enCache.length, 'el shell sí está en caché').toBeGreaterThan(0);
  expect(enCache.filter((u) => u.includes('/api/'))).toEqual([]);
  // Sin red, /api/* falla de verdad: no hay una copia vieja respondiendo por la celda (P7).
  await context.setOffline(true);
  const sinRed = await page.evaluate(() =>
    fetch('/api/prueba?estado=200').then(
      () => 'respondió',
      () => 'falló',
    ),
  );
  expect(sinRed).toBe('falló');
  await context.setOffline(false);
});

test('CA2: sin formularios abiertos, la versión nueva se ofrece y la app no se recarga sola', async ({
  page,
}) => {
  await abrirControlada(page);
  await configurarFincaMinima(page);
  await page.evaluate(() => Object.assign(window, { marcaDeSesion: 'sigue-aqui' }));
  // Versión nueva: el servidor de pruebas sirve el mismo sw.js con un byte distinto.
  // (context.route no ve la petición con la que el navegador busca un sw.js nuevo; P17.)
  expect((await page.request.post('/__prueba/version-nueva')).status()).toBe(204);
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
  const aviso = page.locator('[data-prueba="aviso-actualizacion"]');
  await expect(aviso).toContainText('Hay una versión nueva del cuaderno');
  // Sin tocar nada, la página sigue siendo la misma: no hubo recarga.
  expect(await page.evaluate(() => (window as { marcaDeSesion?: string }).marcaDeSesion)).toBe(
    'sigue-aqui',
  );
  // Tocar «Actualizar ahora» sí recarga: se espera esa navegación como estado, no con un tiempo.
  const recarga = page.waitForEvent('framenavigated', (f) => f === page.mainFrame());
  await page.getByRole('button', { name: 'Actualizar ahora' }).click();
  await recarga;
  await page.waitForLoadState('load');
  expect(
    await page.evaluate(() => (window as { marcaDeSesion?: string }).marcaDeSesion),
  ).toBeUndefined();
  await expect(aviso).toHaveCount(0);
});

test('CA2: con un formulario abierto la versión nueva solo avisa, y el botón llega al terminar', async ({
  page,
}) => {
  // El asistente de la finca (HU-E3.3) es un formulario abierto mientras se ve.
  await abrirControlada(page);
  expect((await page.request.post('/__prueba/version-nueva')).status()).toBe(204);
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
  const aviso = page.locator('[data-prueba="aviso-actualizacion"]');
  await expect(aviso).toContainText('podrás aplicarla cuando termines');
  await expect(page.getByRole('button', { name: 'Actualizar ahora' })).toHaveCount(0);
  // Terminar el asistente cierra el formulario: ahora sí se ofrece.
  await configurarFincaMinima(page);
  await expect(page.getByRole('button', { name: 'Actualizar ahora' })).toBeVisible();
});
