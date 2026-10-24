/**
 * El menú según haya finca o no (pedido del dueño, 5 oct 2026): Rendimiento y Costos aparecen
 * solo cuando la finca existe. Y Costos sin finca dice qué hacer, en vez de quedarse en
 * «Abriendo tu cuaderno…». Desde HU-E0.11 el menú completo vive en «Más», y la barra de abajo
 * lleva Inicio, Carencias, Anotar, Historial y Más.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { APP, abrirSinCuenta, barra, configurar, irASeccion } from './ayudas.ts';

const todas = (page: Page) => page.getByRole('navigation', { name: 'Todas las secciones' });
const SOLO_CON_FINCA = ['Rendimiento', 'Costos'];

test('HU-E0.11 · la barra de abajo lleva Inicio, Carencias, Anotar, Historial y Más', async ({
  page,
}) => {
  await abrirSinCuenta(page);
  await expect(barra(page).getByRole('link')).toHaveText([
    'Inicio',
    'Carencias',
    'Historial',
    'Más',
  ]);
  await expect(barra(page).getByRole('button', { name: 'Anotar' })).toBeVisible();
});

test('sin finca «Más» no ofrece Rendimiento ni Costos; al crearla aparecen', async ({ page }) => {
  await abrirSinCuenta(page);
  await irASeccion(page, 'Más');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Más');
  for (const nombre of SOLO_CON_FINCA) {
    await expect(todas(page).getByRole('link', { name: nombre, exact: true })).toHaveCount(0);
  }
  // Lo que sí sirve sin finca sigue en el menú: restaurar un respaldo o entrar a una cuenta.
  await expect(todas(page).getByRole('link', { name: 'Respaldo', exact: true })).toBeVisible();
  await expect(todas(page).getByRole('link', { name: 'Cuenta', exact: true })).toBeVisible();

  await configurar(page, FINCAS_DE_PRUEBA[0] as FincaDePrueba);
  await irASeccion(page, 'Más');
  for (const nombre of SOLO_CON_FINCA) {
    await expect(todas(page).getByRole('link', { name: nombre, exact: true })).toHaveCount(1);
  }
});

test('HU-E0.11 · con la finca, Inicio dice qué se puede cosechar hoy y lo último anotado', async ({
  page,
}) => {
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
  await configurar(page, f);
  const hoy = page.locator('[data-prueba="hoy"]');
  await expect(hoy.getByRole('heading', { level: 1 })).toHaveText(f.finca.nombre);
  await expect(page.locator('[data-prueba="hoy-resumen"]')).toContainText(
    /Hoy puedes cosechar en (todas tus naves|\d+ naves?)\./,
  );
  const naves = page.locator('[data-prueba="hoy-naves"] li');
  await expect(naves).toHaveCount(f.areas.length);
  await expect(naves.first()).toContainText('Se puede cosechar');
  // Las áreas siguen abajo, con todo lo que se hacía con ellas.
  await expect(page.locator('[data-prueba="area"]')).toHaveCount(f.areas.length);
});

test('HU-E0.11 · «Anotar» abre la hoja y lleva a Registrar con el formulario elegido', async ({
  page,
}) => {
  await configurar(page, FINCAS_DE_PRUEBA[0] as FincaDePrueba);
  await barra(page).getByRole('button', { name: 'Anotar' }).click();
  const hoja = page.getByRole('dialog', { name: '¿Qué vas a anotar?' });
  await expect(hoja).toBeVisible();
  await expect(hoja.getByRole('button')).toHaveCount(7);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  await hoja.getByRole('button', { name: 'Riego', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Registrar');
  await expect(page.getByRole('button', { name: 'Riego', pressed: true })).toBeVisible();
  await expect(hoja).toBeHidden();
  // Desde Registrar, pedir otro tipo cambia el formulario sin salir.
  await barra(page).getByRole('button', { name: 'Anotar' }).click();
  await hoja.getByRole('button', { name: 'Cosecha', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cosecha', pressed: true })).toBeVisible();
});

for (const [ruta, titulo] of [
  ['costos', 'Costos'],
  ['rendimiento', 'Rendimiento'],
] as const) {
  test(`${titulo} por enlace directo, sin finca, dice qué hacer y no se queda «Abriendo»`, async ({
    page,
  }) => {
    await page.goto(`${APP}${ruta}/`);
    await expect(page.getByText('Primero configura tu finca')).toBeVisible();
    await expect(page.getByText('Abriendo tu cuaderno…')).toHaveCount(0);
  });
}
