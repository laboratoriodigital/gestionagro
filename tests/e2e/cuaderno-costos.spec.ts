/**
 * Costos de los insumos (HU-E7.1) en un teléfono de 360 px, sin señal. Los costos son del plan
 * Finca (ARQUITECTURA §2.4): con el gratuito, la pantalla dice qué trae el plan.
 */
import { expect, type Page, test } from '@playwright/test';
import { FINCA_ENSAYO_UNO, type FincaDePrueba } from '../fixtures/fincas.ts';
import { agregarInsumo, configurar, conPlan, ROL } from './ayudas.ts';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Secciones del cuaderno' });

const INSUMO: FincaDePrueba['insumos'][number] = {
  nombre_comercial: 'Producto Bodega',
  tipo: 'fitosanitario',
  registro_ica: null,
  ingrediente_activo: null,
  unidad: 'mL',
  carencia_dias: 1,
  reentrada_horas: 1,
  permitido_ecologico: true,
};

test('con el plan gratuito, «Costos» dice qué trae el plan Finca', async ({ page }) => {
  await configurar(page, FINCA_ENSAYO_UNO);
  await nav(page).getByRole('link', { name: 'Costos' }).click();
  await expect(page.locator('[data-prueba="costos-plan"]')).toContainText(
    'Los costos vienen con el plan Finca',
  );
});

test('CA1, CA2 y CA3: compra, aplicación con cantidad, bodega y costo por nave, sin señal', async ({
  page,
  context,
}) => {
  const f = FINCA_ENSAYO_UNO;
  const area = f.areas[0];
  const p = f.personas[0];
  if (!area || !p) throw new Error('faltan datos de la finca de prueba');
  await configurar(page, f);
  await conPlan(page, 'finca');
  await nav(page).getByRole('link', { name: 'Personas' }).click();
  await page.getByRole('button', { name: 'Agregar persona' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(p.nombre);
  await page.getByRole('radio', { name: ROL[p.rol], exact: true }).check();
  await page.getByRole('button', { name: 'Guardar persona' }).click();
  await nav(page).getByRole('link', { name: 'Insumos' }).click();
  await agregarInsumo(page, INSUMO);
  await context.setOffline(true);

  // Compra de 1.000 mL por $ 80.000.
  await nav(page).getByRole('link', { name: 'Costos' }).click();
  const compra = page.locator('[data-prueba="formulario-bodega"]');
  await compra.getByLabel('Insumo').selectOption({ label: 'Producto Bodega (mL)' });
  await compra.getByLabel('Cantidad (mL)').fill('1000');
  await compra.getByLabel('Precio total pagado en pesos (opcional)').fill('80.000');
  await compra.getByRole('button', { name: 'Guardar' }).click();
  await expect(compra.getByRole('status')).toHaveText('Compra guardada en este teléfono.');

  // Aplicación con 2 mL/L en 20 L: la app sugiere 40 mL y se usa.
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Aplicaciones', exact: true }).click();
  const form = page.locator('[data-prueba="formulario-aplicacion"]');
  await form.getByLabel(area.nombre, { exact: true }).check();
  await page.getByLabel('Insumo', { exact: true }).selectOption({ label: INSUMO.nombre_comercial });
  await page.getByLabel('Cantidad', { exact: true }).fill('2');
  await page.getByLabel(/^Unidad, como en la etiqueta/).fill('mL/L');
  await form.getByLabel(p.nombre, { exact: true }).check();
  await form.getByText('Mezcla, equipo y cantidad usada (opcional)').click();
  await form.getByLabel('Litros de mezcla preparados').fill('20');
  await form.getByRole('button', { name: 'Usar 40 mL' }).click();
  await expect(form.getByLabel('Producto gastado en total (mL)')).toHaveValue('40');
  await page.getByRole('button', { name: 'Guardar aplicación' }).click();
  await expect(page.locator('[data-prueba="aplicacion-guardada"]')).toBeVisible();

  await nav(page).getByRole('link', { name: 'Costos' }).click();
  const existencia = page.locator('[data-prueba="existencia"]');
  await expect(existencia).toContainText('Producto Bodega · quedan 960 mL');
  await expect(existencia).toContainText('$ 80 por mL · en bodega $ 76.800');
  await expect(page.locator('[data-prueba="costo-por-area"]')).toContainText(`${area.nombre}`);
  await expect(page.locator('[data-prueba="costo-por-area"]')).toContainText('$ 3.200');
  await expect(page.locator('[data-prueba="aviso-negativa"]')).toHaveCount(0);

  // CA3: un ajuste que deja la bodega en negativo avisa, sin bloquear nada.
  const ajuste = page.locator('[data-prueba="formulario-bodega"]');
  await ajuste.getByLabel('Insumo').selectOption({ label: 'Producto Bodega (mL)' });
  await ajuste.getByLabel('Ajuste por conteo').check();
  await ajuste.getByLabel('Cantidad (mL)').fill('-1000');
  await ajuste.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('[data-prueba="aviso-negativa"]')).toHaveText(
    'Se aplicó más de lo que entró: falta registrar alguna compra o un ajuste.',
  );
});

test('HU-E7.2: con el jornal general, una labor de 4 h cuesta medio jornal en su nave, este mes', async ({
  page,
}) => {
  const f = FINCA_ENSAYO_UNO;
  const area = f.areas[0];
  const p = f.personas[0];
  if (!area || !p) throw new Error('faltan datos de la finca de prueba');
  await configurar(page, f);
  await conPlan(page, 'finca');
  await nav(page).getByRole('link', { name: 'Personas' }).click();
  await page.getByRole('button', { name: 'Agregar persona' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(p.nombre);
  await page.getByRole('radio', { name: ROL[p.rol], exact: true }).check();
  await page.getByRole('button', { name: 'Guardar persona' }).click();

  // El valor general del jornal, desde el primero del año.
  await nav(page).getByRole('link', { name: 'Costos' }).click();
  const jornal = page.locator('[data-prueba="formulario-jornal"]');
  await jornal.getByLabel('Valor del jornal en pesos').fill('64.000');
  await jornal.getByLabel('Rige desde').fill('2026-01-01');
  await jornal.getByRole('button', { name: 'Guardar valor' }).click();
  await expect(jornal.getByRole('status')).toContainText('no cambia lo anterior');
  await expect(page.locator('[data-prueba="valores-jornal"]')).toContainText(
    'General de la finca: $ 64.000',
  );
  await expect(page.locator('[data-prueba="valores-jornal"]')).toContainText(
    `${p.nombre}: el general`,
  );

  // Una labor de 4 horas.
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Labores', exact: true }).click();
  const form = page.locator('[data-prueba="formulario-labor"]');
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area.nombre });
  await form.getByLabel('Tutorado').check();
  await form.getByLabel(p.nombre, { exact: true }).check();
  await page.getByLabel('Horas por persona').fill('4');
  await page.getByRole('button', { name: 'Guardar labor' }).click();

  await nav(page).getByRole('link', { name: 'Costos' }).click();
  const tabla = page.locator('[data-prueba="mano-por-area"]');
  await expect(tabla).toContainText(area.nombre);
  await expect(tabla).toContainText('$ 32.000');
  await expect(page.locator('[data-prueba="mano-de-obra"]')).toContainText(
    'la app no liquida nómina, recargos, horas extra ni prestaciones',
  );
});
