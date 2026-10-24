/**
 * Registro de riego (HU-E3.7) en un teléfono de 360 px, con las dos fincas de prueba (P4).
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { configurar, irASeccion } from './ayudas.ts';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-15T15:00:00Z'));
});

async function abrirRiego(page: Page) {
  await irASeccion(page, 'Registrar');
  await page.getByRole('button', { name: 'Riego', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Riego' })).toBeVisible();
}

const form = (page: Page) => page.locator('[data-prueba="formulario-riego"]');

for (const f of FINCAS_DE_PRUEBA) {
  test.describe(f.finca.nombre, () => {
    test('CA1, CA3 y CA4: el mismo riego en todas las áreas, con % de drenaje, sin señal', async ({
      page,
      context,
    }) => {
      await configurar(page, f);
      await abrirRiego(page);
      for (const a of f.areas) await form(page).getByLabel(a.nombre, { exact: true }).check();
      await form(page).getByLabel('mL por gotero').check();
      await page.getByLabel('Volumen aplicado').fill('500');
      await page.getByLabel('Duración del riego en minutos (opcional)').fill('12,5');
      await page.getByLabel('Volumen drenado (opcional)').fill('150');
      await expect(page.locator('[data-prueba="riego-drenaje"]')).toContainText('Drenaje: 30 %');
      await context.setOffline(true);
      await page.getByRole('button', { name: 'Guardar riego' }).click();
      await expect(
        page.getByText(`${f.areas.length} riegos guardados en este teléfono.`),
      ).toBeVisible();
      const riegos = page.locator('[data-prueba="registro-riego"]');
      await expect(riegos).toHaveCount(f.areas.length);
      for (const a of f.areas) {
        await expect(riegos.filter({ hasText: a.nombre })).toContainText(
          'Riego · 500 mL por gotero · 12,5 min · drenaje 30 %',
        );
      }
      await expect(riegos.first()).toContainText('Solo en este teléfono');
      await expect(page.locator('[data-prueba="indicador-datos"]')).toHaveText(
        `${f.areas.length} registros solo en este teléfono`,
      );
      await context.setOffline(false);
    });
  });
}

test('CA2: CE y pH vacíos son «no medidos»; fuera de rango no se guarda y lo dice junto al campo', async ({
  page,
}) => {
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
  const area = f.areas[0]?.nombre ?? '';
  await configurar(page, f);
  await abrirRiego(page);
  await form(page).getByLabel(area, { exact: true }).check();
  await form(page).getByLabel('L por área').check();
  await page.getByLabel('Volumen aplicado').fill('1200');
  await page.getByText('CE y pH (opcional)').click();
  await page.getByLabel('CE de entrada (dS/m)').fill('12');
  await page.getByLabel('pH de drenaje').fill('2');
  await page.getByRole('button', { name: 'Guardar riego' }).click();
  await expect(page.locator('#riego-ce-entrada-error')).toContainText('entre 0 y 10 dS/m');
  await expect(page.locator('#riego-ph-drenaje-error')).toContainText('entre 3 y 10');
  await expect(page.locator('[data-prueba="registro-riego"]')).toHaveCount(0);

  await page.getByLabel('CE de entrada (dS/m)').fill('2,1');
  await page.getByLabel('pH de drenaje').fill('');
  await page.getByRole('button', { name: 'Guardar riego' }).click();
  const riego = page.locator('[data-prueba="registro-riego"]');
  await expect(riego).toContainText('Riego · 1200 L por área · drenaje no medido · CE 2,1 dS/m');
});

test('un drenaje mayor que lo aplicado no se guarda; la unidad se recuerda; cumple WCAG 2.1 AA', async ({
  page,
}) => {
  const f = FINCAS_DE_PRUEBA[1] as FincaDePrueba;
  const area = f.areas[0]?.nombre ?? '';
  await configurar(page, f);
  await abrirRiego(page);
  await form(page).getByLabel(area, { exact: true }).check();
  await form(page).getByLabel('L por área').check();
  await page.getByLabel('Volumen aplicado').fill('500');
  await page.getByLabel('Volumen drenado (opcional)').fill('600');
  await page.getByRole('button', { name: 'Guardar riego' }).click();
  await expect(page.locator('#riego-drenado-error')).toContainText(
    'no puede ser mayor que lo aplicado',
  );
  await page.getByLabel('Volumen drenado (opcional)').fill('100');
  await page.getByRole('button', { name: 'Guardar riego' }).click();
  await expect(page.locator('[data-prueba="registro-riego"]')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'Riego', exact: true }).click();
  await expect(form(page).getByLabel('L por área')).toBeChecked();
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('revisión del dueño: un error en CE o pH no esconde el del drenaje ni el de la duración', async ({
  page,
}) => {
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
  await configurar(page, f);
  await abrirRiego(page);
  await form(page)
    .getByLabel(f.areas[0]?.nombre ?? '', { exact: true })
    .check();
  await form(page).getByLabel('mL por gotero').check();
  await page.getByLabel('Volumen aplicado').fill('500');
  await page.getByLabel('Duración del riego en minutos (opcional)').fill('0');
  await page.getByLabel('Volumen drenado (opcional)').fill('600');
  await page.getByText('CE y pH (opcional)').click();
  await page.getByLabel('CE de entrada (dS/m)').fill('12');
  await page.getByRole('button', { name: 'Guardar riego' }).click();
  await expect(page.locator('#riego-ce-entrada-error')).toContainText('entre 0 y 10 dS/m');
  await expect(page.locator('#riego-drenado-error')).toContainText(
    'no puede ser mayor que lo aplicado',
  );
  await expect(page.locator('#riego-duracion-error')).toContainText('entre 0,1 y 1440 minutos');
  await expect(page.locator('[data-prueba="registro-riego"]')).toHaveCount(0);
});
