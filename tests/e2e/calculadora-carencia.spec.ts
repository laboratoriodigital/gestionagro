/**
 * Calculadora de carencia y reentrada (HU-E10.1) en un teléfono de 360 px, con el teléfono en
 * Tokio y el reloj fijo: las fechas son las de Colombia (P8). Se esperan estados, no tiempos (P19).
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const PAGINA = '/herramientas/agro/periodo-de-carencia/';
/** 10/12/2026 a las 7:00 en Colombia; en Tokio ya son las 21:00. */
const AHORA = new Date('2026-12-10T12:00:00Z');

test.use({ timezoneId: 'Asia/Tokyo' });

async function abrir(page: Page) {
  await page.clock.setFixedTime(AHORA);
  await page.goto(PAGINA);
  await expect(page.locator('astro-island:not([ssr])')).toHaveCount(1);
}

test('CA1 y CA4: por defecto ahora en Colombia; 3 días y 12 h dan cosechar desde el 13/12 y entrar desde las 19:00, sin red', async ({
  page,
}) => {
  const pedidos: string[] = [];
  await abrir(page);
  // La fecha y la hora por defecto son las de Colombia, no las de Tokio.
  await expect(page.getByLabel('Fecha de la aplicación')).toHaveValue('2026-12-10');
  await expect(page.getByLabel('Hora de la aplicación')).toHaveValue('07:00');
  page.on('request', (r) => {
    if (!r.url().includes('/api/eventos')) pedidos.push(r.url());
  });
  await page.getByLabel('Carencia de la etiqueta').fill('3');
  await page.getByLabel('Reentrada de la etiqueta').fill('12');
  await expect(page.locator('[data-prueba="cosechar"]')).toHaveText('13/12');
  await expect(page.locator('[data-prueba="entrar"]')).toHaveText('10/12/2026 19:00');
  // Calcular no pide nada a la red (CA4).
  expect(pedidos).toEqual([]);
  await expect(page.getByRole('button')).toHaveCount(0);
  // CA3: el texto permanente.
  await expect(page.locator('[data-prueba="aviso-etiqueta"]')).toHaveText(
    'Copia la carencia y la reentrada de la etiqueta del producto registrado ante el ICA. Esta herramienta solo cuenta los días.',
  );
});

test('CA2: vacío no es cero (dice «desconocida»); 0 escrito sí es el mismo día; lo ilegible se marca sin calcular', async ({
  page,
}) => {
  await abrir(page);
  await page.getByLabel('Carencia de la etiqueta').fill('3');
  await expect(page.locator('[data-prueba="entrar"]')).toContainText('Reentrada desconocida');
  await page.getByLabel('Reentrada de la etiqueta').fill('0');
  await expect(page.locator('[data-prueba="entrar"]')).toHaveText('10/12/2026 07:00');
  await page.getByLabel('Carencia de la etiqueta').fill('-3');
  await expect(page.locator('#carencia-error')).toBeVisible();
  await expect(page.getByLabel('Carencia de la etiqueta')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[data-prueba="cosechar"]')).toHaveCount(0);
});

test('CA4: 28/02/2028 con 1 día da cosechar desde el 29/02', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('Fecha de la aplicación').fill('2028-02-28');
  await page.getByLabel('Carencia de la etiqueta').fill('1');
  await expect(page.locator('[data-prueba="cosechar"]')).toHaveText('29/02');
});

test('la página cumple WCAG 2.1 AA y no se desplaza de lado en 360 px', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('Carencia de la etiqueta').fill('3');
  const ancho = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(ancho[0]).toBeLessThanOrEqual(ancho[1] ?? 0);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
