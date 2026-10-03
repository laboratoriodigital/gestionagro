/**
 * Planes con precio visible y lista de espera (HU-E0.6) en un teléfono de 360 px. El CORE se
 * reemplaza interceptando la red: ninguna prueba sale a staging.
 */
import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCA_ENSAYO_UNO } from '../fixtures/fincas.ts';
import { configurar, conPlan } from './ayudas.ts';

const { core } = JSON.parse(readFileSync('infrastructure/celdas.json', 'utf8')) as {
  core: { url_staging: string };
};
const CORE = core.url_staging;
const permitir = { 'access-control-allow-origin': '*' };

async function coreConLista(page: Page) {
  const pedidos: unknown[] = [];
  await page.route(`${CORE}/api/core/interes/ver`, (r) =>
    r.fulfill({ json: { planes: [] }, headers: permitir }),
  );
  await page.route(`${CORE}/api/core/interes`, async (r) => {
    const cuerpo = r.request().postDataJSON() as { plan: string };
    pedidos.push(cuerpo);
    await r.fulfill({ json: { plan: cuerpo.plan, nuevo: true }, headers: permitir });
  });
  return pedidos;
}

const plan = (page: Page, id: string) => page.locator(`[data-prueba="plan"][data-plan="${id}"]`);

test('CA2: sin cuenta, los cuatro planes con su precio tentativo, y cómo avisar', async ({
  page,
}) => {
  await configurar(page, FINCA_ENSAYO_UNO);
  await page.goto('/agro/app/planes/');
  await expect(page.locator('[data-prueba="plan"]')).toHaveCount(4);
  await expect(page.locator('[data-prueba="aviso-precio"]')).toContainText(
    'Precio de lanzamiento tentativo',
  );
  await expect(plan(page, 'finca')).toContainText('COP 39.000 a 59.000 al mes');
  await expect(plan(page, 'exportador')).toContainText('COP 149.000 a 249.000 al mes por finca');
  await expect(plan(page, 'gratuito')).toContainText('tu plan');
  await expect(page.getByRole('button', { name: /^Me interesa/ })).toHaveCount(0);
  await expect(page.locator('[data-prueba="planes-sin-cuenta"]')).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('CA1: el propietario toca «Me interesa» y queda anotado en el CORE, sin cobro', async ({
  page,
}) => {
  const pedidos = await coreConLista(page);
  await configurar(page, FINCA_ENSAYO_UNO);
  await conPlan(page, 'finca');
  await page.goto('/agro/app/planes/');
  // Su plan no se ofrece: ya lo tiene.
  await expect(plan(page, 'finca')).toContainText('tu plan');
  await expect(plan(page, 'finca').getByRole('button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Me interesa el plan Exportador' }).click();
  await expect(plan(page, 'exportador').getByRole('status')).toContainText(
    'quedó anotado. Te contaremos antes de que empiece. No se cobra nada.',
  );
  await expect(plan(page, 'exportador').locator('[data-prueba="ya-avisaste"]')).toBeVisible();
  expect(pedidos).toEqual([{ plan: 'exportador' }]);
});

test('solo quien administra la finca avisa: un operario no ve el botón', async ({ page }) => {
  await coreConLista(page);
  await configurar(page, FINCA_ENSAYO_UNO);
  await conPlan(page, 'gratuito', 'operario');
  await page.goto('/agro/app/planes/');
  await expect(page.locator('[data-prueba="plan"]')).toHaveCount(4);
  await expect(page.getByRole('button', { name: /^Me interesa/ })).toHaveCount(0);
  await expect(page.locator('[data-prueba="planes-no-administra"]')).toBeVisible();
});

test('CA4: a Planes se llega por enlaces; registrar no muestra planes ni ventanas', async ({
  page,
}) => {
  await configurar(page, FINCA_ENSAYO_UNO);
  const nav = page.getByRole('navigation', { name: 'Secciones del cuaderno' });
  await expect(nav.getByRole('link', { name: 'Planes' })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Registrar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Registrar' })).toBeVisible();
  await expect(page.locator('a[href*="/planes"]')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Desde el aviso de Costos, sí.
  await nav.getByRole('link', { name: 'Costos' }).click();
  await page
    .locator('[data-prueba="costos-plan"]')
    .getByRole('link', { name: 'Ver los planes' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Planes' })).toBeVisible();
});

test('revisión del dueño: Cuenta dice el plan y las fincas; antes de subir otra finca, pregunta', async ({
  page,
}) => {
  await configurar(page, FINCA_ENSAYO_UNO);
  await conPlan(page, 'exportador');
  await page.goto('/agro/app/cuenta/');
  await expect(page.locator('[data-prueba="cuenta-plan"]')).toContainText(
    'Plan de esta finca: Exportador',
  );
  // La finca de este teléfono no está vinculada a la de la nube: se ofrece abrir esa aparte
  // (HU-E4.7), en vez de decir que ya está aquí.
  const fincas = page.locator('[data-prueba="cuenta-fincas"]');
  await expect(fincas).toContainText('Finca Ensayo · Propietario · plan Exportador');
  await expect(fincas.getByRole('button', { name: 'Abrir en este teléfono' })).toBeVisible();
  // La cuenta ya tiene una finca en la nube: primero se pregunta.
  const pregunta = page.locator('[data-prueba="nube-pregunta"]');
  await expect(pregunta).toContainText('Tu cuenta ya tiene en la nube: Finca Ensayo.');
  await expect(page.getByRole('button', { name: 'Subirla como finca nueva' })).toHaveCount(0);
  await pregunta.getByRole('button', { name: 'Sí, es una de ellas' }).click();
  await expect(page.locator('[data-prueba="nube-misma"]')).toContainText(
    'no puede juntar dos copias de una misma finca',
  );
  await pregunta.getByRole('button', { name: 'No, es otra finca' }).click();
  await expect(page.getByRole('button', { name: 'Subirla como finca nueva' })).toBeVisible();
});
