/**
 * Registro de clima (HU-E3.8) en un teléfono de 360 px, con las dos fincas de prueba (P4).
 * El reloj del navegador se fija en el 15/01/2027, 10:00 en Bogotá (P8).
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { configurar, irASeccion } from './ayudas.ts';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-15T15:00:00Z'));
});

async function irARegistrar(page: Page) {
  await irASeccion(page, 'Registrar');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Registrar');
}

async function iniciarCiclo(page: Page, f: FincaDePrueba, area: string) {
  await irASeccion(page, 'Áreas');
  await page.getByRole('button', { name: `Iniciar ciclo en ${area}` }).click();
  await page.getByLabel('Cultivo', { exact: true }).selectOption({ label: 'Otro cultivo…' });
  await page.getByLabel('Nombre del cultivo').fill(f.cultivo.nombre);
  await page.getByLabel('Nombre de la variedad').fill(f.cultivo.variedad);
  await page.getByLabel('Fecha de trasplante').fill('2026-10-15');
  await page.getByRole('button', { name: 'Iniciar ciclo', exact: true }).click();
  await expect(page.locator('[data-prueba="dias"]').first()).toHaveText('día 92');
}

const formulario = (page: Page) => page.locator('[data-prueba="formulario-clima"]');

for (const f of FINCAS_DE_PRUEBA) {
  const area = f.areas[0]?.nombre ?? '';

  test.describe(f.finca.nombre, () => {
    test('CA1: ve el DPV al escribir, guarda sin señal y queda «solo en este teléfono»', async ({
      page,
      context,
    }) => {
      await configurar(page, f);
      await irARegistrar(page);
      await formulario(page).getByLabel('Área').selectOption({ label: area });
      await page.getByLabel('Temperatura del aire (°C)').fill('24');
      await page.getByLabel('Humedad relativa (%)').fill('70');
      await expect(page.locator('[data-prueba="clima-dpv"]')).toContainText('DPV: 0,90 kPa');
      await context.setOffline(true);
      await page.getByRole('button', { name: 'Guardar clima' }).click();
      await expect(page.getByText('Guardado en este teléfono.')).toBeVisible();
      const registro = page.locator('[data-prueba="registro-clima"]');
      await expect(registro).toHaveCount(1);
      await expect(registro).toContainText(`${area} · 15/01/2027 10:00`);
      await expect(registro).toContainText('24 °C · 70 % · DPV 0,90 kPa');
      await expect(registro).toContainText('Solo en este teléfono');
      await expect(page.getByLabel('Temperatura del aire (°C)')).toHaveValue('');
      await context.setOffline(false);
    });

    test('CA2: la indicación usa el catálogo de la calculadora y el cultivo del ciclo activo', async ({
      page,
    }) => {
      await configurar(page, f);
      await iniciarCiclo(page, f, area);
      await irARegistrar(page);
      await formulario(page).getByLabel('Área').selectOption({ label: area });
      await page.getByLabel('Temperatura del aire (°C)').fill('24');
      await page.getByLabel('Humedad relativa (%)').fill('70');
      await expect(page.locator('[data-prueba="clima-dpv"]')).toContainText('0,90 kPa');
      // Cada cultivo con su rango del catálogo: 0,90 kPa es «algo alto» para tomate (0,5–0,8) y
      // «en rango» para rosa (0,6–1,0, desde el 3 oct 2026). Un cultivo sin fila no tendría
      // indicación (lo prueba agro-calc).
      await expect(page.locator('[data-prueba="clima-indicacion"]')).toContainText(
        f.cultivo.nombre === 'Tomate' ? 'Algo alto' : 'En rango',
      );
    });
  });
}

test('CA3: llega prellenado desde el enlace de la calculadora', async ({ page }) => {
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
  await configurar(page, f);
  await page.goto('/agro/app/registrar/#t=24&hr=70&th=23');
  await expect(page.getByLabel('Temperatura del aire (°C)')).toHaveValue('24');
  await expect(page.getByLabel('Humedad relativa (%)')).toHaveValue('70');
  await expect(page.getByLabel('Temperatura de la hoja (°C, opcional)')).toHaveValue('23');
  await expect(page).toHaveURL(/\/agro\/app\/registrar\/$/);
});

test('vacío o fuera de rango no se guarda y lo dice junto al campo; cumple WCAG 2.1 AA', async ({
  page,
}) => {
  const f = FINCAS_DE_PRUEBA[1] as FincaDePrueba;
  await configurar(page, f);
  await irARegistrar(page);
  await page.getByRole('button', { name: 'Guardar clima' }).click();
  await expect(page.getByText('Elige el área donde mediste.')).toBeVisible();
  await expect(page.getByText('Escribe la temperatura.')).toBeVisible();
  await formulario(page)
    .getByLabel('Área')
    .selectOption({ label: f.areas[0]?.nombre ?? '' });
  await page.getByLabel('Temperatura del aire (°C)').fill('24');
  await page.getByLabel('Humedad relativa (%)').fill('120');
  await page.getByRole('button', { name: 'Guardar clima' }).click();
  await expect(page.locator('#clima-hr-error')).toContainText(
    'fuera de rango: 120 (se acepta de 0 a 100)',
  );
  await expect(page.locator('[data-prueba="registro-clima"]')).toHaveCount(0);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
