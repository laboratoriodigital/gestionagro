/**
 * Rendimiento por nave y por planta (HU-E6.6) en un teléfono de 360 px, con las dos fincas de
 * prueba (P4), y por operario (HU-E7.4). El cálculo con casos está en agro-calc y en el almacén;
 * aquí, la pantalla.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA } from '../fixtures/fincas.ts';
import { configurar, conPlan, irASeccion, ROL } from './ayudas.ts';

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
    await irASeccion(page, 'Registrar');
    await page.getByRole('button', { name: 'Cosecha', exact: true }).click();
    await page.getByLabel('Área', { exact: true }).selectOption({ label: area.nombre });
    await page.getByLabel('Cantidad cosechada').fill(String(cosechado));
    const form = page.locator('[data-prueba="formulario-cosecha"]');
    await form.getByLabel('kg', { exact: true }).check();
    await form.getByLabel('Primera', { exact: true }).check();
    await page.getByLabel('Descarte, en la misma unidad (opcional)').fill(String(cosechado / 10));
    await page.getByRole('button', { name: 'Guardar cosecha' }).click();
    await expect(page.getByText('Cosecha guardada en este teléfono.')).toBeVisible();

    await irASeccion(page, 'Rendimiento');
    const tabla = page.locator('[data-prueba="rendimiento-tabla"]');
    const fila = tabla.locator('[data-prueba="rendimiento-fila"]');
    await expect(fila).toHaveCount(1);
    await expect(fila.locator('th')).toContainText(f.cultivo.nombre);
    // Comercial = 2 por m² × 0,9 = 1,8 por m²; por planta = comercial / 1.000.
    await expect(fila.locator('td').nth(0)).toHaveText('1,8 kg/m²');
    const porPlanta = ((cosechado * 0.9) / 1000).toLocaleString('es-CO', {
      maximumFractionDigits: 3,
    });
    await expect(fila.locator('td').nth(1)).toHaveText(`${porPlanta} kg`);
    await expect(fila.locator('td').nth(2)).toHaveText('10 %');
    await expect(fila.locator('td').nth(3)).toHaveText(
      `${(cosechado * 0.9).toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`,
    );
    // Filtros (revisión del dueño, 3 oct 2026): por cultivo, por área y por estado del ciclo.
    await tabla.getByLabel('Cultivo').selectOption(f.cultivo.nombre);
    await expect(fila).toHaveCount(1);
    await tabla.getByLabel('Área').fill('no existe');
    await expect(fila).toHaveCount(0);
    await expect(tabla).toContainText('Nada con estos filtros.');
    await tabla.getByLabel('Área').fill(area.nombre);
    await expect(fila).toHaveCount(1);
    await tabla.getByLabel('Ciclo').selectOption('cerrado');
    await expect(fila).toHaveCount(0);
    await tabla.getByLabel('Ciclo').selectOption('activo');
    await expect(fila).toHaveCount(1);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

const FINCA = FINCAS_DE_PRUEBA[0];

async function cosechar(
  page: Page,
  area: string,
  cantidad: string,
  persona: string,
  horas: string,
) {
  await irASeccion(page, 'Registrar');
  await page.getByRole('button', { name: 'Cosecha', exact: true }).click();
  const form = page.locator('[data-prueba="formulario-cosecha"]');
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area });
  await page.getByLabel('Cantidad cosechada').fill(cantidad);
  await form.getByLabel('kg', { exact: true }).check();
  await form.getByLabel('Primera', { exact: true }).check();
  // Las horas aparecen solo al elegir quién cosechó.
  await expect(form.getByLabel(/^Horas que cosechó cada persona/)).toHaveCount(0);
  await form.getByLabel(persona, { exact: true }).check();
  if (horas) await form.getByLabel(/^Horas que cosechó cada persona/).fill(horas);
  await page.getByRole('button', { name: 'Guardar cosecha' }).click();
  await expect(page.getByText('Cosecha guardada en este teléfono.')).toBeVisible();
}

async function prepararConPersona(page: Page, plan: string, rol = 'propietario') {
  const f = FINCA;
  const area = f?.areas[0];
  const p = f?.personas[0];
  if (!f || !area || !p) throw new Error('faltan datos de la finca de prueba');
  await configurar(page, f);
  await conPlan(page, plan, rol);
  await irASeccion(page, 'Personas');
  await page.getByRole('button', { name: 'Agregar persona' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(p.nombre);
  await page.getByRole('radio', { name: ROL[p.rol], exact: true }).check();
  await page.getByRole('button', { name: 'Guardar persona' }).click();
  return { area: area.nombre, persona: p.nombre };
}

test('HU-E7.4 · CA1 y CA3: con el plan Exportador, kg por hora de cada persona y las cosechas que no entran', async ({
  page,
}) => {
  const { area, persona } = await prepararConPersona(page, 'exportador');
  await cosechar(page, area, '60', persona, '4');
  await cosechar(page, area, '500', persona, '');
  await irASeccion(page, 'Rendimiento');
  const seccion = page.locator('[data-prueba="rendimiento-por-persona"]');
  const fila = seccion.locator('[data-prueba="fila-persona"]');
  await expect(fila).toHaveCount(1);
  await expect(fila).toContainText(persona);
  // La cosecha sin horas no baja el promedio: 60 kg en 4 h.
  await expect(fila).toContainText('15 kg/h · 60 kg en 4 h');
  await expect(seccion.locator('[data-prueba="cosechas-fuera"]')).toHaveText(
    'No entran al cálculo: 1 cosecha sin horas.',
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('HU-E7.4: con el plan Finca dice que viene con el plan Exportador', async ({ page }) => {
  await prepararConPersona(page, 'finca');
  await irASeccion(page, 'Rendimiento');
  await expect(page.locator('[data-prueba="rendimiento-persona-plan"]')).toContainText(
    'viene con el plan Exportador',
  );
  await expect(page.locator('[data-prueba="tabla-por-persona"]')).toHaveCount(0);
});

test('HU-E7.4 · CA2: un operario no ve el rendimiento por persona', async ({ page }) => {
  if (!FINCA) throw new Error('falta la finca de prueba');
  await configurar(page, FINCA);
  await conPlan(page, 'exportador', 'operario');
  await irASeccion(page, 'Rendimiento');
  await expect(page.getByRole('heading', { level: 1, name: 'Rendimiento' })).toBeVisible();
  await expect(page.locator('[data-prueba="rendimiento-por-persona"]')).toHaveCount(0);
});
