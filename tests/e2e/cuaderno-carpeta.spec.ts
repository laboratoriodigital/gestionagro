/**
 * Carpeta de cumplimiento en PDF (HU-E9.2) en un teléfono de 360 px: del plan Finca, armada en el
 * teléfono, y sin señal una vez descargado su generador.
 */
import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { FINCA_ENSAYO_UNO } from '../fixtures/fincas.ts';
import { configurar, conPlan, irASeccion } from './ayudas.ts';

async function cosechar(page: Page, area: string) {
  await irASeccion(page, 'Registrar');
  await page.getByRole('button', { name: 'Cosecha', exact: true }).click();
  const form = page.locator('[data-prueba="formulario-cosecha"]');
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area });
  await page.getByLabel('Cantidad cosechada').fill('40');
  await form.getByLabel('kg', { exact: true }).check();
  await form.getByLabel('Primera', { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar cosecha' }).click();
  await expect(page.getByText('Cosecha guardada en este teléfono.')).toBeVisible();
}

async function descargarCarpeta(page: Page) {
  const carpeta = page.locator('[data-prueba="carpeta-cumplimiento"]');
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    carpeta.getByRole('button', { name: 'Descargar carpeta en PDF' }).click(),
  ]);
  return descarga;
}

test('con el plan gratuito, la carpeta dice que viene con el plan Finca y no baja el generador', async ({
  page,
}) => {
  const pedidos: string[] = [];
  page.on('request', (r) => pedidos.push(r.url()));
  await configurar(page, FINCA_ENSAYO_UNO);
  await irASeccion(page, 'Respaldo');
  await expect(page.locator('[data-prueba="carpeta-plan"]')).toContainText(
    'viene con el plan Finca',
  );
  await expect(page.getByRole('button', { name: 'Descargar carpeta en PDF' })).toHaveCount(0);
  expect(pedidos.some((u) => u.includes('carpeta-pdf'))).toBe(false);
});

test('CA1 y CA2: con el plan Finca, el PDF sale del teléfono; después funciona sin señal', async ({
  page,
  context,
}) => {
  const area = FINCA_ENSAYO_UNO.areas[0]?.nombre ?? '';
  const pedidos: string[] = [];
  page.on('request', (r) => pedidos.push(r.url()));
  await configurar(page, FINCA_ENSAYO_UNO);
  await conPlan(page, 'finca');
  // Como en la vida real: la app ya se había abierto antes y su service worker la controla.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await cosechar(page, area);
  await irASeccion(page, 'Respaldo');
  const carpeta = page.locator('[data-prueba="carpeta-cumplimiento"]');
  await expect(carpeta).toContainText('no certifica el cumplimiento de ninguna norma');
  // Abrir la carpeta con el plan Finca trae el generador por adelantado.
  await expect.poll(() => pedidos.some((u) => u.includes('carpeta-pdf'))).toBe(true);

  const descarga = await descargarCarpeta(page);
  expect(descarga.suggestedFilename()).toMatch(
    /^carpeta-finca-ensayo-uno-\d{4}-\d{2}-\d{2}-a-\d{4}-\d{2}-\d{2}\.pdf$/,
  );
  const pdf = await PDFDocument.load(readFileSync(await descarga.path()));
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  expect(pdf.getTitle()).toBe(`Registros de ${FINCA_ENSAYO_UNO.finca.nombre}`);
  await expect(carpeta.getByRole('status')).toHaveText('Listo: la carpeta quedó en tus descargas.');

  // Sin señal y con la app recargada: el generador sale de la caché del teléfono.
  await context.setOffline(true);
  await page.reload();
  await irASeccion(page, 'Respaldo');
  const otra = await descargarCarpeta(page);
  expect((await PDFDocument.load(readFileSync(await otra.path()))).getPageCount()).toBeGreaterThan(
    0,
  );
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('un operario no ve la carpeta', async ({ page }) => {
  await configurar(page, FINCA_ENSAYO_UNO);
  await conPlan(page, 'finca', 'operario');
  await irASeccion(page, 'Respaldo');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[data-prueba="carpeta-cumplimiento"]')).toHaveCount(0);
});
