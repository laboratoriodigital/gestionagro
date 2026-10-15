/**
 * HU-T3.6: los presupuestos de la vitrina (TIENDA §1.3), medidos por el CI sobre lo horneado de
 * Ensayo Uno, como los de la cuenta (HU-C6.6) y sin Lighthouse CI (otro navegador y más minutos):
 *
 * - por página, el JavaScript ≤ 60 KB y la hoja ≤ 20 KB con gzip, y la portada ≤ 50 KB de HTML;
 * - todo lo que la página carga está permitido por la CSP que sale del horno (`csp.ts`, CA2): un
 *   script, una hoja o una fuente de un tercero ponen la prueba en rojo con su dirección (CA3);
 * - el LCP de la portada y de la ficha ≤ 2,5 s con 4G lenta y la CPU ×4, en el proyecto
 *   `@rendimiento`, solo y con tres repeticiones: vale la mediana (CA4, P19).
 */
import { gzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { origenesPermitidos } from '../../packages/tienda-horno/src/csp.ts';

const TIENDA = 'http://localhost:4332';
const PAGINAS = [
  '/',
  '/p/camisa-de-lino/',
  '/c/lino/',
  '/carrito/',
  '/pedido/',
  '/legal/terminos/',
];
const KB = 1024;
const TOPES = { script: 60 * KB, stylesheet: 20 * KB } as const;
const TIPOS = {
  script: 'script',
  stylesheet: 'stylesheet',
  font: 'font',
  image: 'image',
  fetch: 'fetch',
} as const;

for (const ruta of PAGINAS) {
  test(`HU-T3.6 · ${ruta}: dentro del presupuesto y solo lo que permite su CSP`, async ({
    page,
  }) => {
    const recursos: { tipo: string; url: string; cuerpo: Promise<Buffer> }[] = [];
    page.on('response', (r) => {
      const tipo = r.request().resourceType();
      if (tipo !== 'document') recursos.push({ tipo, url: r.url(), cuerpo: r.body() });
    });
    const documento = await page.goto(`${TIENDA}${ruta}`);
    await page.waitForLoadState('networkidle');
    const permitidos = origenesPermitidos(undefined, TIENDA);
    for (const r of recursos) {
      const tipo = TIPOS[r.tipo as keyof typeof TIPOS];
      expect(tipo, `${r.url} es un ${r.tipo}, que la vitrina no carga`).toBeDefined();
      const origen = new URL(r.url).origin;
      expect(permitidos[tipo as keyof typeof permitidos], `${r.url} no está en la CSP`).toContain(
        origen,
      );
    }
    for (const [tipo, tope] of Object.entries(TOPES)) {
      const cuerpos = await Promise.all(
        recursos.filter((r) => r.tipo === tipo).map((r) => r.cuerpo),
      );
      const total = cuerpos.reduce((s, c) => s + gzipSync(c).length, 0);
      expect(
        total,
        `${tipo} de ${ruta}: ${Math.round(total / KB)} KB con gzip; el tope es ${tope / KB} KB`,
      ).toBeLessThanOrEqual(tope);
    }
    if (ruta === '/') {
      const html = (await documento?.body())?.length ?? 0;
      expect(
        html,
        `HTML de la portada: ${Math.round(html / KB)} KB; el tope es 50 KB`,
      ).toBeLessThanOrEqual(50 * KB);
    }
  });
}

for (const ruta of ['/', '/p/camisa-de-lino/']) {
  test(`HU-T3.6 · LCP de ${ruta} ≤ 2,5 s con 4G lenta y CPU ×4 (mediana de 3)`, {
    tag: '@rendimiento',
  }, async ({ browser, browserName }) => {
    test.skip(browserName !== 'chromium', 'La emulación de red y CPU usa el protocolo de Chromium');
    const medidas: number[] = [];
    for (let i = 0; i < 3; i++) {
      const contexto = await browser.newContext({ viewport: { width: 360, height: 740 } });
      const page = await contexto.newPage();
      const cdp = await contexto.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.goto(`${TIENDA}${ruta}`);
      medidas.push(
        await page.evaluate(
          () =>
            new Promise<number>((listo) => {
              new PerformanceObserver((lista) => {
                const ultima = lista.getEntries().at(-1);
                if (ultima) listo(ultima.startTime);
              }).observe({ type: 'largest-contentful-paint', buffered: true });
            }),
        ),
      );
      await contexto.close();
    }
    const mediana = [...medidas].sort((a, b) => a - b)[1] ?? Number.POSITIVE_INFINITY;
    expect(mediana, `LCP de ${ruta}: ${medidas.map(Math.round).join(', ')} ms`).toBeLessThanOrEqual(
      2500,
    );
  });
}
