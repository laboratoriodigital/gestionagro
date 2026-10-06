/**
 * El menú según haya finca o no (pedido del dueño, 5 oct 2026): Rendimiento y Costos aparecen
 * solo cuando la finca existe. Y Costos sin finca dice qué hacer, en vez de quedarse en
 * «Abriendo tu cuaderno…».
 */
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { APP, configurar } from './ayudas.ts';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Secciones del cuaderno' });
const SOLO_CON_FINCA = ['Rendimiento', 'Costos'];

test('sin finca el menú no ofrece Rendimiento ni Costos; al crearla aparecen sin recargar', async ({
  page,
}) => {
  await page.goto(APP);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu finca');
  for (const nombre of SOLO_CON_FINCA) {
    await expect(nav(page).getByRole('link', { name: nombre, exact: true })).toHaveCount(0);
  }
  // Lo que sí sirve sin finca sigue en el menú: restaurar un respaldo o entrar a una cuenta.
  await expect(nav(page).getByRole('link', { name: 'Respaldo', exact: true })).toBeVisible();
  await expect(nav(page).getByRole('link', { name: 'Cuenta', exact: true })).toBeVisible();

  await configurar(page, FINCAS_DE_PRUEBA[0] as FincaDePrueba);
  for (const nombre of SOLO_CON_FINCA) {
    await expect(nav(page).getByRole('link', { name: nombre, exact: true })).toHaveCount(1);
  }
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
