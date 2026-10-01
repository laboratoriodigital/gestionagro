/**
 * Ciclo de cultivo (HU-E3.4) en un teléfono de 360 px, con las dos fincas de prueba (P4).
 * El reloj del navegador se fija en el 15/01/2027, 10:00 en Bogotá (P8).
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { configurar } from './ayudas.ts';

const HOY = new Date('2027-01-15T15:00:00Z');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(HOY);
});

async function iniciarConCultivoNuevo(page: Page, f: FincaDePrueba, area: string) {
  await page.getByRole('button', { name: `Iniciar ciclo en ${area}` }).click();
  await page.getByLabel('Cultivo', { exact: true }).selectOption({ label: 'Otro cultivo…' });
  await page.getByLabel('Nombre del cultivo').fill(f.cultivo.nombre);
  await page.getByLabel('Nombre de la variedad').fill(f.cultivo.variedad);
  await page.getByLabel('Fecha de trasplante').fill('2026-10-15');
  await page.getByLabel('Número de plantas (opcional)').fill('1500');
  await page.getByRole('button', { name: 'Iniciar ciclo', exact: true }).click();
}

const cicloDe = (page: Page, area: string) =>
  page.locator('[data-prueba="area"]').filter({ hasText: area }).locator('[data-prueba="ciclo"]');

for (const f of FINCAS_DE_PRUEBA) {
  test.describe(f.finca.nombre, () => {
    const [primera, segunda] = f.areas.map((a) => a.nombre);
    if (!primera || !segunda) throw new Error('la finca de prueba necesita dos áreas');

    test('CA1 y CA4: inicia un ciclo y muestra los días desde el trasplante', async ({ page }) => {
      await configurar(page, f);
      await expect(cicloDe(page, primera)).toContainText('Sin ciclo activo.');
      await iniciarConCultivoNuevo(page, f, primera);
      const ciclo = cicloDe(page, primera);
      await expect(ciclo).toContainText(`${f.cultivo.nombre} · ${f.cultivo.variedad}`);
      await expect(ciclo).toContainText('trasplante 15/10/2026');
      await expect(ciclo.locator('[data-prueba="dias"]')).toHaveText('día 92');
      await expect(ciclo).toContainText('1.500 plantas');
      await page.reload();
      await expect(cicloDe(page, primera).locator('[data-prueba="dias"]')).toHaveText('día 92');
    });

    test('CA2: el cultivo queda en el catálogo y se le agrega otra variedad sin código', async ({
      page,
    }) => {
      await configurar(page, f);
      await iniciarConCultivoNuevo(page, f, primera);
      await page.getByRole('button', { name: `Iniciar ciclo en ${segunda}` }).click();
      await page.getByLabel('Cultivo', { exact: true }).selectOption({ label: f.cultivo.nombre });
      await expect(page.getByLabel('Variedad', { exact: true }).locator('option')).toContainText([
        f.cultivo.variedad,
      ]);
      await page.getByLabel('Variedad', { exact: true }).selectOption({ label: 'Otra variedad…' });
      await page.getByLabel('Nombre de la variedad').fill('Variedad Ensayo Nueva');
      await page.getByLabel('Fecha de trasplante').fill('2026-12-01');
      await page.getByRole('button', { name: 'Iniciar ciclo', exact: true }).click();
      await expect(cicloDe(page, segunda)).toContainText(
        `${f.cultivo.nombre} · Variedad Ensayo Nueva`,
      );
      await expect(cicloDe(page, segunda).locator('[data-prueba="dias"]')).toHaveText('día 45');
    });

    test('CA3: cerrar pide fecha y confirmación, y deja el área sin ciclo', async ({ page }) => {
      await configurar(page, f);
      await iniciarConCultivoNuevo(page, f, primera);
      await page.getByRole('button', { name: `Cerrar ciclo de ${primera}` }).click();
      await page.getByRole('button', { name: 'Cerrar ciclo', exact: true }).click();
      await expect(page.getByText('Escribe la fecha de fin.')).toBeVisible();
      await expect(page.getByText('Confirma que el ciclo terminó.')).toBeVisible();
      await page.getByLabel('Fecha de fin').fill('2027-01-10');
      await page.getByLabel(/Entiendo que después no se podrán agregar registros/).check();
      await page.getByRole('button', { name: 'Cerrar ciclo', exact: true }).click();
      await expect(cicloDe(page, primera)).toContainText('Sin ciclo activo.');
    });
  });
}

test('un trasplante en el futuro no se acepta, y el formulario cumple WCAG 2.1 AA', async ({
  page,
}) => {
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
  await configurar(page, f);
  const area = f.areas[0]?.nombre ?? '';
  await page.getByRole('button', { name: `Iniciar ciclo en ${area}` }).click();
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  await page.getByLabel('Cultivo', { exact: true }).selectOption({ label: 'Otro cultivo…' });
  await page.getByLabel('Nombre del cultivo').fill(f.cultivo.nombre);
  await page.getByLabel('Nombre de la variedad').fill(f.cultivo.variedad);
  await page.getByLabel('Fecha de trasplante').fill('2027-01-16');
  await page.getByRole('button', { name: 'Iniciar ciclo', exact: true }).click();
  await expect(page.getByText('La fecha de trasplante no puede ser después de hoy.')).toBeVisible();
  await expect(page.locator('[data-prueba="dias"]')).toHaveCount(0);
});
