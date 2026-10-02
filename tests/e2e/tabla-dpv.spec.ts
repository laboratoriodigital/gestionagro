/**
 * Tabla de DPV imprimible (HU-E2.3) en un teléfono de 360 px: el PDF se arma en el navegador, en
 * una hoja, y el generador solo baja al pedirlo.
 */
import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

const DPV = '/herramientas/agro/calculadora-dpv/';

test('CA1 y CA3: descarga una tabla de una hoja carta horizontal, armada sin servidor', async ({
  page,
}) => {
  const pedidos: string[] = [];
  page.on('request', (r) => pedidos.push(r.url()));
  await page.goto(DPV);
  const seccion = page.locator('section:has(#titulo-tabla)');
  await seccion.scrollIntoViewIfNeeded();
  await expect(seccion.locator('astro-island:not([ssr])')).toHaveCount(1);
  // El generador del PDF no baja con la página.
  expect(pedidos.some((u) => u.includes('tabla-dpv-pdf'))).toBe(false);
  await expect(seccion.getByRole('status')).toHaveText(
    '12 temperaturas × 12 humedades, en una hoja horizontal.',
  );

  const antes = pedidos.length;
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    seccion.getByRole('button', { name: 'Descargar tabla en PDF' }).click(),
  ]);
  expect(descarga.suggestedFilename()).toBe('tabla-dpv-tomate-produccion.pdf');
  // Solo bajó el generador: ningún pedido a una API.
  expect(pedidos.slice(antes).filter((u) => !u.includes('/_astro/'))).toEqual([]);
  const doc = await PDFDocument.load(readFileSync(await descarga.path()));
  expect(doc.getPageCount()).toBe(1);
  const { width, height } = doc.getPage(0).getSize();
  expect([Math.round(width), Math.round(height)]).toEqual([792, 612]);
  await expect(seccion.getByRole('status')).toContainText('la tabla quedó en tus descargas');
});

test('un rango que no cabe se marca junto al campo y no deja descargar', async ({ page }) => {
  await page.goto(DPV);
  const seccion = page.locator('section:has(#titulo-tabla)');
  await seccion.scrollIntoViewIfNeeded();
  await expect(seccion.locator('astro-island:not([ssr])')).toHaveCount(1);
  await seccion.getByLabel('Desde').first().fill('0');
  await seccion.getByLabel('Hasta').first().fill('50');
  await expect(seccion.locator('#tabla-tMax-error')).toContainText('Caben hasta 16 temperaturas');
  await expect(seccion.getByRole('button', { name: 'Descargar tabla en PDF' })).toBeDisabled();
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
