/**
 * Calculadora de carencia y reentrada (HU-E10.1) en un teléfono de 360 px, con el teléfono en
 * Tokio y el reloj fijo: las fechas son las de Colombia (P8). Se esperan estados, no tiempos (P19).
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCA_ENSAYO_UNO, type FincaDePrueba } from '../fixtures/fincas.ts';
import { agregarInsumo, configurar, ROL } from './ayudas.ts';

const PAGINA = '/herramientas/agro/periodo-de-carencia/';
/** 10/12/2026 a las 7:00 en Colombia; en Tokio ya son las 21:00. */
const AHORA = new Date('2026-12-10T12:00:00Z');

const TRES_DIAS: FincaDePrueba['insumos'][number] = {
  nombre_comercial: 'Producto Tres Días',
  tipo: 'fitosanitario',
  registro_ica: 'REG-ENSAYO-0099',
  ingrediente_activo: 'Sustancia de ensayo',
  unidad: 'mL',
  carencia_dias: 3,
  reentrada_horas: 12,
  permitido_ecologico: true,
};

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

test('HU-E10.2 · CA2: «Guardar como aplicación en mi cuaderno» lleva la fecha y la hora, sin red, y la carencia cuenta desde ahí', async ({
  page,
  context,
}) => {
  const f = FINCA_ENSAYO_UNO;
  const area = f.areas[0];
  const p = f.personas[0];
  if (!area || !p) throw new Error('faltan datos de la finca de prueba');
  // Se anota el 11/12 a las 20:00 en Colombia; la aplicación fue el 10/12 a las 7:00.
  await page.clock.setFixedTime(new Date('2026-12-12T01:00:00Z'));
  await configurar(page, f);
  await page.goto('/agro/app/personas/');
  await page.getByRole('button', { name: 'Agregar persona' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(p.nombre);
  await page.getByRole('radio', { name: ROL[p.rol], exact: true }).check();
  await page.getByRole('button', { name: 'Guardar persona' }).click();
  await page.goto('/agro/app/insumos/');
  await agregarInsumo(page, TRES_DIAS);

  await page.goto(PAGINA);
  await expect(
    page.locator('section:has(#titulo-calculadora) astro-island:not([ssr])'),
  ).toHaveCount(1);
  await page.getByLabel('Fecha de la aplicación').fill('2026-12-10');
  await page.getByLabel('Hora de la aplicación').fill('07:00');
  await page.getByLabel('Carencia de la etiqueta').fill('3');
  await context.setOffline(true);
  // El navegador ya usa el cuaderno: el botón dice «Guardar».
  await page.getByRole('link', { name: 'Guardar como aplicación en mi cuaderno' }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Aplicaciones' })).toBeVisible();
  const cuando = page.locator('[data-prueba="aplicacion-cuando"]');
  await expect(cuando.getByLabel('Fecha')).toHaveValue('2026-12-10');
  await expect(cuando.getByLabel('Hora')).toHaveValue('07:00');
  // El fragmento no se queda en la dirección.
  expect(new URL(page.url()).hash).toBe('');
  const form = page.locator('[data-prueba="formulario-aplicacion"]');
  await form.getByLabel(area.nombre, { exact: true }).check();
  await page
    .getByLabel('Insumo', { exact: true })
    .selectOption({ label: TRES_DIAS.nombre_comercial });
  await page.getByLabel('Cantidad', { exact: true }).fill('2');
  await page.getByLabel(/^Unidad, como en la etiqueta/).fill('cm³ por litro');
  await form.getByLabel(p.nombre, { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar aplicación' }).click();
  // Desde el 10/12, no desde el 11/12 en que se anotó (sería «hasta el 14/12»).
  await expect(page.locator('[data-prueba="aplicacion-guardada"]')).toContainText(
    'No cosechar hasta el 13/12 (Producto Tres Días)',
  );
});
