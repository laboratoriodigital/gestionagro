/**
 * El sitio público del parqueadero (HU-Q11.5) y el generador de recibo de entrada (HU-Q11.4), en
 * un teléfono de 360 px.
 *
 * - HU-Q11.5 CA1: la portada lleva a la caja y a la herramienta, sin JavaScript (P20).
 * - HU-Q11.5 CA2: la herramienta manda sus `tool.*` en UN lote a `/_m`.
 * - HU-Q11.5 CA3 ❌: ninguna página pide nada a otro origen.
 * - HU-Q11.4: el recibo sale con el pie del generador, sin serie; se imprime por el diálogo del
 *   sistema y se manda por `wa.me`; sin un dato legal no sale.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { SITIO, sinDesborde } from './parqueadero-ayudas.ts';

const GENERADOR = `${SITIO}/herramientas/recibo-de-entrada/`;
/** 8 oct 2026, 9:30 en Bogotá. */
const AHORA = Date.UTC(2026, 9, 8, 14, 30);

async function sinViolaciones(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

/** Lo que la página pide a otro origen (CA3 ❌). Los enlaces a WhatsApp abren otra pestaña. */
function ajenos(page: Page): string[] {
  const fuera: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== SITIO && !r.url().startsWith('data:')) fuera.push(r.url());
  });
  return fuera;
}

/** La pestaña se oculta (el conductor se va a WhatsApp, o se cierra): el colector envía su lote. */
const ocultar = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });

const deLaHerramienta = (lotes: readonly string[]) =>
  lotes
    .map((l) => JSON.parse(l) as { producto: string })
    .filter((l) => l.producto === 'parqueadero-recibo-de-entrada');

async function llenarParqueadero(page: Page) {
  await page.getByLabel('Nombre', { exact: true }).fill('Parqueadero de Ensayo');
  await page.getByLabel('NIT', { exact: true }).fill('900000000-1');
  await page.getByLabel('Dirección', { exact: true }).fill('Calle 1 # 2-3');
  await page.getByLabel('Ciudad', { exact: true }).fill('Bogotá');
  await page.getByLabel('Teléfono', { exact: true }).fill('6010000000');
  await page.getByLabel('Valor en pesos').fill('70');
}

test.describe('la portada (HU-Q11.5 CA1)', () => {
  test.use({ javaScriptEnabled: false });

  test('dice qué es la caja y lleva a ella y al generador, sin JavaScript', async ({ page }) => {
    const fuera = ajenos(page);
    await page.goto(`${SITIO}/`);
    await expect(page.locator('h1')).toHaveText('La caja del parqueadero, en su teléfono');
    await expect(page.getByRole('link', { name: 'Abrir la caja' })).toHaveAttribute(
      'href',
      '/caja/',
    );
    await expect(page.locator('.rasgos li')).toHaveCount(4);
    await expect(
      page.getByRole('link', { name: /^Recibo de entrada para su parqueadero/ }),
    ).toHaveAttribute('href', '/herramientas/recibo-de-entrada/');
    await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute(
      'href',
      /\/index\.md$/,
    );
    await sinDesborde(page);
    expect(fuera).toEqual([]);
  });

  test('`llms.txt` y los gemelos en Markdown responden', async ({ request }) => {
    const llms = await request.get(`${SITIO}/llms.txt`);
    expect(llms.status()).toBe(200);
    expect(await llms.text()).toMatch(/^# Parqueadero ED1\n/);
    for (const ruta of ['/index.md', '/herramientas/recibo-de-entrada/index.md']) {
      const r = await request.get(`${SITIO}${ruta}`);
      expect(r.status(), ruta).toBe(200);
      expect(await r.text()).toMatch(/^# /);
    }
  });
});

test.describe('accesibilidad WCAG 2.1 AA', () => {
  for (const esquema of ['light', 'dark'] as const) {
    test(`la portada y el generador en modo ${esquema === 'light' ? 'claro' : 'oscuro'}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: esquema });
      await page.clock.setFixedTime(AHORA);
      await page.goto(`${SITIO}/`);
      await sinViolaciones(page);
      await page.goto(GENERADOR);
      await sinViolaciones(page);
      await page.getByRole('button', { name: 'Hacer el recibo' }).click();
      await expect(page.locator('#faltan')).toBeVisible();
      await sinViolaciones(page);
      await llenarParqueadero(page);
      await page.getByLabel('Número del recibo').fill('0457');
      await page.getByLabel('Placa', { exact: true }).fill('abc 123');
      await page.getByRole('button', { name: 'Hacer el recibo' }).click();
      await expect(page.locator('#hoja')).toContainText('ABC123');
      await sinViolaciones(page);
    });
  }
});

test.describe('el generador de recibo de entrada (HU-Q11.4)', () => {
  test('hace el recibo, lo imprime y lo manda por WhatsApp, y termina en la caja', async ({
    page,
    context,
  }) => {
    await context.route('https://wa.me/**', (r) => r.fulfill({ status: 200, body: 'WhatsApp' }));
    const lotes: string[] = [];
    await context.route('**/_m', (r) => {
      lotes.push(r.request().postData() ?? '');
      return r.fulfill({ status: 204 });
    });
    await page.addInitScript(() => {
      Object.assign(window, { __impresiones: 0 });
      window.print = () => {
        Object.assign(window, {
          __impresiones: (window as unknown as { __impresiones: number }).__impresiones + 1,
        });
      };
    });
    await page.clock.setFixedTime(AHORA);
    const fuera = ajenos(page);
    await page.goto(GENERADOR);
    await expect(page.getByLabel('Hora de entrada')).toHaveValue('2026-10-08T09:30');

    // CA3 ❌: sin los datos legales no sale, y dice todo lo que falta.
    await page.getByRole('button', { name: 'Hacer el recibo' }).click();
    await expect(page.locator('#faltan')).toHaveText(
      'Para hacer el recibo falta el nombre, el NIT, la dirección, la ciudad, el teléfono, el número del recibo, la placa y la tarifa.',
    );
    await expect(page.locator('#resultado')).toBeHidden();

    await llenarParqueadero(page);
    await page.getByLabel('Número del recibo').fill('0457');
    await page.getByLabel('Placa', { exact: true }).fill('abc 123');
    await page.getByLabel(/^Estado del vehículo/).fill('Rayón en la puerta');
    await page.getByRole('button', { name: 'Hacer el recibo' }).click();

    const hoja = page.locator('#hoja');
    await expect(hoja).toContainText('ABC123');
    await expect(hoja).toContainText('Parqueadero de Ensayo');
    await expect(hoja).toContainText('Rayón en la puerta');
    // CA3: dice de dónde salió y no lleva la serie de una caja.
    await expect(hoja).toContainText('Hecho con el generador gratuito de Parqueadero ED1.');
    await expect(hoja).not.toContainText('A-0');
    await expect(page.locator('#generador')).toBeHidden();
    await expect(page.locator('#titulo-resultado')).toBeFocused();
    await sinDesborde(page);

    // CA2: el diálogo del sistema, y en papel solo la hoja.
    await page.getByRole('button', { name: 'Imprimir' }).click();
    expect(
      await page.evaluate(() => (window as unknown as { __impresiones: number }).__impresiones),
    ).toBe(1);
    await page.emulateMedia({ media: 'print' });
    await expect(hoja).toBeVisible();
    await expect(page.locator('.acciones')).toBeHidden();
    await expect(page.locator('.siguiente')).toBeHidden();
    await expect(page.locator('.marca')).toBeHidden();
    await page.emulateMedia({ media: 'screen' });

    // CA2: `wa.me`, con el número y la autorización del conductor.
    const enviar = page.getByRole('link', { name: 'Mandar por WhatsApp' });
    await enviar.click();
    await expect(page.locator('#whatsapp-falta')).toContainText('Escriba el WhatsApp');
    await page.getByLabel('WhatsApp del conductor').fill('300 123 4567');
    await enviar.click();
    await expect(page.locator('#whatsapp-falta')).toContainText('autoriza');
    await page.getByLabel(/autoriza que le enviemos/).check();
    const [whatsapp] = await Promise.all([context.waitForEvent('page'), enviar.click()]);
    const texto = new URL(whatsapp.url()).searchParams.get('text') ?? '';
    expect(whatsapp.url()).toMatch(/^https:\/\/wa\.me\/573001234567\?text=/);
    expect(texto).toContain('*Parqueadero de Ensayo*');
    expect(texto).toContain('ABC123');
    // Sin enlace a `/r/`: el recibo del generador no es de una caja.
    expect(texto).not.toContain('/r/');
    await whatsapp.close();
    // Ir a WhatsApp oculta la pestaña: sale UN lote con lo que pasó en esta visita.
    await ocultar(page);
    await expect
      .poll(() => deLaHerramienta(lotes))
      .toEqual([
        {
          v: 1,
          producto: 'parqueadero-recibo-de-entrada',
          eventos: { 'tool.opened': 1, 'tool.completed': 1, 'tool.shared': 1 },
        },
      ]);

    // Otro recibo: el parqueadero y el número siguiente se recuerdan; la placa no.
    await page.getByRole('button', { name: 'Hacer otro recibo' }).click();
    await expect(page.getByLabel('Número del recibo')).toHaveValue('0458');
    await expect(page.getByLabel('Placa', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Placa', { exact: true })).toBeFocused();
    await page.reload();
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Parqueadero de Ensayo');
    await expect(page.getByLabel('Número del recibo')).toHaveValue('0458');

    // CA1: el siguiente paso, a la caja. La navegación se detiene aquí: Playwright no ve con
    // certeza un `sendBeacon` hecho al descargar la página, así que se oculta como arriba.
    await expect(page.getByRole('heading', { name: 'Lleve la caja en su teléfono' })).toBeVisible();
    const caja = page.getByRole('link', { name: 'Abrir la caja' });
    await expect(caja).toHaveAttribute('href', '/caja/');
    await page.evaluate(() =>
      document.addEventListener('click', (e) => e.preventDefault(), { once: true }),
    );
    await caja.click();
    await ocultar(page);
    await expect
      .poll(() => deLaHerramienta(lotes).at(1))
      .toEqual({
        v: 1,
        producto: 'parqueadero-recibo-de-entrada',
        eventos: { 'tool.opened': 1, 'tool.next_step': 1 },
      });
    expect(fuera).toEqual([]);
  });
});
