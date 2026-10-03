/**
 * Registros por cama o surco, del plan Finca (revisión del dueño, 3 oct 2026), en un teléfono de
 * 360 px: aplicar solo en una cama bloquea cosechar su nave entera pero no la cama vecina, y el
 * monitoreo de una cama dice la incidencia en plantas.
 */
import { expect, type Page, test } from '@playwright/test';
import { FINCA_ENSAYO_UNO, type FincaDePrueba } from '../fixtures/fincas.ts';
import { agregarInsumo, configurar, conPlan, ROL } from './ayudas.ts';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Secciones del cuaderno' });

const TRES_DIAS: FincaDePrueba['insumos'][number] = {
  nombre_comercial: 'Producto Tres Días',
  tipo: 'fitosanitario',
  registro_ica: 'REG-ENSAYO-0099',
  ingrediente_activo: 'Sustancia de ensayo',
  unidad: 'mL',
  carencia_dias: 3,
  reentrada_horas: 4,
  permitido_ecologico: true,
};

test('plan Finca: aplicar en una cama bloquea cosechar su nave, no la cama vecina; el monitoreo dice la incidencia', async ({
  page,
}) => {
  const f = FINCA_ENSAYO_UNO;
  const nave = f.areas[0]?.nombre ?? '';
  const p = f.personas[0];
  if (!p) throw new Error('sin personas');
  await configurar(page, f, [{ tipo: 'nave', nombre: nave, area_m2: 600 }]);
  await conPlan(page, 'finca');
  await page.reload();
  for (const n of [1, 2]) {
    await page.getByRole('button', { name: `Agregar cama o surco en ${nave}` }).click();
    await page.getByLabel('Cama', { exact: true }).check();
    await page.getByLabel('Nombre', { exact: true }).fill(`Cama ${n}`);
    await page.getByLabel('Tamaño (m²)').fill('40');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('list', { name: `Camas y surcos de ${nave}` })).toContainText(
      `Cama ${n} · Cama · 40 m²`,
    );
  }
  await nav(page).getByRole('link', { name: 'Personas' }).click();
  await page.getByRole('button', { name: 'Agregar persona' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(p.nombre);
  await page.getByRole('radio', { name: ROL[p.rol], exact: true }).check();
  await page.getByRole('button', { name: 'Guardar persona' }).click();
  await expect(
    page.locator('[data-prueba="personas-activas"] li').filter({ hasText: p.nombre }),
  ).toHaveCount(1);
  await nav(page).getByRole('link', { name: 'Insumos' }).click();
  await agregarInsumo(page, TRES_DIAS);

  // Aplicación solo en la Cama 2.
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Aplicaciones', exact: true }).click();
  const form = page.locator('[data-prueba="formulario-aplicacion"]');
  await form.getByText(`Solo algunas camas de ${nave}`).click();
  await form.getByLabel(`${nave} · Cama 2`, { exact: true }).check();
  await expect(form.getByLabel(nave, { exact: true })).not.toBeChecked();
  await page
    .getByLabel('Insumo', { exact: true })
    .selectOption({ label: TRES_DIAS.nombre_comercial });
  await page.getByLabel('Cantidad', { exact: true }).fill('2');
  await page.getByLabel(/^Unidad, como en la etiqueta/).fill('mL/L');
  await form.getByLabel(p.nombre, { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar aplicación' }).click();
  await expect(page.locator('[data-prueba="aplicacion-guardada"]')).toContainText(
    `${nave} · Cama 2`,
  );

  // Cosechar la nave entera: bloqueado por la Cama 2. La Cama 1, sí.
  await page.getByRole('button', { name: 'Cosecha', exact: true }).click();
  await page.getByLabel('Área', { exact: true }).selectOption({ label: nave });
  await expect(page.locator('[data-prueba="cosecha-bloqueo"]')).toContainText(
    'por Producto Tres Días en Cama 2',
  );
  await page.getByLabel('Cama o surco (opcional)').selectOption({ label: 'Cama 1' });
  await expect(page.locator('[data-prueba="cosecha-bloqueo"]')).toHaveCount(0);
  await page.getByLabel('Cama o surco (opcional)').selectOption({ label: 'Cama 2' });
  await expect(page.locator('[data-prueba="cosecha-bloqueo"]')).toContainText(
    'por Producto Tres Días: no se debe cosechar',
  );

  // Monitoreo de la Cama 1 con plantas revisadas y afectadas.
  await page.getByRole('button', { name: 'Monitoreo', exact: true }).click();
  const mon = page.locator('[data-prueba="formulario-monitoreo"]');
  await mon.getByLabel('Área', { exact: true }).selectOption({ label: nave });
  await mon.getByLabel('Cama o surco (opcional)').selectOption({ label: 'Cama 1' });
  await mon.getByLabel('Qué viste').fill('Mosca blanca');
  await mon.getByLabel('Plaga', { exact: true }).check();
  await mon.getByLabel('Conteo en plantas').check();
  await mon.getByLabel('Plantas revisadas (opcional)').fill('20');
  await mon.getByLabel('Plantas con la plaga o el síntoma (opcional)').fill('3');
  await expect(mon.locator('[data-prueba="monitoreo-incidencia"]')).toHaveText(
    'Incidencia: 15 % de las plantas revisadas.',
  );
  await mon.getByLabel('Medio').check();
  await page.getByRole('button', { name: 'Guardar monitoreo' }).click();
  const registro = page.locator('[data-prueba="registro-monitoreo"]').first();
  await expect(registro).toContainText(`${nave} · Cama 1`);
  await expect(registro).toContainText('3 de 20 plantas (15 %)');
});

test('plan gratuito: sin elegir camas ni plantas', async ({ page }) => {
  await configurar(page, FINCA_ENSAYO_UNO);
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Monitoreo', exact: true }).click();
  await expect(page.locator('[data-prueba="monitoreo-plantas"]')).toHaveCount(0);
  await expect(page.getByLabel('Cama o surco (opcional)')).toHaveCount(0);
});
