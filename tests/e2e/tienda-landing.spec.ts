/**
 * La landing de TiendaPro (HU-T18.5), armada para staging y servida en su propio origen: a 360 y a
 * 1280 px, con axe; «Crear tienda» lleva al panel de staging; la tienda de ejemplo cambia de negocio
 * sin JavaScript; el pedido avanza al bajar; y nada se pide a un tercero (CA3).
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const LANDING = 'http://localhost:4335';
const PANEL_DE_STAGING = 'https://tienda-panel-staging.laboratoriodigital-la.workers.dev/';

async function sinFallasDeAxe(page: Page, donde: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${donde} · ${v.id}: ${v.help}`)).toEqual([]);
}

for (const ancho of [360, 1280]) {
  test(`HU-T18.5 · a ${ancho} px: qué es, «Crear tienda» al panel, los planes y axe sin fallas`, async ({
    page,
  }) => {
    const deAfuera: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith(LANDING)) deAfuera.push(r.url());
    });
    await page.setViewportSize({ width: ancho, height: 820 });
    await page.goto(`${LANDING}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Tu tienda en línea. Los pedidos, a tu WhatsApp.',
    );
    const crear = page.getByRole('link', { name: 'Crear mi tienda gratis' }).first();
    await expect(crear).toHaveAttribute('href', PANEL_DE_STAGING);
    // Los planes, con sus precios de planes.json.
    const planes = page.locator('#planes');
    await expect(planes.getByRole('heading', { level: 3 })).toHaveText(['Gratis', 'Pro', 'IA Pro']);
    await expect(planes).toContainText('$24.900');
    await expect(planes).toContainText('$49.900');
    // Nada se sale de lo ancho de la pantalla.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
    await sinFallasDeAxe(page, `portada a ${ancho}`);
    // ❌ CA3: ningún tercero, ni una fuente ni un programa.
    expect(deAfuera).toEqual([]);
  });
}

test('HU-T18.5 · la tienda de ejemplo cambia de negocio con el teclado, sin JavaScript', async ({
  browser,
}) => {
  const contexto = await browser.newContext({ javaScriptEnabled: false });
  const page = await contexto.newPage();
  await page.goto(`${LANDING}/`);
  const vitrina = page.locator('.vitrina');
  await expect(vitrina.locator('[data-tienda="panaderia"]')).toBeVisible();
  await page.getByRole('radio', { name: 'Panadería' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Ropa' })).toBeChecked();
  await expect(vitrina.locator('[data-tienda="ropa"]')).toBeVisible();
  await expect(vitrina.locator('[data-tienda="panaderia"]')).toBeHidden();
  await expect(vitrina).toContainText('Tienda de ejemplo');
  await contexto.close();
});

test('HU-T18.5 · el pedido avanza en el teléfono al bajar por sus pasos', async ({ page }) => {
  await page.goto(`${LANDING}/`);
  const pedido = page.locator('[data-pedido]');
  await expect(pedido).toHaveAttribute('data-paso', 'elige');
  await page.locator('.paso[data-paso="llega"]').scrollIntoViewIfNeeded();
  await expect(pedido).toHaveAttribute('data-paso', 'llega');
  await expect(pedido.locator('.pantalla--llega')).toContainText('Pedido LAE-4821');
});

test('HU-T18.5 CA2 y HU-T18.6 CA2 · los términos y la política, sin huecos a la vista', async ({
  page,
}) => {
  for (const ruta of ['/legal/terminos/', '/legal/datos/']) {
    await page.goto(`${LANDING}${ruta}`);
    await expect(page.locator('main')).not.toContainText(/por completar|\{\w+\}/);
    // HU-T18.10: vigentes y sin nombrar a los proveedores de la plataforma.
    await expect(page.locator('main')).not.toContainText(/Borrador|Cloudflare|Google|Gmail|Resend/);
    await sinFallasDeAxe(page, ruta);
  }
  await page.goto(`${LANDING}/legal/datos/`);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Qué guardamos y para qué' }),
  ).toBeVisible();
  await expect(page.locator('main')).toContainText(
    /Escríbenos a \S+@\S+: respondemos tus consultas/,
  );
  await page.goto(`${LANDING}/llms.txt`);
  await expect(page.locator('body')).toContainText('# TiendaPro');
});

test('HU-P5.2 · la calculadora de precios: a cuánto vender, sin guardar nada, y axe sin fallas', async ({
  page,
}) => {
  const deAfuera: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(LANDING)) deAfuera.push(r.url());
  });
  await page.setViewportSize({ width: 360, height: 820 });
  await page.goto(`${LANDING}/calculadora/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('¿A cuánto lo vendo?');
  await page.getByLabel('Lo que te cuesta el producto').fill('40.000');
  await page.getByLabel('El envío que pagas tú').fill('8000');
  await page.getByLabel('Cómo te paga tu cliente').selectOption('pse');
  const resultado = page.locator('[data-resultado]');
  await expect(resultado).toBeVisible();
  // 40.000 + 30 % = 52.000, más el envío y la comisión de PSE con su IVA.
  await expect(resultado.locator('[data-precio]')).toHaveText('$63.300');
  await expect(resultado.locator('[data-ganancia]')).toHaveText('$12.052');
  await page.getByLabel('Cómo te paga tu cliente').selectOption('sin-comision');
  await expect(resultado.locator('[data-precio]')).toHaveText('$60.000');
  await expect(page.getByText('consultadas el 4 de octubre de 2026')).toBeVisible();
  // CA2: corre en el navegador y no guarda nada.
  expect(await page.evaluate(() => [localStorage.length, document.cookie])).toEqual([0, '']);
  expect(deAfuera).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await sinFallasDeAxe(page, 'calculadora');
});
