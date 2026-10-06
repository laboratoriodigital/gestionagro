/**
 * HU-C6.6: los presupuestos de la cuenta (BACKLOG_CORE §4.7), medidos por el CI y no a ojo.
 *
 * - Peso por página: JS ≤ 20 KB y CSS ≤ 15 KB con gzip, fuentes ≤ 70 KB, y todo del mismo origen
 *   (CA2: un script, una hoja o una fuente de un tercero hacen fallar la prueba).
 * - CLS ≤ 0,05, con la fuente propia ya cargada.
 * - LCP ≤ 2,0 s con la CPU ×4 y 4G lenta, en el proyecto `@rendimiento` (bitácora agro 20).
 *
 * Lighthouse CI no corre: el CLS y la accesibilidad (axe) se miden aquí mismo, sin otro navegador
 * ni minutos de más en el CI.
 */
import { gzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';

const CUENTA = 'http://localhost:4330';
const PAGINAS = ['/', '/privacidad/', '/_galeria/', '/404.html'];
const KB = 1024;
const TOPES = { script: 20 * KB, stylesheet: 15 * KB, font: 70 * KB } as const;
type Tipo = keyof typeof TOPES;

for (const ruta of PAGINAS) {
  test(`HU-C6.6 · ${ruta}: JS, CSS y fuentes dentro del presupuesto y del mismo origen`, async ({
    page,
  }) => {
    const recursos: { tipo: Tipo; url: string; cuerpo: Promise<Buffer> }[] = [];
    page.on('response', (r) => {
      const tipo = r.request().resourceType();
      if (tipo === 'script' || tipo === 'stylesheet' || tipo === 'font') {
        recursos.push({ tipo, url: r.url(), cuerpo: r.body() });
      }
    });
    await page.goto(`${CUENTA}${ruta}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const ajenos = recursos.filter((r) => new URL(r.url).origin !== CUENTA).map((r) => r.url);
    expect(ajenos, 'recursos de otro origen').toEqual([]);
    const pesos = { script: 0, stylesheet: 0, font: 0 };
    for (const r of recursos) {
      const cuerpo = await r.cuerpo;
      // Las fuentes ya vienen comprimidas (woff2): cuentan tal cual.
      pesos[r.tipo] += r.tipo === 'font' ? cuerpo.length : gzipSync(cuerpo).length;
    }
    for (const tipo of Object.keys(TOPES) as Tipo[]) {
      expect(pesos[tipo], `${tipo}: ${pesos[tipo]} bytes`).toBeLessThanOrEqual(TOPES[tipo]);
    }
  });
}

test('HU-C6.6 · CLS ≤ 0,05 en la portada, con la fuente propia ya cargada', async ({ page }) => {
  await page.goto(`${CUENTA}/`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const cls = await page.evaluate(
    () =>
      new Promise<number>((listo) => {
        let suma = 0;
        new PerformanceObserver((lista) => {
          for (const e of lista.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!e.hadRecentInput) suma += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        requestAnimationFrame(() => requestAnimationFrame(() => listo(suma)));
      }),
  );
  expect(cls, `CLS: ${cls}`).toBeLessThanOrEqual(0.05);
});

test('HU-C6.6 · LCP de la portada ≤ 2,0 s con 4G lenta y CPU ×4', { tag: '@rendimiento' }, async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'La emulación de red y CPU usa el protocolo de Chromium');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(`${CUENTA}/`, { waitUntil: 'load' });
  const lcp = await page.evaluate(
    () =>
      new Promise<number>((listo) => {
        new PerformanceObserver((lista) => {
          const ultima = lista.getEntries().at(-1);
          if (ultima) listo(ultima.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      }),
  );
  expect(lcp, `LCP: ${Math.round(lcp)} ms`).toBeLessThanOrEqual(2000);
});
