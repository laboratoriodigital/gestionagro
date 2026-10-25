/**
 * Respaldo (HU-E3.13) en un teléfono de 360 px, con las dos fincas de prueba (P4). El «otro
 * teléfono» es un contexto nuevo del navegador: su IndexedDB arranca vacía. Restaurar una copia es
 * del plan Finca (HU-E0.13): el teléfono que restaura tiene esa sesión; descargar sigue gratis.
 */
import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { APP, configurar, conPlan, irASeccion } from './ayudas.ts';

async function registrarClima(page: Page, area: string) {
  await irASeccion(page, 'Registrar');
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area });
  await page.getByLabel('Temperatura del aire (°C)').fill('24,5');
  await page.getByLabel('Humedad relativa (%)').fill('70');
  await page.getByRole('button', { name: 'Guardar clima' }).click();
  await expect(page.getByText('Guardado en este teléfono.')).toBeVisible();
}

async function abrirRespaldo(page: Page) {
  await irASeccion(page, 'Respaldo');
  await expect(page.getByRole('heading', { level: 1, name: 'Respaldo' })).toBeVisible();
}

for (const f of FINCAS_DE_PRUEBA) {
  test.describe(f.finca.nombre, () => {
    test('CA2 y CA3: descargar en un teléfono y restaurar en otro vacío, con el mismo contenido', async ({
      page,
      browser,
    }) => {
      const area = f.areas[0]?.nombre ?? '';
      await configurar(page, f);
      await registrarClima(page, area);
      await abrirRespaldo(page);
      await expect(page.locator('[data-prueba="ultimo-respaldo"]')).toHaveText(
        'Todavía no has descargado un respaldo.',
      );
      const [descarga] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Descargar respaldo completo' }).click(),
      ]);
      expect(descarga.suggestedFilename()).toMatch(
        /^cuaderno-finca-ensayo-(uno|dos)-\d{4}-\d{2}-\d{2}\.json$/,
      );
      const ruta = await descarga.path();
      const archivo = JSON.parse(readFileSync(ruta, 'utf8'));
      expect(archivo).toMatchObject({ formato: 'agro-export', version: 1 });
      expect(archivo.tablas.registro.recuento).toBe(1);
      await expect(page.locator('[data-prueba="ultimo-respaldo"]')).toContainText(
        'Último respaldo:',
      );

      // Otro teléfono, vacío: restaura desde la pantalla de Respaldo, sin configurar nada.
      const origen = new URL(page.url()).origin;
      const otro = await browser.newContext({ viewport: { width: 360, height: 780 } });
      const telefono = await otro.newPage();
      await telefono.goto(`${origen}${APP}respaldo/`);
      // El cuaderno ya abrió su base: escribir la sesión antes la dejaría a medio crear.
      await expect(telefono.getByText('Todavía no hay finca en este teléfono.')).toBeVisible();
      await conPlan(telefono, 'finca');
      await telefono.reload();
      await expect(telefono.getByText('Todavía no hay finca en este teléfono.')).toBeVisible();
      await telefono.getByLabel('Archivo de respaldo (.json)').setInputFiles(ruta);
      const resumen = telefono.locator('[data-prueba="respaldo-resumen"]');
      await expect(resumen.getByRole('row', { name: /^Registros/ })).toHaveText(
        /Registros\s*1\s*0/,
      );
      await expect(resumen.getByRole('row', { name: /^Áreas/ })).toHaveText(
        new RegExp(`Áreas\\s*${f.areas.length}\\s*0`),
      );
      await telefono.getByRole('button', { name: /^Importar \d+ datos nuevos$/ }).click();
      await expect(
        telefono.getByText(/^Importado: 1 registro y \d+ datos de la finca\./),
      ).toBeVisible();
      await telefono.getByRole('link', { name: 'Ver la finca' }).click();
      await expect(telefono.getByRole('heading', { level: 1 })).toHaveText(f.finca.nombre);
      await irASeccion(telefono, 'Historial');
      await expect(telefono.locator('[data-prueba="historial-clima"]')).toContainText(
        'Clima · 24,5 °C · 70 %',
      );

      // Importar otra vez el mismo archivo no duplica nada.
      await irASeccion(telefono, 'Respaldo');
      await telefono.getByLabel('Archivo de respaldo (.json)').setInputFiles(ruta);
      await expect(telefono.getByRole('button', { name: 'No hay nada nuevo' })).toBeDisabled();
      await otro.close();
    });
  });
}

test('HU-E0.13: con el plan Gratis se descarga, pero restaurar lo dice y lleva a los planes', async ({
  page,
}) => {
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
  await configurar(page, f);
  await abrirRespaldo(page);
  await expect(page.getByRole('button', { name: 'Descargar respaldo completo' })).toBeEnabled();
  await expect(page.getByLabel('Archivo de respaldo (.json)')).toHaveCount(0);
  const aviso = page.locator('[data-prueba="tope-del-plan"]');
  await expect(aviso).toContainText(
    'Con el plan Gratis no se puede restaurar una copia en el teléfono: eso viene con el plan Finca.',
  );
  await expect(aviso.getByRole('link', { name: 'Ver los planes' })).toHaveAttribute(
    'href',
    '/agro/app/planes/',
  );
});

test('CA4: el CSV de clima trae BOM, «;» y coma decimal', async ({ page }) => {
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
  await configurar(page, f);
  await registrarClima(page, f.areas[0]?.nombre ?? '');
  await abrirRespaldo(page);
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Clima (CSV)' }).click(),
  ]);
  expect(descarga.suggestedFilename()).toMatch(/^clima-finca-ensayo-uno-\d{4}-\d{2}-\d{2}\.csv$/);
  const bytes = readFileSync(await descarga.path());
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const texto = bytes.toString('utf8');
  expect(texto).toContain('Fecha;Hora;Área;Ciclo;Estado;Temperatura (°C);');
  expect(texto).toMatch(/;vigente;24,5;70;;/);
});

test('P21: un archivo cortado no importa nada y lo dice; la pantalla cumple WCAG 2.1 AA', async ({
  page,
}) => {
  const f = FINCAS_DE_PRUEBA[1] as FincaDePrueba;
  await configurar(page, f);
  await registrarClima(page, f.areas[0]?.nombre ?? '');
  await abrirRespaldo(page);
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar respaldo completo' }).click(),
  ]);
  const texto = readFileSync(await descarga.path(), 'utf8');
  await conPlan(page, 'finca');
  await page.reload();
  await page.getByLabel('Archivo de respaldo (.json)').setInputFiles({
    name: 'cortado.json',
    mimeType: 'application/json',
    buffer: Buffer.from(texto.slice(0, Math.floor(texto.length / 2))),
  });
  await expect(page.locator('[data-prueba="respaldo-errores"]')).toContainText(
    'el archivo no es JSON válido; puede estar cortado',
  );
  await expect(page.locator('[data-prueba="respaldo-resumen"]')).toHaveCount(0);

  await page.getByLabel('Archivo de respaldo (.json)').setInputFiles(await descarga.path());
  await expect(page.locator('[data-prueba="respaldo-resumen"]')).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
