/**
 * Calculadora de DPV (HU-E2.2) en un teléfono de 360 px. Se esperan estados, no tiempos (P19).
 */
import { expect, type Page, test } from '@playwright/test';

const DPV = '/herramientas/agro/calculadora-dpv/';

async function abrir(page: Page) {
  await page.goto(DPV);
  // La isla está lista cuando Astro la hidrata.
  await expect(page.locator('astro-island:not([ssr])')).toHaveCount(1);
}

const aire = (page: Page) => page.locator('[data-prueba="dpv-aire"]');

test('CA1: 24 °C y 70 % muestran «0,90 kPa» sin tocar un botón', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('Temperatura del aire').fill('24');
  await page.getByLabel('Humedad relativa').fill('70');
  await expect(aire(page)).toHaveText('0,90 kPa');
  await expect(page.getByRole('button')).toHaveCount(0);
});

test('CA2: tomate en producción dice «En rango» y cita la fuente; fuera de rango sugiere una acción', async ({
  page,
}) => {
  await abrir(page);
  await page.getByLabel('Cultivo y etapa').selectOption('tomate:produccion');
  await page.getByLabel('Temperatura del aire').fill('24');
  await page.getByLabel('Humedad relativa').fill('80');
  const indicacion = page.locator('[data-prueba="indicacion"]');
  await expect(indicacion).toContainText('En rango');
  await expect(indicacion).toContainText('Shamshiri');
  await page.getByLabel('Humedad relativa').fill('40');
  await page.getByLabel('Temperatura del aire').fill('30');
  await expect(indicacion).toContainText('Alto');
  await expect(indicacion).toContainText('Nebuliza');
});

test('CA3: acepta «24,5» y «24.5»; rechaza «24,,5» junto al campo sin calcular', async ({
  page,
}) => {
  await abrir(page);
  const t = page.getByLabel('Temperatura del aire');
  await page.getByLabel('Humedad relativa').fill('70');
  await t.fill('24,5');
  await expect(aire(page)).toHaveText('0,92 kPa');
  await t.fill('24.5');
  await expect(aire(page)).toHaveText('0,92 kPa');
  await t.fill('24,,5');
  await expect(t).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#temperatura-error')).toContainText('No es un número válido');
  await expect(aire(page)).toHaveCount(0);
});

test('CA4: la opción avanzada calcula el DPV de hoja', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('Temperatura del aire').fill('26');
  await page.getByLabel('Humedad relativa').fill('60');
  await page.getByText('Opción avanzada: temperatura de la hoja').click();
  await page.getByLabel('Temperatura de la hoja').fill('24');
  await expect(page.locator('[data-prueba="dpv-hoja"]')).toHaveText('DPV de la hoja: 0,97 kPa');
});

// Con la red apagada, Playwright no reporta las solicitudes que la página intenta (P17): contar
// solicitudes sin conexión daba 0 aunque la isla hiciera fetch. Se cuentan con la red encendida.
test('CA5: calcular no hace ninguna solicitud', async ({ page }) => {
  await abrir(page);
  const solicitudes: string[] = [];
  page.on('request', (r) => solicitudes.push(r.url()));
  await page.getByLabel('Temperatura del aire').fill('22');
  await page.getByLabel('Humedad relativa').fill('85');
  await expect(aire(page)).toHaveText('0,40 kPa');
  await page.getByLabel('Cultivo y etapa').selectOption('tomate:produccion');
  await expect(page.locator('[data-prueba="indicacion"]')).toBeVisible();
  expect(solicitudes).toEqual([]);
});

test('CA5: con la página abierta, calcula sin conexión', async ({ page, context }) => {
  await abrir(page);
  await context.setOffline(true);
  await page.getByLabel('Temperatura del aire').fill('22');
  await page.getByLabel('Humedad relativa').fill('85');
  await expect(aire(page)).toHaveText('0,40 kPa');
  await context.setOffline(false);
});

test('CA6: tool.completed se registra una sola vez', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('Temperatura del aire').fill('24');
  await page.getByLabel('Humedad relativa').fill('70');
  await expect(aire(page)).toHaveText('0,90 kPa');
  await page.getByLabel('Humedad relativa').fill('60');
  await expect(aire(page)).not.toHaveText('0,90 kPa');
  const pendientes = await page.evaluate(() =>
    (window as unknown as { agroEventos: { pendientes: () => unknown } }).agroEventos.pendientes(),
  );
  expect(pendientes).toEqual({ 'tool.opened': 1, 'tool.completed': 1 });
});
