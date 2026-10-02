/**
 * Rendimiento por nave y por planta (HU-E6.6) en un teléfono de 360 px, con las dos fincas de
 * prueba (P4). El cálculo con casos está en agro-calc y en el almacén; aquí, la pantalla.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA } from '../fixtures/fincas.ts';
import { configurar } from './ayudas.ts';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Secciones del cuaderno' });

for (const f of FINCAS_DE_PRUEBA) {
  test(`${f.finca.nombre} · CA1 y CA2: por m² y por planta, con lo que se vende`, async ({
    page,
  }) => {
    const area = f.areas[0];
    if (!area) throw new Error('sin áreas');
    await configurar(page, f);
    // Un ciclo con 1.000 plantas en la primera área.
    await page.getByRole('button', { name: `Iniciar ciclo en ${area.nombre}` }).click();
    await page.getByLabel('Cultivo', { exact: true }).selectOption({ label: 'Otro cultivo…' });
    await page.getByLabel('Nombre del cultivo').fill(f.cultivo.nombre);
    await page.getByLabel('Nombre de la variedad').fill(f.cultivo.variedad);
    await page.getByLabel('Fecha de trasplante').fill('2026-09-15');
    await page.getByLabel('Número de plantas (opcional)').fill('1000');
    await page.getByRole('button', { name: 'Iniciar ciclo', exact: true }).click();
    // Una cosecha: el área de prueba con su cantidad y 10 % de descarte.
    const cosechado = area.area_m2 * 2;
    await nav(page).getByRole('link', { name: 'Registrar' }).click();
    await page.getByRole('button', { name: 'Cosecha', exact: true }).click();
    await page.getByLabel('Área', { exact: true }).selectOption({ label: area.nombre });
    await page.getByLabel('Cantidad cosechada').fill(String(cosechado));
    const form = page.locator('[data-prueba="formulario-cosecha"]');
    await form.getByLabel('kg', { exact: true }).check();
    await form.getByLabel('Primera', { exact: true }).check();
    await page.getByLabel('Descarte, en la misma unidad (opcional)').fill(String(cosechado / 10));
    await page.getByRole('button', { name: 'Guardar cosecha' }).click();
    await expect(page.getByText('Cosecha guardada en este teléfono.')).toBeVisible();

    await nav(page).getByRole('link', { name: 'Rendimiento' }).click();
    const grupo = page.locator('[data-prueba="rendimiento-cultivo"]');
    await expect(grupo.getByRole('heading', { level: 2 })).toHaveText(f.cultivo.nombre);
    const fila = grupo.locator('[data-prueba="rendimiento-fila"]');
    await expect(fila).toHaveCount(1);
    // Comercial = 2 por m² × 0,9 = 1,8 por m²; por planta = comercial / 1.000.
    await expect(fila.locator('td').nth(0)).toHaveText('1,8 kg/m²');
    const porPlanta = ((cosechado * 0.9) / 1000).toLocaleString('es-CO', {
      maximumFractionDigits: 3,
    });
    await expect(fila.locator('td').nth(1)).toHaveText(`${porPlanta} kg`);
    await expect(fila.locator('td').nth(2)).toHaveText('10 %');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
