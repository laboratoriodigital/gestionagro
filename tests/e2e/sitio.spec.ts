/**
 * Sitio público (HU-E1.6, CA2–CA5) en un teléfono de 360 px.
 *
 * - CA3: el contenido completo se ve sin JavaScript (P20: el rastreador no ejecuta JS).
 * - CA4: JS de la página < 50 KB con gzip y LCP < 2,5 s con 4G lenta y CPU ×4.
 * - CA5: sin violaciones WCAG 2.1 AA según axe, en modo claro y oscuro.
 * - CA2: una sesión envía los eventos en UNA solicitud.
 *
 * Nada espera por tiempo: se esperan estados (P19).
 */
import { gzipSync } from 'node:zlib';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGINAS = ['/herramientas/agro/', '/herramientas/agro/calculadora-dpv/'] as const;
const DPV = '/herramientas/agro/calculadora-dpv/';
const PRESUPUESTO_JS_GZIP_BYTES = 50 * 1024;
const PRESUPUESTO_LCP_MS = 2500;

test.describe('sin JavaScript (CA3, P20)', () => {
  test.use({ javaScriptEnabled: false });

  test('la página de la DPV muestra todo su contenido', async ({ page }) => {
    await page.goto(DPV);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('Calculadora de DPV');
    await expect(page.getByRole('heading', { name: 'Cómo se calcula el DPV' })).toBeVisible();
    await expect(page.getByText('0,895 kPa', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fuentes' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cuaderno de campo' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Migas de pan' })).toBeVisible();
  });

  for (const ruta of PAGINAS) {
    test(`${ruta} tiene exactamente un h1 y no desborda a lo ancho`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page.locator('h1')).toHaveCount(1);
      const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(ancho).toBeLessThanOrEqual(360);
    });
  }
});

test.describe('presupuesto de rendimiento (CA4)', () => {
  for (const ruta of PAGINAS) {
    test(`${ruta}: JS < 50 KB con gzip`, async ({ page }) => {
      const scripts: Buffer[] = [];
      page.on('response', async (r) => {
        if (r.request().resourceType() === 'script') scripts.push(await r.body());
      });
      await page.goto(ruta, { waitUntil: 'load' });
      const enLinea = await page.$$eval(
        'script:not([src]):not([type="application/ld+json"])',
        (ss) => ss.map((s) => s.textContent ?? ''),
      );
      const total = [...scripts, ...enLinea.map((s) => Buffer.from(s))].reduce(
        (suma, cuerpo) => suma + gzipSync(cuerpo).length,
        0,
      );
      expect(total, `JS comprimido: ${total} bytes`).toBeLessThan(PRESUPUESTO_JS_GZIP_BYTES);
    });
  }

  test('LCP < 2,5 s con 4G lenta y CPU ×4', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'La emulación de red y CPU usa el protocolo de Chromium');
    const cdp = await page.context().newCDPSession(page);
    // Perfil «Slow 4G» de Lighthouse: 150 ms de latencia, 1,6 Mbps de bajada, 750 kbps de subida.
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(DPV, { waitUntil: 'load' });
    const lcp = await page.evaluate(
      () =>
        new Promise<number>((listo) => {
          new PerformanceObserver((lista) => {
            const ultima = lista.getEntries().at(-1);
            if (ultima) listo(ultima.startTime);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
        }),
    );
    expect(lcp, `LCP: ${Math.round(lcp)} ms`).toBeLessThan(PRESUPUESTO_LCP_MS);
  });
});

test.describe('accesibilidad WCAG 2.1 AA (CA5)', () => {
  for (const esquema of ['light', 'dark'] as const) {
    for (const ruta of PAGINAS) {
      test(`${ruta} en modo ${esquema === 'light' ? 'claro' : 'oscuro'}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: esquema });
        await page.goto(ruta);
        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        const resumen = violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
        expect(resumen).toEqual([]);
      });
    }
  }
});

test.describe('eventos en lote (CA2)', () => {
  test('una sesión envía UNA solicitud a /api/eventos, con tool.opened', async ({ page }) => {
    const cuerpos: string[] = [];
    await page.route('**/api/eventos', async (ruta) => {
      cuerpos.push(ruta.request().postData() ?? '');
      await ruta.fulfill({ status: 204 });
    });
    await page.goto(DPV);
    await expect.poll(() => page.evaluate(() => 'agroEventos' in window)).toBe(true);
    // Ocultar la pestaña dos veces y luego cerrarla: sigue siendo un solo envío.
    const ocultar = () =>
      page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    await ocultar();
    await ocultar();
    await expect.poll(() => cuerpos.length).toBe(1);
    await page.close({ runBeforeUnload: true });
    expect(cuerpos).toHaveLength(1);
    expect(JSON.parse(cuerpos[0] ?? '{}')).toEqual({
      v: 1,
      producto: 'agro-calculadora-dpv',
      eventos: { 'tool.opened': 1 },
    });
  });
});
