/**
 * «¿Qué puedo cosechar hoy?» (HU-E9.1) en un teléfono de 360 px, con las dos fincas de prueba (P4).
 * El reloj del navegador es fijo y el teléfono está en Tokio: los días son los de la finca (P8).
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { agregarInsumo, configurar, conPlan, ROL } from './ayudas.ts';

/** 10/12/2026 a las 9:30 en Bogotá; en Tokio ya es el 11/12. */
const APLICADO = new Date('2026-12-10T14:30:00Z');

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

const nav = (page: Page) => page.getByRole('navigation', { name: 'Secciones del cuaderno' });
const form = (page: Page) => page.locator('[data-prueba="formulario-aplicacion"]');

test.use({ timezoneId: 'Asia/Tokyo' });

for (const f of FINCAS_DE_PRUEBA) {
  test.describe(f.finca.nombre, () => {
    test('CA1 y CA2: hoy en rojo con el día y la hora en que se puede, verde lo demás y 14 días; cumple WCAG 2.1 AA', async ({
      page,
    }) => {
      await page.clock.setFixedTime(APLICADO);
      const area = f.areas[f.areas.length - 1]?.nombre ?? '';
      const otra = f.areas[0]?.nombre ?? '';
      await configurar(page, f);
      await nav(page).getByRole('link', { name: 'Personas' }).click();
      const p = f.personas[0];
      if (!p) throw new Error('sin personas');
      await page.getByRole('button', { name: 'Agregar persona' }).click();
      await page.getByLabel('Nombre', { exact: true }).fill(p.nombre);
      await page.getByRole('radio', { name: ROL[p.rol], exact: true }).check();
      await page.getByRole('button', { name: 'Guardar persona' }).click();
      await nav(page).getByRole('link', { name: 'Insumos' }).click();
      await agregarInsumo(page, TRES_DIAS);

      await nav(page).getByRole('link', { name: 'Registrar' }).click();
      await page.getByRole('button', { name: 'Aplicaciones', exact: true }).click();
      await form(page).getByLabel(area, { exact: true }).check();
      await page
        .getByLabel('Insumo', { exact: true })
        .selectOption({ label: 'Producto Tres Días' });
      await page.getByLabel('Cantidad').fill('2');
      await page.getByLabel(/^Unidad, como en la etiqueta/).fill('cm³ por litro');
      await form(page).getByLabel(p.nombre, { exact: true }).check();
      await page.getByRole('button', { name: 'Guardar aplicación' }).click();
      await expect(page.locator('[data-prueba="aplicacion-guardada"]')).toBeVisible();

      await nav(page).getByRole('link', { name: 'Carencias' }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('¿Qué puedo cosechar hoy?');
      const hoy = (nombre: string) =>
        page
          .locator('[data-prueba="carencia-hoy"]')
          .filter({ has: page.locator('strong', { hasText: new RegExp(`^${nombre}$`) }) });
      await expect(hoy(area)).toHaveAttribute('data-color', 'rojo');
      await expect(hoy(area)).toContainText('No cosechar');
      await expect(hoy(area)).toContainText('No cosechar hasta el 13/12 (Producto Tres Días)');
      await expect(hoy(area)).toContainText('Reentrada desde 10/12/2026 13:30');
      if (otra !== area) await expect(hoy(otra)).toHaveAttribute('data-color', 'verde');

      const dias = page
        .locator('[data-prueba="carencia-calendario"]')
        .filter({ has: page.getByRole('heading', { level: 3, name: area, exact: true }) })
        .locator('.dia-cosecha');
      await expect(dias).toHaveCount(14);
      // En Tokio ya es el 11, pero el primer día es el 10 de la finca.
      await expect(dias.nth(0)).toContainText('ju 10');
      await expect(dias.nth(0)).toContainText('13:30');
      await expect(dias.nth(2)).toHaveAttribute('data-color', 'rojo');
      await expect(dias.nth(3)).toHaveAttribute('data-color', 'verde');
      await expect(dias.nth(3)).toContainText('do 13');

      // El calendario cabe en 360 px: la página no se desplaza de lado.
      const ancho = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(ancho[0]).toBeLessThanOrEqual(ancho[1] ?? 0);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  });
}

test('el calendario impreso es del plan Finca: una hoja horizontal con cada área y sus 14 días', async ({
  page,
}) => {
  // window.print abre el diálogo del sistema: aquí se reemplaza y se genera el PDF como lo haría.
  await page.addInitScript(() => {
    window.print = () => undefined;
  });
  const f = FINCAS_DE_PRUEBA[0];
  if (!f) throw new Error('falta la finca de prueba');
  await configurar(page, f);
  await nav(page).getByRole('link', { name: 'Carencias' }).click();
  // Gratis: se ve en el teléfono, pero imprimirlo es del plan Finca.
  await expect(page.locator('[data-prueba="imprimible-plan"]')).toContainText(
    'viene con el plan Finca',
  );
  await expect(page.getByRole('button', { name: 'Imprimir el calendario' })).toHaveCount(0);

  await conPlan(page, 'finca');
  await page.reload();
  await page.getByRole('button', { name: 'Imprimir el calendario' }).click();
  const hoja = page.locator('#impresion.hoja');
  await expect(hoja.locator('tbody tr')).toHaveCount(f.areas.length);
  await expect(hoja.locator('thead th')).toHaveCount(2 + 14);
  await expect(hoja).toContainText(`¿Qué se puede cosechar? · ${f.finca.nombre}`);
  await expect(hoja).toContainText('Vuelve a imprimir después de cada aplicación');
  const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
  expect(pdf.match(/\/Type\s*\/Page(?!s)/g) ?? []).toHaveLength(1);
  // Carta horizontal: 11 × 8,5 pulgadas = 792 × 612 puntos PDF.
  const caja = pdf.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
  expect([Math.round(Number(caja?.[1])), Math.round(Number(caja?.[2]))]).toEqual([792, 612]);
});
