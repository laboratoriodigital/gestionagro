/**
 * Cosecha (HU-E6.1) en un teléfono de 360 px, con las dos fincas de prueba (P4).
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { agregarInsumo, configurar, ROL } from './ayudas.ts';

/** 10/12/2026 a las 9:30 en Bogotá. */
const APLICADO = new Date('2026-12-10T14:30:00Z');

const nav = (page: Page) => page.getByRole('navigation', { name: 'Secciones del cuaderno' });
const form = (page: Page) => page.locator('[data-prueba="formulario-cosecha"]');

async function agregarPersona(page: Page, f: FincaDePrueba) {
  const p = f.personas[0];
  if (!p) throw new Error('sin personas');
  await nav(page).getByRole('link', { name: 'Personas' }).click();
  await page.getByRole('button', { name: 'Agregar persona' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(p.nombre);
  await page.getByRole('radio', { name: ROL[p.rol], exact: true }).check();
  await page.getByRole('button', { name: 'Guardar persona' }).click();
  return p.nombre;
}

async function abrirCosecha(page: Page) {
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Cosecha', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Cosecha' })).toBeVisible();
}

async function llenar(page: Page, area: string) {
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area });
  await page.getByLabel('Cantidad cosechada').fill('120,5');
  await form(page).getByLabel('kg', { exact: true }).check();
  await form(page).getByLabel('Primera', { exact: true }).check();
  await page.getByLabel('Descarte, en la misma unidad (opcional)').fill('4');
}

for (const f of FINCAS_DE_PRUEBA) {
  test.describe(f.finca.nombre, () => {
    test('CA1 y CA3: kilos, calidad y descarte por área, en modo tablero y sin señal', async ({
      page,
      context,
    }) => {
      const area = f.areas[0]?.nombre ?? '';
      await configurar(page, f);
      const persona = await agregarPersona(page, f);
      await abrirCosecha(page);
      await context.setOffline(true);
      await llenar(page, area);
      await expect(page.locator('[data-prueba="cosecha-bloqueo"]')).toHaveCount(0);
      await form(page).getByLabel(persona, { exact: true }).check();
      await page.getByRole('button', { name: 'Guardar cosecha' }).click();
      await expect(page.getByText('Cosecha guardada en este teléfono.')).toBeVisible();
      const r = page.locator('[data-prueba="registro-cosecha"]');
      await expect(r).toContainText(`${area}`);
      await expect(r).toContainText('Cosecha · 120,5 kg · Primera · descarte 4');
      await expect(r).toContainText('Solo en este teléfono');
      await context.setOffline(false);
    });
  });
}

test('CA2: dentro de la carencia bloquea con motivo y fecha; confirmado, queda anotado en el registro', async ({
  page,
}) => {
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
  const area = f.areas[0]?.nombre ?? '';
  await page.clock.setFixedTime(APLICADO);
  await configurar(page, f);
  const persona = await agregarPersona(page, f);
  await nav(page).getByRole('link', { name: 'Insumos' }).click();
  await agregarInsumo(page, {
    nombre_comercial: 'Producto Tres Días',
    tipo: 'fitosanitario',
    registro_ica: null,
    ingrediente_activo: null,
    unidad: 'mL',
    carencia_dias: 3,
    reentrada_horas: 4,
    permitido_ecologico: true,
  });
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Aplicaciones', exact: true }).click();
  const aplicacion = page.locator('[data-prueba="formulario-aplicacion"]');
  await aplicacion.getByLabel(area, { exact: true }).check();
  await page.getByLabel('Insumo', { exact: true }).selectOption({ label: 'Producto Tres Días' });
  await page.getByLabel('Cantidad').fill('2');
  await page.getByLabel(/^Unidad, como en la etiqueta/).fill('cm³ por litro');
  await aplicacion.getByLabel(persona, { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar aplicación' }).click();
  await expect(page.locator('[data-prueba="aplicacion-guardada"]')).toBeVisible();

  // Dos días después, todavía en carencia.
  await page.clock.setFixedTime(new Date('2026-12-12T15:00:00Z'));
  await page.reload();
  await abrirCosecha(page);
  await llenar(page, area);
  const bloqueo = page.locator('[data-prueba="cosecha-bloqueo"]');
  await expect(bloqueo).toContainText(
    'En carencia hasta el 13/12 por Producto Tres Días: no se debe cosechar.',
  );
  await page.getByRole('button', { name: 'Guardar cosecha' }).click();
  await expect(bloqueo).toContainText('Marca la casilla para guardar');
  await expect(page.locator('[data-prueba="registro-cosecha"]')).toHaveCount(0);

  await bloqueo.getByLabel('Cosechar de todas formas: quedará anotado en el registro').check();
  await page.getByRole('button', { name: 'Guardar cosecha' }).click();
  await expect(
    page.getByText('Cosecha guardada en este teléfono, con la carencia anotada.'),
  ).toBeVisible();
  await expect(page.locator('[data-prueba="registro-cosecha"]')).toContainText(
    'Cosecha · 120,5 kg · Primera · descarte 4 · cosechada en carencia',
  );

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
