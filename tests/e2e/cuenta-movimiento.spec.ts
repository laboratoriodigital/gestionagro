/**
 * HU-C6.5: el revelado al desplazar de la cuenta, sin JavaScript. Se mira en la política de datos,
 * que tiene títulos por debajo del primer pantallazo.
 */
import { expect, type Page, test } from '@playwright/test';

const POLITICA = 'http://localhost:4330/privacidad/';

/** El nombre de la animación y la opacidad de cada título que se revela. */
const titulos = (page: Page) =>
  page.locator('h2.ed1-revelar').evaluateAll((hs) =>
    hs.map((h) => {
      const c = getComputedStyle(h);
      return { animacion: c.animationName, opacidad: Number(c.opacity) };
    }),
  );

test('HU-C6.5 · CA1: los títulos se revelan al desplazar, con la línea de tiempo de la vista', async ({
  page,
}) => {
  // Sin depender de la máquina: un Windows con las animaciones apagadas pide «reducir movimiento».
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(POLITICA);
  const t = await titulos(page);
  expect(t.length).toBeGreaterThan(3);
  expect(new Set(t.map((x) => x.animacion))).toEqual(new Set(['ed1-revelar']));
  // El último, lejos del primer pantallazo, todavía no se ve (desde el primer cuadro de la
  // animación): aparece al llegar a él.
  await expect.poll(async () => (await titulos(page)).at(-1)?.opacidad).toBeLessThan(1);
  await page.locator('h2.ed1-revelar').last().scrollIntoViewIfNeeded();
  await expect.poll(async () => (await titulos(page)).at(-1)?.opacidad).toBeGreaterThan(0.5);
});

test('HU-C6.5 · CA2: con «reducir movimiento», nada se anima y todo se ve', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(POLITICA);
  for (const t of await titulos(page)) expect(t).toEqual({ animacion: 'none', opacidad: 1 });
});

test('HU-C6.5 · CA3 ❌: un navegador sin animation-timeline ve todo el texto desde el principio', async ({
  page,
}) => {
  await page.goto(POLITICA);
  // Se quita de la hoja el bloque `@supports (animation-timeline: view())`: es lo que ve un
  // navegador que no lo entiende, porque lo ignora entero.
  const quitados = await page.evaluate(() => {
    let n = 0;
    for (const hoja of document.styleSheets) {
      for (let i = hoja.cssRules.length - 1; i >= 0; i--) {
        const regla = hoja.cssRules[i];
        if (
          regla instanceof CSSSupportsRule &&
          regla.conditionText.includes('animation-timeline')
        ) {
          hoja.deleteRule(i);
          n++;
        }
      }
    }
    return n;
  });
  expect(quitados).toBe(1);
  for (const t of await titulos(page)) expect(t).toEqual({ animacion: 'none', opacidad: 1 });
});
