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
    await expect(planes).toContainText('$49.000');
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
    await sinFallasDeAxe(page, ruta);
  }
  await page.goto(`${LANDING}/llms.txt`);
  await expect(page.locator('body')).toContainText('# TiendaPro');
});
