/**
 * HU-C6.4: la galería del sistema de diseño v2, en la cuenta. Dos controles:
 *
 * - **axe** sin violaciones WCAG 2.1 AA, en claro y en oscuro.
 * - **Estilos calculados** de cada muestra (radios, colores, tamaños, espacios), a 360 y 1280 px,
 *   comparados con los guardados. Se compara lo que el CSS dice y no los píxeles: así la prueba da
 *   lo mismo en Windows y en Linux (P3), y un cambio se lee como texto (CA3). Lo que no ve: cómo
 *   dibuja cada sistema las letras. Las capturas por píxel quedan para cuando haya una referencia
 *   hecha en Linux.
 *
 * Para aceptar un cambio que sí se quería: `pnpm e2e tests/e2e/galeria.spec.ts --update-snapshots`.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const CUENTA = 'http://localhost:4330';
const TEMAS = [
  { tema: 'claro', ruta: '/_galeria/' },
  { tema: 'oscuro', ruta: '/_galeria/oscuro/' },
] as const;
const ANCHOS = [360, 1280] as const;

/** Lo que define cómo se ve un componente, sin medidas que dependan de cómo se dibujan las letras. */
const PROPIEDADES = [
  'color',
  'background-color',
  'border-top-color',
  'border-top-width',
  'border-top-style',
  'border-left-width',
  'border-top-left-radius',
  'font-family',
  'font-size',
  'font-weight',
  'letter-spacing',
  'line-height',
  'padding-top',
  'padding-left',
  'margin-top',
  'gap',
  'min-height',
  'opacity',
  'text-decoration-line',
  'outline-offset',
] as const;

async function estilos(page: Page) {
  return page.evaluate((props) => {
    const salida: Record<string, Record<string, string>> = {};
    for (const muestra of document.querySelectorAll<HTMLElement>('[data-muestra]')) {
      const nombre = muestra.dataset['muestra'] ?? '?';
      // Los elementos del sistema de diseño, nombrados por su clase y su orden en la muestra.
      const vistos = new Map<string, number>();
      for (const el of muestra.querySelectorAll<HTMLElement>('[class*="ed1-"]')) {
        const clase = [...el.classList].filter((c) => c.startsWith('ed1-')).join('.');
        const n = (vistos.get(clase) ?? 0) + 1;
        vistos.set(clase, n);
        const calculado = getComputedStyle(el);
        salida[`${nombre} › ${clase} #${n}`] = Object.fromEntries(
          props.map((p) => [p, calculado.getPropertyValue(p)]),
        );
      }
    }
    return salida;
  }, PROPIEDADES);
}

for (const { tema, ruta } of TEMAS) {
  test(`HU-C6.4 · CA2: la galería en ${tema} no tiene violaciones de accesibilidad`, async ({
    page,
  }) => {
    await page.goto(`${CUENTA}${ruta}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Galería' })).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  for (const ancho of ANCHOS) {
    test(`HU-C6.4 · CA3: los estilos de la galería en ${tema} a ${ancho} px son los guardados`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto(`${CUENTA}${ruta}`);
      await page.evaluate(() => document.fonts.ready);
      expect(`${JSON.stringify(await estilos(page), null, 2)}\n`).toMatchSnapshot(
        `estilos-${tema}-${ancho}.json`,
      );
    });
  }
}
