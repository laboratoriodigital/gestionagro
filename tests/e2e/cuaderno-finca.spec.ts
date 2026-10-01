/**
 * Configurar la finca y sus áreas (HU-E3.3) en un teléfono de 360 px, con las dos fincas de
 * prueba (P4, CA5). Cada prueba arranca con un teléfono sin datos (contexto nuevo).
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA } from '../fixtures/fincas.ts';
import { APP, configurar } from './ayudas.ts';

test('CA2: nombre, municipio y régimen arrancan vacíos, y vacíos no avanzan', async ({ page }) => {
  await page.goto(APP);
  await expect(page.getByLabel('Nombre de la finca')).toHaveValue('');
  await expect(page.getByLabel('Municipio')).toHaveValue('');
  await expect(page.getByLabel('Ecológico')).not.toBeChecked();
  await expect(page.getByLabel('Convencional')).not.toBeChecked();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu finca');
  await expect(page.getByText('Escribe el nombre de la finca.')).toBeVisible();
  await expect(page.getByText('Escribe el municipio.')).toBeVisible();
  await expect(page.getByText('Elige cómo produces.')).toBeVisible();
  await expect(page.getByLabel('Nombre de la finca')).toHaveAttribute('aria-invalid', 'true');
});

test('un tamaño ilegible no avanza y lo dice junto al campo', async ({ page }) => {
  await page.goto(APP);
  await page.getByLabel('Nombre de la finca').fill('Finca Ensayo Uno');
  await page.getByLabel('Municipio').fill('Municipio Ensayo A');
  await page.getByLabel('Ecológico').check();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Tipo').selectOption({ label: 'Nave' });
  await page.getByLabel('Nombre', { exact: true }).fill('Nave 1');
  await page.getByLabel('Tamaño (m²)').fill('6,,00');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tus áreas');
  await expect(page.getByText(/No es un número válido/)).toBeVisible();
});

for (const f of FINCAS_DE_PRUEBA) {
  test.describe(f.finca.nombre, () => {
    test('CA1 y CA5: el asistente crea la finca y todas sus áreas, y quedan al recargar', async ({
      page,
    }) => {
      await configurar(page, f);
      const areas = page.locator('[data-prueba="area"]');
      await expect(areas).toHaveCount(f.areas.length);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(f.finca.nombre);
      await expect(areas).toHaveCount(f.areas.length);
      for (const a of f.areas) await expect(areas.filter({ hasText: a.nombre })).toHaveCount(1);
    });

    test('CA3: un área puede tener camas o surcos', async ({ page }) => {
      await configurar(page, f);
      const primera = f.areas[0]?.nombre ?? '';
      await page.getByRole('button', { name: `Agregar cama o surco en ${primera}` }).click();
      await page.getByLabel('Cama', { exact: true }).check();
      await page.getByLabel('Nombre', { exact: true }).fill('Cama 1');
      await page.getByLabel('Tamaño (m²)').fill('25,5');
      await page.getByRole('button', { name: 'Guardar' }).click();
      await expect(page.getByRole('list', { name: `Camas y surcos de ${primera}` })).toContainText(
        'Cama 1 · Cama · 25,5 m²',
      );
    });

    test('CA4: editar un área crea una versión nueva y deja historial', async ({ page }) => {
      await configurar(page, f);
      const a = f.areas[0];
      if (!a) throw new Error('la finca de prueba no trae áreas');
      await page.getByRole('button', { name: `Editar ${a.nombre}` }).click();
      await page.getByLabel('Tamaño (m²)').fill(String(a.area_m2 + 50));
      await page.getByRole('button', { name: 'Guardar' }).click();
      const area = page.locator('[data-prueba="area"]').filter({ hasText: a.nombre });
      await expect(area).toContainText(`${(a.area_m2 + 50).toLocaleString('es-CO')} m²`);
      await page.getByRole('button', { name: `Historial de ${a.nombre}` }).click();
      await expect(page.locator('[data-prueba="historial"] li')).toHaveCount(1);
      await expect(page.locator('[data-prueba="historial"]')).toContainText(
        `Versión 1: ${a.nombre} · ${a.area_m2.toLocaleString('es-CO')} m²`,
      );
    });
  });
}

test('el asistente y la finca cumplen WCAG 2.1 AA', async ({ page }) => {
  await page.goto(APP);
  const revisar = async () => {
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  };
  await revisar();
  const f = FINCAS_DE_PRUEBA[0];
  if (!f) throw new Error('faltan fincas de prueba');
  await configurar(page, f);
  await revisar();
});

test.describe('ajustes de la revisión del dueño (1 oct 2026)', () => {
  const f = FINCAS_DE_PRUEBA[0];
  if (!f) throw new Error('faltan fincas de prueba');

  test('cada área tiene su tipo: una finca puede tener naves y lotes', async ({ page }) => {
    await configurar(page, f, [
      { tipo: 'nave', nombre: 'Nave 1', area_m2: 600 },
      { tipo: 'lote', nombre: 'Lote 1', area_m2: 1500 },
    ]);
    const areas = page.locator('[data-prueba="area"]');
    await expect(areas.filter({ hasText: 'Nave 1 · Nave' })).toHaveCount(1);
    await expect(areas.filter({ hasText: 'Lote 1 · Lote' })).toHaveCount(1);
  });

  test('un área sin tipo no avanza y lo dice junto al campo', async ({ page }) => {
    await page.goto(APP);
    await page.getByLabel('Nombre de la finca').fill(f.finca.nombre);
    await page.getByLabel('Municipio').fill(f.finca.municipio);
    await page.getByLabel('Ecológico').check();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('Nave 1');
    await page.getByLabel('Tamaño (m²)').fill('600');
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tus áreas');
    await expect(page.getByText('Elige si es nave, bloque o lote.')).toBeVisible();
  });

  test('después del registro inicial se agregan más áreas, de cualquier tipo', async ({ page }) => {
    await configurar(page, f);
    await page.getByRole('button', { name: 'Agregar área' }).click();
    await page.getByLabel('Tipo').selectOption({ label: 'Bloque' });
    await page.getByLabel('Nombre', { exact: true }).fill('Bloque Nuevo');
    await page.getByLabel('Tamaño (m²)').fill('800');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('[data-prueba="area"]')).toHaveCount(f.areas.length + 1);
    await expect(
      page.locator('[data-prueba="area"]').filter({ hasText: 'Bloque Nuevo · Bloque · 800 m²' }),
    ).toHaveCount(1);
  });

  test('una cama se edita y deja historial, igual que un área', async ({ page }) => {
    await configurar(page, f);
    const primera = f.areas[0]?.nombre ?? '';
    await page.getByRole('button', { name: `Agregar cama o surco en ${primera}` }).click();
    await page.getByLabel('Cama', { exact: true }).check();
    await page.getByLabel('Nombre', { exact: true }).fill('Cama 1');
    await page.getByLabel('Tamaño (m²)').fill('25');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.getByRole('button', { name: 'Editar Cama 1' }).click();
    await expect(page.getByLabel('Tamaño (m²)')).toHaveValue('25');
    await page.getByLabel('Nombre', { exact: true }).fill('Cama 1 norte');
    await page.getByLabel('Tamaño (m²)').fill('30');
    await page.getByRole('button', { name: 'Guardar' }).click();
    const cama = page.locator('[data-prueba="subarea"]').filter({ hasText: 'Cama 1 norte' });
    await expect(cama).toContainText('Cama 1 norte · Cama · 30 m²');
    await page.getByRole('button', { name: 'Historial de Cama 1 norte' }).click();
    await expect(page.locator('[data-prueba="historial"]')).toContainText(
      'Versión 1: Cama 1 · 25 m²',
    );
  });
});
