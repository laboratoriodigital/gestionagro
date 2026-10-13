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
  // Revisión del dueño (12 oct 2026): sin cuenta también se comparan los periodos, sin botón de pagar.
  await expect(plan(page, 'finca').locator('[data-prueba="periodo"]')).toHaveCount(4);
  await expect(
    plan(page, 'finca').getByText(/COP 32\.500 al mes · ahorras COP 78\.000/),
  ).toBeVisible();
  await expect(page.locator('[data-prueba="pagar-plan"]')).toHaveCount(0);
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
  // Su plan no se ofrece en la lista de espera: ya lo tiene. Se puede renovar (HU-E0.7).
  await expect(plan(page, 'finca')).toContainText('tu plan');
  await expect(plan(page, 'finca').getByRole('button')).toHaveText(['Renovar un mes · COP 39.000']);
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

test.describe('HU-E0.7 · pagar el plan Finca con Bold', () => {
  const ORDEN = 'agro-0199a1b2-0000-7000-8000-0000000000b0';
  const VENCE = '2026-11-02T15:00:00.000Z';

  /** CORE y Bold falsos: crear el cobro, el checkout que vuelve aprobado, confirmar y renovar. */
  async function nubeDePago(page: Page, estado: 'aprobado' | 'esperando') {
    const creados: unknown[] = [];
    await page.route(`${CORE}/api/core/pago/crear`, async (r) => {
      const cuerpo = r.request().postDataJSON() as { plan: string; vuelta: string };
      creados.push(cuerpo);
      await r.fulfill({
        headers: permitir,
        json: {
          orden: ORDEN,
          pruebas: true,
          libreria: 'https://checkout.bold.co/library/boldPaymentButton.js',
          checkout: {
            orderId: ORDEN,
            currency: 'COP',
            amount: '39000',
            apiKey: 'identidad',
            integritySignature: 'firma',
            description: 'Plan Finca de CultivoPro, un mes',
            redirectionUrl: `${cuerpo.vuelta}?pago=${ORDEN}`,
          },
        },
      });
    });
    // El checkout de Bold: abre y, como el comprador pagó, vuelve a la dirección de vuelta.
    await page.route('https://checkout.bold.co/library/boldPaymentButton.js', (r) =>
      r.fulfill({
        contentType: 'text/javascript',
        body: 'window.BoldCheckout = class { constructor(d) { this.d = d; } open() { location.assign(this.d.redirectionUrl); } };',
      }),
    );
    await page.route(`${CORE}/api/core/pago/confirmar`, (r) =>
      r.fulfill({
        headers: permitir,
        json:
          estado === 'aprobado'
            ? { estado, motivo: null, plan: 'finca', plan_vence: VENCE }
            : {
                estado,
                motivo:
                  'Bold todavía no tiene noticias de este pago. Si ya pagaste, espera unos minutos.',
              },
      }),
    );
    await page.route(`${CORE}/api/core/auth/refrescar`, (r) =>
      r.fulfill({
        headers: permitir,
        json: {
          acceso: 'acceso-2',
          acceso_vence: Date.now() + 3_600_000,
          refresh: null,
          refresh_vence: Date.now() + 86_400_000,
          usuario: { nombre: 'Persona Ensayo', email: 'ensayo@example.com' },
          organizaciones: [
            {
              org_id: '0199a1b2-0000-7000-8000-0000000000fa',
              nombre: 'Finca Ensayo',
              rol: 'propietario',
              plan: 'finca',
              plan_vence: VENCE,
            },
          ],
          org_id: '0199a1b2-0000-7000-8000-0000000000fa',
          aviso: null,
        },
      }),
    );
    return creados;
  }

  test('CA1 y CA2: el propietario paga un mes, vuelve de Bold y el plan queda activo', async ({
    page,
  }) => {
    await coreConLista(page);
    const creados = await nubeDePago(page, 'aprobado');
    await configurar(page, FINCA_ENSAYO_UNO);
    await conPlan(page, 'gratuito');
    await page.goto('/agro/app/planes/');
    await plan(page, 'finca').getByRole('button', { name: 'Pagar un mes · COP 39.000' }).click();
    await expect(page.locator('[data-prueba="pago-estado"]')).toContainText(
      '¡Pago confirmado! Tu plan está activo hasta el 02/11/2026',
    );
    // El monto no lo manda la página: solo el plan, los meses y a dónde volver.
    expect(creados).toEqual([
      { plan: 'finca', meses: 1, vuelta: `${new URL(page.url()).origin}/agro/app/planes/` },
    ]);
    // La orden salió de la dirección: recargar no la confirma otra vez.
    expect(new URL(page.url()).search).toBe('');
    await expect(plan(page, 'finca')).toContainText('tu plan');
    await expect(page.locator('[data-prueba="plan-vence"]')).toContainText(
      'Tu plan Finca vale hasta el 02/11/2026.',
    );
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('si Bold todavía no sabe del pago, lo dice y deja verificar después', async ({ page }) => {
    await coreConLista(page);
    await nubeDePago(page, 'esperando');
    await configurar(page, FINCA_ENSAYO_UNO);
    await conPlan(page, 'gratuito');
    await page.goto(`/agro/app/planes/?pago=${ORDEN}`);
    const estado = page.locator('[data-prueba="pago-estado"]');
    await expect(estado).toContainText('Bold todavía no tiene noticias de este pago');
    await expect(estado.getByRole('button', { name: 'Verificar ahora' })).toBeVisible();
    await expect(plan(page, 'gratuito')).toContainText('tu plan');
  });

  test('sin las llaves de Bold, lo dice junto al botón que se tocó (revisión del dueño, 3 oct 2026)', async ({
    page,
  }) => {
    await coreConLista(page);
    await page.route(`${CORE}/api/core/pago/crear`, (r) =>
      r.fulfill({
        status: 503,
        headers: permitir,
        json: {
          estado: 'no-disponible',
          motivo: 'El pago en línea todavía no está disponible. Escríbenos y lo activamos a mano.',
        },
      }),
    );
    await configurar(page, FINCA_ENSAYO_UNO);
    await conPlan(page, 'gratuito');
    await page.goto('/agro/app/planes/');
    await plan(page, 'finca').getByRole('button', { name: 'Pagar un mes · COP 39.000' }).click();
    // Antes salía arriba de la página, fuera de la vista: parecía que el botón no hacía nada.
    const estado = plan(page, 'finca').locator('[data-prueba="pago-estado"]');
    await expect(estado).toContainText('El pago en línea todavía no está disponible');
    await expect(estado).toBeInViewport();
  });

  test('HU-C5.7 · elige 6 meses, ve el total, lo del mes y el ahorro, y el aviso queda a la vista', async ({
    page,
  }) => {
    await coreConLista(page);
    const creados = await nubeDePago(page, 'aprobado');
    await configurar(page, FINCA_ENSAYO_UNO);
    await conPlan(page, 'gratuito');
    await page.goto('/agro/app/planes/');
    const finca = plan(page, 'finca');
    // CA1: los cuatro periodos con precio; el de un mes, elegido.
    await expect(finca.locator('[data-prueba="periodo"]')).toHaveText([
      '1 mes · COP 39.000',
      /^3 meses · COP 111\.000\s*COP 37\.000 al mes · ahorras COP 6\.000$/,
      /^6 meses · COP 210\.000\s*COP 35\.000 al mes · ahorras COP 24\.000$/,
      /^12 meses · COP 390\.000\s*COP 32\.500 al mes · ahorras COP 78\.000$/,
    ]);
    await expect(finca.getByRole('radio', { name: /^1 mes/ })).toBeChecked();
    // CA3: ningún periodo ni plan dice «COP 0» junto a un botón de pago.
    await expect(page.locator('[data-prueba="pagar-plan"]')).not.toContainText('COP 0');
    await finca.getByRole('radio', { name: /^6 meses/ }).check();
    await finca.getByRole('button', { name: 'Pagar 6 meses · COP 210.000' }).click();
    // CA2: al volver de Bold la página se carga de nuevo y lo dice arriba, a la vista. Un error al
    // abrir el pago se dice dentro de la tarjeta (la prueba de las llaves de Bold).
    const estado = page.locator('[data-prueba="pago-estado"]');
    await expect(estado).toContainText('¡Pago confirmado!');
    await expect(estado).toBeInViewport();
    expect(creados).toEqual([
      { plan: 'finca', meses: 6, vuelta: `${new URL(page.url()).origin}/agro/app/planes/` },
    ]);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('un operario no ve el botón de pagar', async ({ page }) => {
    await coreConLista(page);
    await configurar(page, FINCA_ENSAYO_UNO);
    await conPlan(page, 'gratuito', 'operario');
    await page.goto('/agro/app/planes/');
    await expect(page.locator('[data-prueba="pagar-plan"]')).toHaveCount(0);
  });
});
