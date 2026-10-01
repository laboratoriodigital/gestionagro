/**
 * PWA del cuaderno (HU-E3.1) en un teléfono de 360 px. Se esperan estados, no tiempos (P19).
 */
import { expect, type Page, test } from '@playwright/test';

const APP = '/agro/app/';

/** Abre la app y espera a que el service worker la controle (segunda carga). */
async function abrirControlada(page: Page) {
  await page.goto(APP);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu cuaderno de campo');
}

test('CA4: manifest con nombre, íconos, scope, color y display standalone', async ({ page }) => {
  const r = await page.request.get(`${APP}manifest.webmanifest`);
  expect(r.ok()).toBe(true);
  const m = await r.json();
  expect(m).toMatchObject({
    name: 'Cuaderno de campo · Gestión Agro',
    short_name: 'Cuaderno',
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

test('CA1: abierta una vez, carga completa sin señal en menos de 3 s con CPU ×4', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'La emulación de CPU usa el protocolo de Chromium');
  await abrirControlada(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await context.setOffline(true);
  const inicio = Date.now();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu cuaderno de campo');
  await expect(page.getByText(/^Versión \d+\.\d+\.\d+$/)).toBeVisible();
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

test('CA2: una versión nueva se ofrece y la app no se recarga sola', async ({ page, context }) => {
  await abrirControlada(page);
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
