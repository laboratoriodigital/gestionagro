/**
 * Ayudas compartidas por las e2e del cuaderno (una sola copia, P2).
 */
import { expect, type Page } from '@playwright/test';
import type { FincaDePrueba } from '../fixtures/fincas.ts';

export const APP = '/agro/app/';
export const TIPO = { nave: 'Nave', bloque: 'Bloque', lote: 'Lote' } as const;
export const REGIMEN = { ecologico: 'Ecológico', convencional: 'Convencional' } as const;

type AreaDePrueba = Pick<FincaDePrueba['areas'][number], 'tipo' | 'nombre' | 'area_m2'>;

/** Llena las filas del paso «Tus áreas»: cada área con su propio tipo. */
export async function llenarAreas(page: Page, areas: readonly AreaDePrueba[]) {
  for (const [i, a] of areas.entries()) {
    if (i > 0) await page.getByRole('button', { name: 'Agregar otra área' }).click();
    const fila = page.getByRole('group', { name: `Área ${i + 1}`, exact: true });
    await fila.getByLabel('Tipo').selectOption({ label: TIPO[a.tipo as keyof typeof TIPO] });
    await fila.getByLabel('Nombre').fill(a.nombre);
    await fila.getByLabel('Tamaño (m²)').fill(String(a.area_m2));
  }
}

export async function configurar(
  page: Page,
  f: FincaDePrueba,
  areas: readonly AreaDePrueba[] = f.areas,
) {
  await page.goto(APP);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu finca');
  await page.getByLabel('Nombre de la finca').fill(f.finca.nombre);
  await page.getByLabel('Municipio').fill(f.finca.municipio);
  await page.getByLabel(REGIMEN[f.finca.regimen]).check();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tus áreas');
  await llenarAreas(page, areas);
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Revisa y guarda');
  await expect(page.locator('[data-prueba="resumen-areas"] li')).toHaveCount(areas.length);
  await page.getByRole('button', { name: 'Guardar mi finca' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(f.finca.nombre);
}
