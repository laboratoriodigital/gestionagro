/**
 * Lotes de venta (HU-E6.2) en un teléfono de 360 px y sin señal, con las dos fincas de prueba (P4).
 * Que una cosecha no entre en dos lotes se prueba en el almacén (`lotes.test.ts`).
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA } from '../fixtures/fincas.ts';
import { configurar } from './ayudas.ts';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Secciones del cuaderno' });
const form = (page: Page) => page.locator('[data-prueba="formulario-cosecha"]');

async function cosechar(page: Page, area: string, cantidad: string) {
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Cosecha', exact: true }).click();
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area });
  await page.getByLabel('Cantidad cosechada').fill(cantidad);
  await form(page).getByLabel('kg', { exact: true }).check();
  await form(page).getByLabel('Primera', { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar cosecha' }).click();
  await expect(page.getByText('Cosecha guardada en este teléfono.')).toBeVisible();
}

/** `ddmm` de hoy en Colombia: el código del lote usa la fecha de la finca (P8). */
const hoyEnColombia = () => {
  const [, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })
    .format(new Date())
    .split('-');
  return { ddmm: `${d}${m}`, corta: `${d}/${m}` };
};

for (const f of FINCAS_DE_PRUEBA) {
  test(`${f.finca.nombre} · CA1 y CA3: armar un lote sin señal, con código y de dónde viene`, async ({
    page,
    context,
  }) => {
    const [a1, a2] = f.areas;
    if (!a1 || !a2) throw new Error('faltan áreas');
    await configurar(page, f);
    await context.setOffline(true);
    await cosechar(page, a1.nombre, '30,5');
    await cosechar(page, a2.nombre, '12');
    await nav(page).getByRole('link', { name: 'Lotes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Lotes de venta' })).toBeVisible();
    const hoy = hoyEnColombia();
    await page.getByLabel(`${a1.nombre} · ${hoy.corta} · Primera · 30,5 kg`).check();
    await page.getByLabel(`${a2.nombre} · ${hoy.corta} · Primera · 12 kg`).check();
    await expect(page.locator('[data-prueba="total-lote"]')).toHaveText('2 cosechas · 42,5 kg');
    await page.getByRole('button', { name: 'Armar lote' }).click();

    const lote = page.locator('[data-prueba="lote"]');
    await expect(lote).toHaveCount(1);
    // Sin ciclo, el cultivo no se conoce: la inicial es M.
    await expect(lote.locator('.codigo-lote')).toHaveText(`M-${hoy.ddmm}-1`);
    await expect(lote).toContainText('42,5 kg');
    await expect(lote.locator('[data-prueba="origen-lote"]')).toHaveText(
      `De ${a1.nombre} (${hoy.corta}), ${a2.nombre} (${hoy.corta})`,
    );
    await expect(page.getByText('No hay cosechas sin lote.')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // Cambiar las cosechas conserva el código.
    await page
      .getByRole('button', { name: `Cambiar las cosechas del lote M-${hoy.ddmm}-1` })
      .click();
    await page.getByLabel(`${a2.nombre} · ${hoy.corta} · Primera · 12 kg`).uncheck();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(lote.locator('.codigo-lote')).toHaveText(`M-${hoy.ddmm}-1`);
    await expect(lote).toContainText('30,5 kg');
    await expect(page.getByLabel(`${a2.nombre} · ${hoy.corta} · Primera · 12 kg`)).toBeVisible();
  });
}
