/**
 * Registro de labores (HU-E3.9) en un teléfono de 360 px, con las dos fincas de prueba (P4).
 * Se esperan estados, no tiempos (P19).
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { configurar, ROL } from './ayudas.ts';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-15T15:00:00Z'));
});

async function configurarConPersonas(page: Page, f: FincaDePrueba) {
  await configurar(page, f);
  const nav = page.getByRole('navigation', { name: 'Secciones del cuaderno' });
  await nav.getByRole('link', { name: 'Personas' }).click();
  for (const p of f.personas) {
    await page.getByRole('button', { name: 'Agregar persona' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill(p.nombre);
    await page.getByRole('radio', { name: ROL[p.rol], exact: true }).check();
    await page.getByRole('button', { name: 'Guardar persona' }).click();
  }
  await expect(page.locator('[data-prueba="personas-activas"] li')).toHaveCount(f.personas.length);
  await nav.getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Labores', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Labores' })).toBeVisible();
}

const form = (page: Page) => page.locator('[data-prueba="formulario-labor"]');
const opcionesDeLabor = (page: Page) =>
  form(page).getByRole('group', { name: 'Labor', exact: true }).getByRole('radio');

for (const f of FINCAS_DE_PRUEBA) {
  test.describe(f.finca.nombre, () => {
    test('CA1, CA2 y CA4: labor nueva con varias personas, sin señal; la usada va primero', async ({
      page,
      context,
    }) => {
      const area = f.areas[0]?.nombre ?? '';
      await configurarConPersonas(page, f);
      await context.setOffline(true);
      await page.getByLabel('Área', { exact: true }).selectOption({ label: area });
      await form(page).getByLabel('Otra labor…').check();
      await page.getByLabel('Nombre de la labor').fill('Amarre de ensayo');
      for (const p of f.personas) await form(page).getByLabel(p.nombre, { exact: true }).check();
      await page.getByLabel('Horas por persona').fill('1,5');
      await page.getByRole('button', { name: 'Guardar labor' }).click();
      await expect(
        page.getByText(`Labor de ${f.personas.length} personas guardada en este teléfono.`),
      ).toBeVisible();
      const labor = page.locator('[data-prueba="registro-labor"]');
      await expect(labor).toHaveCount(1);
      await expect(labor).toContainText(
        `Labor · Amarre de ensayo · 1,5 h por persona · ${f.personas.map((p) => p.nombre).join(', ')}`,
      );
      await expect(labor).toContainText('Solo en este teléfono');
      // CA1 y CA4: entró al catálogo y, como es la más reciente, va primero.
      await expect(opcionesDeLabor(page).first()).toHaveAccessibleName('Amarre de ensayo');
      await context.setOffline(false);
    });
  });
}

test('CA3: 1,3 horas no; más de 12 h en el día pide confirmar y luego guarda', async ({ page }) => {
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
  const persona = f.personas[0]?.nombre ?? '';
  await configurarConPersonas(page, f);
  await page.getByLabel('Área', { exact: true }).selectOption({ label: f.areas[0]?.nombre ?? '' });
  await form(page).getByLabel('Tutorado').check();
  await form(page).getByLabel(persona, { exact: true }).check();
  await page.getByLabel('Horas por persona').fill('1,3');
  await page.getByRole('button', { name: 'Guardar labor' }).click();
  await expect(page.locator('#labor-horas-error')).toContainText('medias horas');
  await expect(page.locator('[data-prueba="registro-labor"]')).toHaveCount(0);

  await page.getByLabel('Horas por persona').fill('8');
  await page.getByRole('button', { name: 'Guardar labor' }).click();
  await expect(page.getByText('Labor guardada en este teléfono.')).toBeVisible();

  await form(page).getByLabel('Poda').check();
  await form(page).getByLabel(persona, { exact: true }).check();
  await page.getByLabel('Horas por persona').fill('5');
  await page.getByRole('button', { name: 'Guardar labor' }).click();
  const aviso = page.locator('[data-prueba="labor-aviso-horas"]');
  await expect(aviso).toContainText(`${persona} sumaría 13 horas hoy`);
  await expect(page.locator('[data-prueba="registro-labor"]')).toHaveCount(1);
  await aviso.getByLabel('Sí, es correcto: guardar de todas formas').check();
  await page.getByRole('button', { name: 'Guardar labor' }).click();
  await expect(page.locator('[data-prueba="registro-labor"]')).toHaveCount(2);
  await expect(aviso).toHaveCount(0);
});

test('las sugerencias aparecen con el catálogo vacío; cumple WCAG 2.1 AA', async ({ page }) => {
  const f = FINCAS_DE_PRUEBA[1] as FincaDePrueba;
  await configurarConPersonas(page, f);
  await expect(opcionesDeLabor(page)).toHaveCount(6);
  await expect(form(page).getByLabel('Polinización')).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
