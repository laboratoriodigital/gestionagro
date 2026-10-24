/**
 * La landing de CultivoPro en la raíz de cultivopro.co (HU-E0.10): a 360 y a 1280 px, con axe;
 * «Empezar» lleva al cuaderno y «Calculadoras» a las herramientas; los planes salen de planes.json;
 * la finca de ejemplo cambia de cultivo sin JavaScript; el teléfono avanza al bajar por los pasos;
 * con el movimiento reducido todo queda quieto y visible; y nada se pide a un tercero.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

async function sinFallasDeAxe(page: Page, donde: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${donde} · ${v.id}: ${v.help}`)).toEqual([]);
}

for (const ancho of [360, 1280]) {
  test(`HU-E0.10 · a ${ancho} px: qué es, «Empezar» al cuaderno, los planes y axe sin fallas`, async ({
    page,
    baseURL,
  }) => {
    const deAfuera: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith(baseURL ?? '')) deAfuera.push(r.url());
    });
    await page.setViewportSize({ width: ancho, height: 820 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Tu cuaderno de campo. Funciona aunque no haya señal.',
    );
    await expect(page.getByRole('link', { name: 'Empezar gratis' }).first()).toHaveAttribute(
      'href',
      '/agro/app/',
    );
    await expect(page.getByRole('link', { name: 'Entrar', exact: true })).toHaveAttribute(
      'href',
      '/agro/app/',
    );
    await expect(page.getByRole('link', { name: 'Abrir las calculadoras' })).toHaveAttribute(
      'href',
      '/herramientas/agro/',
    );
    // Los planes que se pueden tomar, con sus precios de planes.json; los demás, «pronto».
    const planes = page.locator('#planes');
    await expect(planes.getByRole('heading', { level: 3 })).toHaveText([
      'Gratis',
      'Finca',
      'Exportador y Cadena',
    ]);
    await expect(planes).toContainText('$39.000');
    await expect(planes).toContainText('ahorras $78.000');
    await expect(planes).not.toContainText('(pronto)');
    // Nada se sale de lo ancho de la pantalla, ni al bajar hasta el pie.
    await page.locator('.pie').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await sinFallasDeAxe(page, `portada a ${ancho}`);
    // Ningún tercero, ni una fuente ni un programa.
    expect(deAfuera).toEqual([]);
  });
}

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('HU-E0.10 · la finca de ejemplo cambia de cultivo con el teclado, y todo se lee', async ({
    page,
  }) => {
    await page.goto('/');
    const hoy = page.locator('.hoy');
    await expect(hoy.locator('[data-cultivo="tomate"]')).toBeVisible();
    await page.getByRole('radio', { name: 'Tomate' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Pepino' })).toBeChecked();
    await expect(hoy.locator('[data-cultivo="pepino"]')).toBeVisible();
    await expect(hoy.locator('[data-cultivo="tomate"]')).toBeHidden();
    await expect(hoy).toContainText('Finca de ejemplo');
    // Sin JavaScript todo se lee: las partes que aparecen al bajar ya están a la vista.
    await expect(page.locator('.incluye__punto').first()).toHaveCSS('opacity', '1');
    await expect(page.locator('[data-cifra]')).toHaveText('1,2');
  });
});

test('HU-E0.10 · el teléfono avanza al bajar: anotar, sin señal, al día y qué cosechar', async ({
  page,
}) => {
  await page.goto('/');
  const trabajo = page.locator('[data-trabajo]');
  await expect(trabajo).toHaveAttribute('data-paso', 'anota');
  for (const [paso, texto] of [
    ['guarda', 'Sin señal · 3 registros esperando'],
    ['sube', 'Al día'],
    ['cosecha', '¿Qué cosecho hoy?'],
  ] as const) {
    await page.locator(`.paso[data-paso="${paso}"]`).scrollIntoViewIfNeeded();
    await expect(trabajo).toHaveAttribute('data-paso', paso);
    await expect(trabajo.locator(`.pantalla--${paso}`)).toBeVisible();
    await expect(trabajo.locator(`.pantalla--${paso}`)).toContainText(texto);
  }
  // Las partes de abajo aparecen al llegar, y la cifra del DPV termina en su valor.
  await page.locator('.calculadoras').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-cifra]')).toHaveText('1,2');
  await page.locator('#planes').scrollIntoViewIfNeeded();
  await expect(page.locator('.plan').first()).toHaveAttribute('data-visto', '');
});

test('HU-E0.10 · con el movimiento reducido, nada se esconde ni se mueve', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/con-movimiento/);
  await expect(page.locator('.incluye__punto').last()).toHaveCSS('opacity', '1');
  await expect(page.locator('.hoy__hoja path')).toHaveCSS('animation-name', 'none');
});

test('HU-E0.10 · la landing tiene su gemelo en Markdown y entra al sitemap', async ({
  request,
}) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('<loc>https://cultivopro.co/</loc>');
  const md = await request.get('/index.md');
  expect(md.status()).toBe(200);
  expect(await md.text()).toContain('Así trabaja contigo, desde la nave');
});
