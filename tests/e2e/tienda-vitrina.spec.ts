/**
 * La vitrina de Comercio Ensayo Uno, como la ve el comprador (HU-T5.2 y HU-T5.4): horneada por el
 * build de `tienda-sitio` (`scripts/tienda/hornear-ensayo.ts`) y servida estática en su propio
 * origen. El despacho y la API tienen sus pruebas; aquí, el diseño en 360 y 1280 px, la ficha sin
 * JavaScript y el carrito con su código.
 */
import { expect, type Page, test } from '@playwright/test';

const TIENDA = 'http://localhost:4332';
const FICHA = `${TIENDA}/p/camisa-de-lino/`;

/** El CLS de la página, con las fuentes ya cargadas (como en HU-C6.6). */
async function cls(page: Page): Promise<number> {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(
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
}

for (const [ancho, alto] of [
  [360, 740],
  [1280, 800],
] as const) {
  test(`HU-T5.2 CA4 · en ${ancho} px la portada y la ficha no saltan (CLS ≤ 0,05)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ancho, height: alto });
    for (const url of [`${TIENDA}/`, FICHA]) {
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const medido = await cls(page);
      expect(medido, `CLS de ${url}: ${medido}`).toBeLessThanOrEqual(0.05);
    }
  });
}

test('HU-T5.2 CA4 · sin JavaScript, la ficha se lee entera', async ({ browser }) => {
  const contexto = await browser.newContext({ javaScriptEnabled: false });
  const page = await contexto.newPage();
  await page.goto(FICHA);
  await expect(page.getByRole('heading', { level: 1, name: 'Camisa de lino' })).toBeVisible();
  await expect(page.locator('[data-precio]')).toHaveText('$129.000');
  await expect(page.getByText('Precio final.')).toBeVisible();
  await expect(page.getByText(/Puedes retractarte de la compra/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Términos' })).toBeVisible();
  await page.goto(`${TIENDA}/pedido/`);
  await expect(page.getByRole('link', { name: 'Pide por WhatsApp' })).toHaveAttribute(
    'href',
    'https://wa.me/573000000001',
  );
  await contexto.close();
});

test('HU-T5.4 · el carrito: elegir, agregar, ver el pedido con su código y cambiar cantidades', async ({
  page,
}) => {
  await page.goto(FICHA);
  const boton = page.locator('[data-boton]');
  await expect(boton).toHaveText('Elige talla');
  await page.locator('label.pildora', { hasText: 'M' }).click();
  await page.locator('label.pildora', { hasText: 'Arena' }).click();
  await expect(boton).toHaveText('Agregar al pedido');
  await boton.click();
  await expect(page.locator('[data-aviso]')).toHaveText('Agregado a tu pedido.');
  const barra = page.locator('[data-pedido]');
  await expect(barra).toBeVisible();
  await expect(barra.locator('[data-cantidad]')).toHaveText('1');

  await barra.click();
  await expect(page).toHaveURL(`${TIENDA}/pedido/`);
  const linea = page.locator('.linea');
  await expect(linea).toHaveCount(1);
  await expect(linea.locator('.linea__nombre')).toHaveText('Camisa de lino');
  await expect(page.locator('[data-codigo]')).toHaveText(/^[0-9A-HJKMNP-TV-Z]{6}$/);
  const codigo = await page.locator('[data-codigo]').textContent();
  await linea.getByRole('button', { name: 'Una unidad más' }).click();
  await expect(linea.locator('output')).toHaveText('2');
  await expect(page.locator('[data-subtotal]')).toHaveText('$258.000');

  // El código es el mismo al volver: se genera una vez por carrito.
  await page.reload();
  await expect(page.locator('[data-codigo]')).toHaveText(codigo ?? '');
  await linea.getByRole('button', { name: 'Una unidad menos' }).click();
  await linea.getByRole('button', { name: 'Una unidad menos' }).click();
  await expect(page.locator('.linea')).toHaveCount(0);
  await expect(page.locator('[data-vacio]')).toBeVisible();
});

test('HU-T5.4 P10 · un carrito del formato anterior se lee y lo dice; lo agotado sale diciéndolo', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('sembrado')) {
      sessionStorage.setItem('sembrado', '1');
      localStorage.setItem(
        'tienda:pedido',
        JSON.stringify([
          { variante: 'v-camisa-m-arena', cantidad: 1 },
          { variante: 'v-camisa-l-azul', cantidad: 1 },
        ]),
      );
    }
  });
  await page.goto(`${TIENDA}/pedido/`);
  await expect(page.locator('[data-aviso-carrito]')).toContainText('Actualizamos tu pedido');
  await expect(page.locator('[data-aviso-carrito]')).toContainText(
    'Un producto ya no está disponible',
  );
  await expect(page.locator('.linea')).toHaveCount(1);
});
