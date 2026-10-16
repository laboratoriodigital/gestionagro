/**
 * La vitrina de Comercio Ensayo Uno, como la ve el comprador (HU-T5.2 y HU-T5.4): horneada por el
 * build de `tienda-sitio` (`scripts/tienda/hornear-ensayo.ts`) y servida estática en su propio
 * origen. El despacho y la API tienen sus pruebas; aquí, el diseño en 360 y 1280 px, la ficha sin
 * JavaScript y el carrito con su código.
 */
import { AxeBuilder } from '@axe-core/playwright';
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
  await page.goto(`${TIENDA}/carrito/`);
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
  await expect(page).toHaveURL(`${TIENDA}/carrito/`);
  const linea = page.locator('.linea');
  await expect(linea).toHaveCount(1);
  await expect(linea.locator('.linea__nombre')).toHaveText('Camisa de lino');
  await expect(page.locator('[data-codigo]')).toHaveText(/^[0-9A-HJKMNP-TV-Z]{6}$/);
  const codigo = await page.locator('[data-codigo]').textContent();
  await linea.getByRole('button', { name: 'Una unidad más' }).click();
  await expect(linea.locator('output')).toHaveText('2');
  await expect(page.locator('[data-subtotal]')).toHaveText('$258.000');
  // Sin la API (el servidor de las e2e es estático), la página sigue con lo que sabe y lo dice.
  await expect(page.locator('[data-total]')).toHaveText('$258.000');
  await expect(page.locator('[data-nota]')).toHaveText(
    'No pudimos confirmar el total ahora. Lo confirmamos antes de enviar tu pedido.',
  );

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
  await page.goto(`${TIENDA}/carrito/`);
  await expect(page.locator('[data-aviso-carrito]')).toContainText('Actualizamos tu pedido');
  await expect(page.locator('[data-aviso-carrito]')).toContainText(
    'Un producto ya no está disponible',
  );
  await expect(page.locator('.linea')).toHaveCount(1);
});

test('HU-T5.5 CA2 · si el servidor corrige el pedido o el total cambió, la página lo muestra y pide revisarlo', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'tienda:carrito',
      JSON.stringify({
        v: 1,
        codigo: 'ABC234',
        lineas: [{ variante: 'v-camisa-m-arena', cantidad: 9 }],
      }),
    );
  });
  // La API de la tienda, como la respondería con 4 en inventario y un precio nuevo.
  await page.route('**/api/v1/cotizar', (ruta) =>
    ruta.fulfill({
      json: {
        subtotal: 540000,
        descuento: 0,
        envio: 0,
        total: 540000,
        avisos: [],
        cobrable: true,
        carrito: [{ variante: 'v-camisa-m-arena', cantidad: 4 }],
        cambio: true,
      },
    }),
  );
  await page.goto(`${TIENDA}/carrito/`);
  await expect(page.locator('.linea output')).toHaveText('4');
  await expect(page.locator('[data-aviso-carrito]')).toHaveText(
    'Ajustamos tu pedido con lo que la tienda tiene disponible.',
  );
  await expect(page.locator('[data-total]')).toHaveText('$540.000');
  await expect(page.locator('[data-aviso-total]')).toHaveText(
    'El total cambió: ahora es $540.000. Revísalo antes de enviar tu pedido.',
  );
});

test('HU-T6.5 · «Avísame cuando haya» en una combinación agotada, una sola vez por teléfono', async ({
  page,
}) => {
  const pedidas: string[] = [];
  await page.route('**/api/v1/avisame', async (ruta) => {
    pedidas.push(ruta.request().postData() ?? '');
    await ruta.fulfill({ json: { estado: 'anotado' } });
  });
  await page.goto(FICHA);
  await page.locator('label.pildora', { hasText: /^L$/ }).click();
  await page.locator('label.pildora', { hasText: 'Azul' }).click();
  await expect(page.locator('[data-boton]')).toHaveText('Agotada');
  const boton = page.getByRole('button', { name: 'Avísame cuando haya' });
  await boton.click();
  await expect(page.locator('[data-avisame-estado]')).toHaveText(
    'Listo: la tienda sabe que esperas esta combinación.',
  );
  expect(pedidas).toEqual([JSON.stringify({ variante: 'v-camisa-l-azul' })]);

  await page.reload();
  await page.locator('label.pildora', { hasText: /^L$/ }).click();
  await page.locator('label.pildora', { hasText: 'Azul' }).click();
  await expect(page.locator('[data-avisame-estado]')).toHaveText(
    'Ya le dijiste a la tienda que esperas esta combinación.',
  );
  await expect(boton).toBeHidden();
});

/**
 * La API de la tienda para un pedido de una camisa M Arena: cotizar, registrarlo y seguirlo. El
 * servidor de las e2e es estático; la API tiene sus propias pruebas (P17).
 */
async function apiDelPedido(page: Page) {
  const enviados: Record<string, unknown>[] = [];
  await page.route('**/api/v1/cotizar', (ruta) =>
    ruta.fulfill({
      json: {
        subtotal: 129000,
        descuento: 0,
        envio: 0,
        total: 129000,
        avisos: [],
        cobrable: true,
        carrito: [{ variante: 'v-camisa-m-arena', cantidad: 1 }],
        cambio: false,
      },
    }),
  );
  await page.route('**/api/v1/pedidos', async (ruta) => {
    enviados.push(JSON.parse(ruta.request().postData() ?? '{}') as Record<string, unknown>);
    await ruta.fulfill({
      json: {
        estado: 'registrado',
        codigo: 'ABC234',
        numero: 1001,
        total: 129000,
        texto: 'Hola, Comercio Ensayo Uno. Quiero hacer este pedido:\nPedido ABC234 · #1001',
        whatsapp: '573000000001',
      },
    });
  });
  await page.route('**/api/v1/seguimiento', (ruta) =>
    ruta.fulfill({
      json: {
        codigo: 'ABC234',
        numero: 1001,
        estado: 'pendiente',
        enPalabras: 'Recibido: la tienda lo va a confirmar',
        pasos: [
          {
            estado: 'pendiente',
            enPalabras: 'Recibido: la tienda lo va a confirmar',
            instante: '2026-10-14T15:00:00.000Z',
          },
        ],
        lineas: [
          {
            nombre: 'Camisa de lino',
            opciones: 'Talla: M · Color: Arena',
            cantidad: 1,
            total: 129000,
          },
        ],
        subtotal: 129000,
        descuento: 0,
        envio: 0,
        total: 129000,
        envioNombre: null,
        plazo: null,
        forma: 'Transferencia',
        transportadora: null,
        guia: null,
      },
    }),
  );
  return enviados;
}

test('HU-T6.1 y HU-T6.2 · enviar el pedido: dice qué falta, lo registra y muestra el acuse con WhatsApp', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('sembrado')) {
      sessionStorage.setItem('sembrado', '1');
      localStorage.setItem(
        'tienda:carrito',
        JSON.stringify({
          v: 1,
          codigo: 'ABC234',
          lineas: [{ variante: 'v-camisa-m-arena', cantidad: 1 }],
        }),
      );
    }
  });
  const enviados = await apiDelPedido(page);

  await page.goto(`${TIENDA}/carrito/`);
  const enviar = page.locator('[data-enviar]');
  await expect(enviar).toHaveText('Elige cómo pagar');
  // aria-disabled no impide tocarlo: al tocarlo, dice qué falta y lleva al campo.
  await enviar.click({ force: true });
  await expect(page.locator('[data-aviso-venta]')).toHaveText('Elige cómo pagar');
  expect(enviados).toEqual([]);
  await page.locator('label.opcion-grande', { hasText: 'Transferencia' }).click();
  await expect(enviar).toHaveText('Acepta los términos para enviar');
  // La casilla nunca viene marcada (Ley 1480 art. 50 lit. d).
  await expect(page.locator('[data-acepta]')).not.toBeChecked();
  await page.locator('[data-acepta]').check();
  await expect(enviar).toHaveText('Enviar por WhatsApp');
  await enviar.click();

  await expect(page).toHaveURL(/\/pedido\/#c=ABC234&s=[A-Za-z0-9_-]{22}$/);
  expect(enviados).toHaveLength(1);
  expect(enviados[0]).toMatchObject({
    codigo: 'ABC234',
    forma: 'transferencia',
    acepta: true,
    totalVisto: 129000,
  });
  expect(String(enviados[0]?.['terminos'])).toMatch(/^[0-9a-f]{64}$/);
  await expect(page.locator('[data-acuse-estado]')).toHaveText(
    'Recibido: la tienda lo va a confirmar',
  );
  // Bitácora tienda3 18: sin su nombre, la línea del estado no se reconocía como tal.
  await expect(page.locator('.acuse__estado')).toHaveText(
    'Estado: Recibido: la tienda lo va a confirmar',
  );
  await expect(page.locator('[data-acuse-numero]')).toHaveText('#1001');
  await expect(page.locator('[data-acuse-total]')).toHaveText('$129.000');
  await expect(page.locator('[data-acuse-forma]')).toHaveText('Transferencia');
  const whatsapp = page.getByRole('link', { name: 'Enviar por WhatsApp' });
  await expect(whatsapp).toHaveAttribute(
    'href',
    `https://wa.me/573000000001?text=${encodeURIComponent('Hola, Comercio Ensayo Uno. Quiero hacer este pedido:\nPedido ABC234 · #1001')}`,
  );
  // El carrito quedó vacío, con otro código: el pedido ya salió.
  const carrito = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('tienda:carrito') ?? '{}'),
  );
  expect(carrito.lineas).toEqual([]);
  expect(carrito.codigo).not.toBe('ABC234');
});

test('HU-T11.4 · pagar en línea: pide la entrega, abre el botón de Bold embebido y guarda solo el token', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('sembrado')) {
      sessionStorage.setItem('sembrado', '1');
      localStorage.setItem(
        'tienda:carrito',
        JSON.stringify({
          v: 1,
          codigo: 'PAG234',
          lineas: [{ variante: 'v-camisa-m-arena', cantidad: 1 }],
        }),
      );
    }
  });
  await apiDelPedido(page);
  const cobros: Record<string, unknown>[] = [];
  const checkout = {
    orderId: 'PAG234-1',
    currency: 'COP',
    amount: '129000',
    apiKey: 'identidad-de-prueba-0001',
    integritySignature: 'f'.repeat(64),
    renderMode: 'embedded',
  };
  await page.route('**/api/v1/cobros', async (ruta) => {
    cobros.push(JSON.parse(ruta.request().postData() ?? '{}') as Record<string, unknown>);
    await ruta.fulfill({
      json: {
        estado: 'registrado',
        codigo: 'PAG234',
        numero: 1001,
        total: 129000,
        vence: '2026-10-16T15:15:00.000Z',
        boton: { libreria: 'https://checkout.bold.co/library/boldPaymentButton.js', checkout },
      },
    });
  });
  // Bold de mentira: guarda lo que recibe y anota que se abrió.
  await page.route('https://checkout.bold.co/**', (ruta) =>
    ruta.fulfill({
      contentType: 'text/javascript',
      body: 'window.BoldCheckout = class { constructor(d) { window.__bold = d; } open() { window.__boldAbierto = true; } };',
    }),
  );

  await page.goto(`${TIENDA}/carrito/`);
  const enviar = page.locator('[data-enviar]');
  const entrega = page.locator('[data-entrega]');
  await expect(entrega).toBeHidden();
  await page.locator('label.opcion-grande', { hasText: 'En línea' }).click();
  await expect(entrega).toBeVisible();
  await expect(enviar).toHaveText('Escribe tu nombre y tu celular');
  await enviar.click({ force: true });
  await expect(page.locator('input[name="nombre"]')).toBeFocused();
  await page.locator('input[name="nombre"]').fill('Ensayo Dos Compradora');
  await page.locator('input[name="celular"]').fill('300 123 456');
  await expect(enviar).toHaveText('Escribe tu nombre y tu celular');
  await page.locator('input[name="celular"]').fill('3001234567');
  await page.locator('input[name="direccion"]').fill('Calle de prueba 99');
  await expect(enviar).toHaveText('Acepta los términos para enviar');
  await page.locator('[data-acepta]').check();
  await expect(enviar).toHaveText('Pagar en línea');
  await enviar.click();

  await expect
    .poll(() => page.evaluate(() => (window as { __boldAbierto?: boolean }).__boldAbierto))
    .toBe(true);
  expect(await page.evaluate(() => (window as { __bold?: unknown }).__bold)).toEqual(checkout);
  expect(cobros).toHaveLength(1);
  expect(cobros[0]).toMatchObject({
    codigo: 'PAG234',
    acepta: true,
    totalVisto: 129000,
    entrega: {
      nombre: 'Ensayo Dos Compradora',
      celular: '3001234567',
      direccion: 'Calle de prueba 99',
    },
  });
  expect(cobros[0]).not.toHaveProperty('forma');
  const token = String(cobros[0]?.['token']);
  expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
  // El enlace del pedido, a la vista antes de pagar (HU-T11.9 CA1).
  await expect(page.locator('[data-enlace-del-pago]')).toBeVisible();
  await expect(page.locator('[data-enlace-del-pedido]')).toHaveAttribute(
    'href',
    /^\/pedido\/#c=PAG234&s=[A-Za-z0-9_-]{22}$/,
  );

  // ❌ CA2 y WI-T11.4.3: lo guardado no tiene datos del comprador; la sesión, solo el token.
  const guardado = await page.evaluate(() => ({
    sesion: Object.fromEntries(Object.entries(sessionStorage)),
    local: Object.fromEntries(Object.entries(localStorage)),
  }));
  expect(guardado.sesion).toEqual({ sembrado: '1', 'tienda:cobro': token });
  const todo = JSON.stringify(guardado);
  for (const dato of ['Ensayo Dos', '3001234567', 'Calle de prueba'])
    expect(todo).not.toContain(dato);
  expect(JSON.parse(guardado.local['tienda:carrito'] ?? '{}').cobro).toEqual(expect.any(String));

  // La vuelta de Bold: lo que dice la dirección no se cree; lleva al pedido con su enlace.
  await page.goto(`${TIENDA}/pedido/pago/?bold-order-id=PAG234-1&bold-tx-status=approved`);
  await expect(page).toHaveURL(/\/pedido\/#c=PAG234&s=[A-Za-z0-9_-]{22}$/);
  await expect(page.locator('[data-acuse-estado]')).toHaveText(
    'Recibido: la tienda lo va a confirmar',
  );
  const despues = await page.evaluate(() => ({
    token: sessionStorage.getItem('tienda:cobro'),
    lineas: JSON.parse(localStorage.getItem('tienda:carrito') ?? '{}').lineas,
  }));
  expect(despues).toEqual({ token: null, lineas: [] });
});

test('HU-T6.3 CA3 · un enlace que no es: la página lo dice, sin mostrar ningún pedido', async ({
  page,
}) => {
  const consultas: string[] = [];
  await page.route('**/api/v1/seguimiento', async (ruta) => {
    consultas.push(ruta.request().url());
    await ruta.fulfill({ status: 404, json: { estado: 'no-encontrado' } });
  });
  await page.goto(`${TIENDA}/pedido/#c=ZZZ234&s=abcdefghijklmnopqrstuv`);
  await expect(page.locator('[data-seguimiento-aviso]')).toContainText(
    'No encontramos un pedido con ese enlace',
  );
  await expect(page.locator('[data-acuse]')).toBeHidden();
  // El secreto viajó en el cuerpo, nunca en la URL de la API.
  expect(consultas.every((u) => !u.includes('abcdefghijklmnopqrstuv'))).toBe(true);
});

test('HU-T6.4 CA1 · radicar una solicitud: dice qué falta, recibe el radicado y el enlace para seguirla', async ({
  page,
}) => {
  const enviadas: Record<string, unknown>[] = [];
  await page.route('**/api/v1/solicitudes', async (ruta) => {
    enviadas.push(JSON.parse(ruta.request().postData() ?? '{}') as Record<string, unknown>);
    await ruta.fulfill({
      json: {
        estado: 'radicada',
        radicado: 'R-7',
        numero: 7,
        tipo: 'Queja',
        creada: '2026-10-14T15:00:00.000Z',
        vence: '2026-11-05',
      },
    });
  });

  await page.goto(`${TIENDA}/solicitud/`);
  const enviar = page.locator('[data-solicitud-enviar]');
  await expect(enviar).toHaveText('Elige qué necesitas');
  await enviar.click({ force: true });
  await expect(page.locator('[data-solicitud-aviso]')).toHaveText('Elige qué necesitas');
  expect(enviadas).toEqual([]);
  await page.getByLabel('¿Qué necesitas?').selectOption('queja');
  await page.getByLabel('Código de tu pedido').fill('abc234');
  await page.getByLabel('Cuéntanos qué pasa').fill('La camisa llegó con una mancha.');
  await page.getByLabel('¿Cómo te respondemos?').fill('ensayo@ejemplo.co');
  // La autorización nunca viene marcada (Ley 1581 art. 9).
  await expect(page.locator('[data-solicitud] [data-acepta]')).not.toBeChecked();
  await expect(enviar).toHaveText('Autoriza el uso de tus datos para enviar');
  await page.locator('[data-solicitud] [data-acepta]').check();
  await expect(enviar).toHaveText('Enviar la solicitud');
  await enviar.click();

  await expect(page.locator('[data-radicado-numero]')).toHaveText('R-7');
  await expect(page.locator('[data-radicado-vence]')).toHaveText('5 de noviembre de 2026');
  await expect(page.locator('[data-solicitud-form]')).toBeHidden();
  expect(enviadas).toHaveLength(1);
  expect(enviadas[0]).toMatchObject({
    tipo: 'queja',
    pedido: 'abc234',
    contacto: 'ensayo@ejemplo.co',
    acepta: true,
  });
  const secreto = String(enviadas[0]?.['seguimiento']);
  expect(secreto).toMatch(/^[A-Za-z0-9_-]{22}$/);
  // El enlace lleva el secreto en el fragmento, que no llega a ningún servidor.
  await expect(page).toHaveURL(`${TIENDA}/solicitud/#r=7&s=${secreto}`);
  await expect(page.locator('[data-radicado-enlace]')).toHaveText(
    `${TIENDA}/solicitud/#r=7&s=${secreto}`,
  );
});

test('HU-T6.4 · con el enlace, la solicitud dice en qué va; uno que no es, lo dice sin mostrar nada', async ({
  page,
}) => {
  const cuerpos: string[] = [];
  await page.route('**/api/v1/solicitudes/seguimiento', async (ruta) => {
    const cuerpo = ruta.request().postData() ?? '';
    cuerpos.push(cuerpo);
    await (cuerpo.includes('"radicado":7')
      ? ruta.fulfill({
          json: {
            radicado: 'R-7',
            tipo: 'Queja',
            estado: 'en_tramite',
            enPalabras: 'En trámite',
            creada: '2026-10-14T15:00:00.000Z',
            vence: '2026-11-05',
            respondida: null,
          },
        })
      : ruta.fulfill({ status: 404, json: { estado: 'no-encontrada' } }));
  });
  await page.goto(`${TIENDA}/solicitud/#r=7&s=abcdefghijklmnopqrstuv`);
  await expect(page.locator('[data-radicado-estado]')).toHaveText('En trámite');
  expect(JSON.parse(cuerpos[0] ?? '{}')).toEqual({
    radicado: 7,
    secreto: 'abcdefghijklmnopqrstuv',
  });

  await page.goto(`${TIENDA}/solicitud/#r=8&s=abcdefghijklmnopqrstuv`);
  await page.reload();
  await expect(page.locator('[data-solicitud-aviso]')).toContainText(
    'No encontramos una solicitud con ese enlace',
  );
  await expect(page.locator('[data-radicado]')).toBeHidden();
});

/** axe en la pantalla que se ve, con las reglas de WCAG 2.1 AA. */
async function sinFallasDeAxe(page: Page, donde: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${donde} · ${v.id}: ${v.help}`)).toEqual([]);
}

test('HU-T5.7 CA2 · el comprador de punta a punta a 360 px: portada, ficha, pedido y WhatsApp, con axe', async ({
  page,
}) => {
  const enviados = await apiDelPedido(page);
  await page.goto(`${TIENDA}/`);
  await expect(page.getByRole('heading', { level: 1, name: 'Comercio Ensayo Uno' })).toBeVisible();
  await sinFallasDeAxe(page, 'portada');

  await page
    .getByRole('link', { name: /Camisa de lino/ })
    .first()
    .click();
  await expect(page).toHaveURL(FICHA);
  await sinFallasDeAxe(page, 'ficha');
  await page.locator('label.pildora', { hasText: 'M' }).click();
  await page.locator('label.pildora', { hasText: 'Arena' }).click();
  await page.locator('[data-boton]').click();
  await page.locator('[data-pedido]').click();

  await expect(page).toHaveURL(`${TIENDA}/carrito/`);
  await expect(page.locator('.linea')).toHaveCount(1);
  await sinFallasDeAxe(page, 'pedido');
  await page.locator('label.opcion-grande', { hasText: 'Transferencia' }).click();
  await page.locator('[data-acepta]').check();
  await page.locator('[data-enviar]').click();

  await expect(page).toHaveURL(/\/pedido\/#c=[0-9A-HJKMNP-TV-Z]{6}&s=[A-Za-z0-9_-]{22}$/);
  expect(enviados).toHaveLength(1);
  await expect(page.getByRole('link', { name: 'Enviar por WhatsApp' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/573000000001\?text=/,
  );
  await sinFallasDeAxe(page, 'acuse');
  const [ancho, visible] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(ancho).toBeLessThanOrEqual(visible ?? 0);
});
