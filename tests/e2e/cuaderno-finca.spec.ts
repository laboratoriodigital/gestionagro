/**
 * Configurar la finca y sus áreas (HU-E3.3) en un teléfono de 360 px, con las dos fincas de
 * prueba (P4, CA5). Cada prueba arranca con un teléfono sin datos (contexto nuevo).
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { FINCA_ENSAYO_UNO, FINCAS_DE_PRUEBA } from '../fixtures/fincas.ts';
import { abrirSinCuenta, configurar, conPlan, irASeccion } from './ayudas.ts';

test('CA2: nombre, municipio y régimen arrancan vacíos, y vacíos no avanzan', async ({ page }) => {
  await abrirSinCuenta(page);
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
  await abrirSinCuenta(page);
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
        'Cama 1 · 25,5 m²',
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
  await abrirSinCuenta(page);
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
      { tipo: 'nave', nombre: 'Norte', area_m2: 600 },
      { tipo: 'lote', nombre: 'Lote 1', area_m2: 1500 },
    ]);
    const areas = page.locator('[data-prueba="area"]');
    await expect(areas.filter({ hasText: 'Norte · Nave · 600 m²' })).toHaveCount(1);
    // Si el nombre ya dice el tipo, no se repite (revisión de diseño, 3 oct 2026).
    await expect(areas.filter({ hasText: 'Lote 1 · 1.500 m²' })).toHaveCount(1);
    await expect(areas.filter({ hasText: 'Lote 1 · Lote' })).toHaveCount(0);
  });

  test('un área sin tipo no avanza y lo dice junto al campo', async ({ page }) => {
    await abrirSinCuenta(page);
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
    // Dos, para que la tercera quepa en el plan Gratis (HU-E0.13).
    const dosAreas = f.areas.slice(0, 2);
    await configurar(page, f, dosAreas);
    await page.getByRole('button', { name: 'Agregar área' }).click();
    await page.getByLabel('Tipo').selectOption({ label: 'Bloque' });
    await page.getByLabel('Nombre', { exact: true }).fill('Bloque Nuevo');
    await page.getByLabel('Tamaño (m²)').fill('800');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('[data-prueba="area"]')).toHaveCount(dosAreas.length + 1);
    await expect(
      page.locator('[data-prueba="area"]').filter({ hasText: 'Bloque Nuevo · 800 m²' }),
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
    await expect(cama).toContainText('Cama 1 norte · 30 m²');
    await page.getByRole('button', { name: 'Historial de Cama 1 norte' }).click();
    await expect(page.locator('[data-prueba="historial"]')).toContainText(
      'Versión 1: Cama 1 · 25 m²',
    );
  });
});

test('revisión del dueño: con muchas áreas se pliegan; se abren una a una o todas a la vez', async ({
  page,
}) => {
  const f = FINCA_ENSAYO_UNO;
  const naves = Array.from({ length: 3 }, (_, i) => ({
    tipo: 'nave' as const,
    nombre: `Nave ${i + 1}`,
    area_m2: 600,
  }));
  await configurar(page, f, naves);
  // Las otras cuatro, con el plan Finca: el Gratis deja tres (HU-E0.13).
  await conPlan(page, 'finca');
  await page.reload();
  for (let n = 4; n <= 7; n++) {
    await page.getByRole('button', { name: 'Agregar área' }).click();
    await page.getByLabel('Tipo').selectOption({ label: 'Nave' });
    await page.getByLabel('Nombre', { exact: true }).fill(`Nave ${n}`);
    await page.getByLabel('Tamaño (m²)').fill('600');
    await page.getByRole('button', { name: 'Guardar' }).click();
    // Guardada antes de seguir: recargar a mitad de la escritura la perdería.
    await expect(page.locator('[data-prueba="area"]')).toHaveCount(n);
  }
  // Al volver a abrir la pantalla, con siete áreas, arrancan plegadas.
  await page.reload();
  const area = (n: number) =>
    page
      .locator('[data-prueba="area"]')
      .filter({ has: page.locator('summary', { hasText: new RegExp(`^Nave ${n} `) }) });
  const detalles = page.locator('[data-prueba="area"] details');
  await expect(detalles).toHaveCount(7);
  // Más de 6: arrancan cerradas, con el resumen a la vista.
  await expect(page.locator('[data-prueba="area"] details[open]')).toHaveCount(0);
  await expect(area(3).locator('summary')).toContainText('Nave 3 · 600 m²');
  // Una sola, por su cuenta.
  await area(3).locator('summary').click();
  await expect(page.locator('[data-prueba="area"] details[open]')).toHaveCount(1);
  await expect(
    area(3)
      .getByRole('button', { name: /Editar/ })
      .first(),
  ).toBeVisible();
  // Todas a la vez, y otra vez cerradas.
  await page.getByRole('button', { name: 'Abrir todas las áreas' }).click();
  await expect(page.locator('[data-prueba="area"] details[open]')).toHaveCount(7);
  await area(5).locator('summary').click();
  await expect(page.locator('[data-prueba="area"] details[open]')).toHaveCount(6);
  await page.getByRole('button', { name: 'Cerrar todas las áreas' }).click();
  await expect(page.locator('[data-prueba="area"] details[open]')).toHaveCount(0);
});

test('revisión del dueño: un área nueva sin nada asociado se elimina; una con registros dice por qué no', async ({
  page,
}) => {
  const f = FINCA_ENSAYO_UNO;
  const primera = f.areas[0]?.nombre ?? '';
  const dosAreas = f.areas.slice(0, 2);
  await configurar(page, f, dosAreas);
  await page.getByRole('button', { name: 'Agregar área' }).click();
  await page.getByLabel('Tipo').selectOption({ label: 'Bloque' });
  await page.getByLabel('Nombre', { exact: true }).fill('Bloque Nuevo');
  await page.getByLabel('Tamaño (m²)').fill('800');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('[data-prueba="area"]')).toHaveCount(dosAreas.length + 1);

  await page.getByRole('button', { name: 'Eliminar Bloque Nuevo' }).click();
  const aviso = page.locator('[data-prueba="eliminar-area"]');
  await expect(aviso).toContainText('¿Eliminar «Bloque Nuevo»?');
  await aviso.getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page.locator('[data-prueba="area"]')).toHaveCount(dosAreas.length);
  await expect(page.getByText('Bloque Nuevo')).toHaveCount(0);

  // Con un registro, no: dice por qué.
  await irASeccion(page, 'Registrar');
  await page.getByLabel('Área', { exact: true }).selectOption({ label: primera });
  await page.getByLabel('Temperatura del aire (°C)').fill('24');
  await page.getByLabel('Humedad relativa (%)').fill('70');
  await page.getByRole('button', { name: 'Guardar clima' }).click();
  await expect(page.getByText('Guardado en este teléfono.')).toBeVisible();
  await irASeccion(page, 'Áreas');
  await page.getByRole('button', { name: `Eliminar ${primera}` }).click();
  await expect(page.locator('[data-prueba="eliminar-area"]')).toContainText(
    `No se puede eliminar «${primera}»: tiene 1 registro`,
  );
  await expect(page.getByRole('button', { name: 'Sí, eliminar' })).toHaveCount(0);
});

test('HU-E0.13: en el plan Gratis caben 3 áreas; las camas no cuentan y con el plan Finca hay más', async ({
  page,
}) => {
  const f = FINCA_ENSAYO_UNO;
  await abrirSinCuenta(page);
  await page.getByLabel('Nombre de la finca').fill(f.finca.nombre);
  await page.getByLabel('Municipio').fill(f.finca.municipio);
  await page.getByLabel('Ecológico').check();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  for (let i = 1; i < 3; i++) await page.getByRole('button', { name: 'Agregar otra área' }).click();
  // La tercera fila ya es el tope: no se ofrece otra y lo dice.
  await expect(page.getByRole('button', { name: 'Agregar otra área' })).toHaveCount(0);
  await expect(page.locator('[data-prueba="tope-del-plan"]')).toContainText(
    'Con el plan Gratis caben 3 áreas.',
  );

  await configurar(page, f);
  await expect(page.getByRole('button', { name: 'Agregar área' })).toHaveCount(0);
  const aviso = page.locator('[data-prueba="tope-del-plan"]');
  await expect(aviso).toContainText('Con el plan Gratis caben 3 áreas en la finca.');
  await expect(aviso.getByRole('link', { name: 'Ver los planes' })).toHaveAttribute(
    'href',
    '/agro/app/planes/',
  );
  // Las camas de cada área sí se agregan.
  await expect(
    page.getByRole('button', { name: `Agregar cama o surco en ${f.areas[0]?.nombre}` }),
  ).toBeVisible();

  await conPlan(page, 'finca');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Agregar área' })).toBeVisible();
  await expect(page.locator('[data-prueba="tope-del-plan"]')).toHaveCount(0);
});
