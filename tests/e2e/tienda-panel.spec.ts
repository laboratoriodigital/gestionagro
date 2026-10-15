/**
 * El panel de la Tienda (HU-T8.1 y HU-T3.5) en un teléfono de 360 px, con su CSP. El CORE y la API
 * se reemplazan interceptando la red: aquí no hay Google de verdad (P17); la entrada real es la
 * aceptación de M0 en staging (P16). Fuera de su dominio, el panel usa el CORE de staging.
 */
import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const PANEL = 'http://localhost:4333';
const { core } = JSON.parse(readFileSync('infrastructure/celdas.json', 'utf8')) as {
  core: { url_staging: string };
};
const CORE = core.url_staging;
const CORS = { 'access-control-allow-origin': PANEL };

// El service worker no se interpone: las rutas de la prueba ven cada pedido.
test.use({ serviceWorkers: 'block' });

const token = (aud: string) => `x.${Buffer.from(JSON.stringify({ aud })).toString('base64url')}.y`;

const UNO = {
  org_id: 'org-uno',
  nombre: 'Comercio Ensayo Uno',
  rol: 'propietario',
  plan: 'entrada',
};
const DOS = {
  org_id: 'org-dos',
  nombre: 'Comercio Ensayo Dos',
  rol: 'colaborador',
  plan: 'gratis',
};

const sesion = (o: Record<string, unknown> = {}) => ({
  acceso: token('tienda'),
  acceso_vence: Date.now() + 3_600_000,
  refresh: 'refresh-e2e',
  refresh_vence: Date.now() + 30 * 86_400_000,
  usuario: { nombre: 'Persona Ensayo', email: 'ensayo@ejemplo.test' },
  organizaciones: [UNO],
  org_id: UNO.org_id,
  ...o,
});

const yo = (org: typeof UNO) => ({
  org: org.org_id,
  rol: org.rol,
  plan: org.plan,
  funciones: { productos: 15, cobro_en_linea: false },
  tienda: { slug: 'ensayo', nombre: org.nombre, estado: 'borrador' },
});

/** El CORE falso: el inicio «vuelve de Google» con un código, el canje entrega `alCanjear`. */
async function coreFalso(page: Page, alCanjear: object) {
  const refrescos: Record<string, unknown>[] = [];
  await page.route(`${CORE}/api/core/auth/google/inicio?*`, async (ruta) => {
    const vuelta = new URL(ruta.request().url()).searchParams.get('vuelta');
    await ruta.fulfill({ status: 302, headers: { location: `${vuelta}#entrar=codigo-e2e` } });
  });
  await page.route(`${CORE}/api/core/auth/canje`, (ruta) =>
    ruta.fulfill({ json: alCanjear, headers: CORS }),
  );
  await page.route(`${CORE}/api/core/auth/refrescar`, (ruta) => {
    const cuerpo = ruta.request().postDataJSON() as Record<string, unknown>;
    refrescos.push(cuerpo);
    const org = [UNO, DOS].find((o) => o.org_id === cuerpo['org_id']);
    return ruta.fulfill({
      json: sesion({ organizaciones: [UNO, DOS], org_id: org?.org_id ?? null }),
      headers: CORS,
    });
  });
  return refrescos;
}

/** La API falsa: `/yo` responde con la tienda del último token pedido. */
async function apiFalsa(page: Page, tienda = UNO) {
  const pedidos: string[] = [];
  await page.route(`${PANEL}/api/panel/v1/yo`, (ruta) => {
    pedidos.push(ruta.request().headers()['authorization'] ?? '');
    return ruta.fulfill({ json: yo(tienda) });
  });
  return pedidos;
}

async function entrar(page: Page) {
  await page.getByLabel(/Leí y acepto la política de tratamiento de datos/).check();
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
}

test('HU-T8.1 · sin aceptar la política no se sale a Google, y el botón dice por qué', async ({
  page,
}) => {
  let salio = false;
  await page.route(`${CORE}/**`, (ruta) => {
    salio = true;
    return ruta.abort();
  });
  await page.goto(`${PANEL}/`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'El panel de tu tienda' }),
  ).toBeVisible();
  // `aria-disabled`, no `disabled`: el botón se puede tocar y dice por qué no avanza.
  await page.getByRole('button', { name: 'Entrar con Google' }).click({ force: true });
  await expect(page.getByText('Primero acepta la política de datos.')).toBeFocused();
  expect(salio).toBe(false);
});

test('HU-T8.1 · CA1: entra con Google, el código no queda en la barra y abre su tienda', async ({
  page,
}) => {
  await coreFalso(page, sesion());
  const pedidos = await apiFalsa(page);
  await page.goto(`${PANEL}/`);
  await entrar(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Comercio Ensayo Uno' })).toBeVisible();
  expect(page.url()).toBe(`${PANEL}/`);
  expect(pedidos[0]).toBe(`Bearer ${token('tienda')}`);
  await expect(page.getByText('Productos en tu plan')).toBeVisible();
  await expect(page.getByRole('navigation')).toBeVisible();
  // Se pregunta al abrir y al cambiar de pantalla, no en cada render: una pregunta por cambio.
  expect(pedidos).toHaveLength(1);
  await page.getByRole('link', { name: 'Más' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Más' })).toBeVisible();
  await expect.poll(() => pedidos.length).toBe(2);
  // La sesión vive en el teléfono: al volver a abrir el panel ya no pide entrar.
  await page.goto(`${PANEL}/`);
  await expect(page.getByRole('heading', { level: 1, name: 'Comercio Ensayo Uno' })).toBeVisible();
});

test('HU-T8.1 · con dos tiendas, elige una y la sesión se renueva hacia ella', async ({ page }) => {
  const refrescos = await coreFalso(page, sesion({ organizaciones: [UNO, DOS], org_id: null }));
  await apiFalsa(page, DOS);
  await page.goto(`${PANEL}/`);
  await entrar(page);
  await expect(page.getByRole('heading', { level: 1, name: '¿Qué tienda abres?' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir Comercio Ensayo Dos' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Comercio Ensayo Dos' })).toBeVisible();
  expect(refrescos[0]).toEqual({ refresh: 'refresh-e2e', org_id: 'org-dos' });
  await expect(page.locator('.barra')).toContainText('Colaborador');
});

test('HU-T8.1 · ❌ cambiar de tienda desde «Más» abre el inicio de la otra, sin recargar', async ({
  page,
}) => {
  // Bitácora tienda3 17: elegir la otra tienda dejaba «Abriendo tu tienda…» hasta recargar.
  const refrescos = await coreFalso(page, sesion({ organizaciones: [UNO, DOS] }));
  await page.route(`${PANEL}/api/panel/v1/yo`, (ruta) =>
    ruta.fulfill({ json: yo(refrescos.at(-1)?.['org_id'] === DOS.org_id ? DOS : UNO) }),
  );
  await page.goto(`${PANEL}/`);
  await entrar(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Comercio Ensayo Uno' })).toBeVisible();
  await page.getByRole('link', { name: 'Más' }).click();
  await page.getByRole('button', { name: 'Cambiar de tienda' }).click();
  await page.getByRole('button', { name: 'Abrir Comercio Ensayo Dos' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Comercio Ensayo Dos' })).toBeVisible();
  expect(page.url()).toBe(`${PANEL}/`);
  await expect(page.locator('.barra')).toContainText('Colaborador');
});

test('HU-T8.1 · sin tiendas, lo dice sin error y ofrece entrar con otra cuenta', async ({
  page,
}) => {
  await coreFalso(page, sesion({ organizaciones: [], org_id: null }));
  await page.goto(`${PANEL}/`);
  await entrar(page);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Tu cuenta todavía no tiene una tienda' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Entrar con otra cuenta' }).click();
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();
});

test('HU-T8.1 · ❌ CA3: una sesión de otra aplicación no abre el panel', async ({ page }) => {
  await coreFalso(page, sesion({ acceso: token('agro') }));
  const pedidos = await apiFalsa(page);
  await page.goto(`${PANEL}/`);
  await entrar(page);
  await expect(page.getByText(/Esa sesión es de otra aplicación/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();
  expect(pedidos).toEqual([]);
});

test('HU-T8.1 · CA2: si la sesión vence, «vuelve a entrar» aparece encima, sin perder la pantalla', async ({
  page,
}) => {
  await coreFalso(page, sesion());
  await apiFalsa(page);
  await page.goto(`${PANEL}/`);
  await entrar(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Comercio Ensayo Uno' })).toBeVisible();
  // La sesión vence del lado del CORE: la API dice 401 y renovar también.
  await page.unroute(`${PANEL}/api/panel/v1/yo`);
  await page.route(`${PANEL}/api/panel/v1/yo`, (r) => r.fulfill({ status: 401, json: {} }));
  // La bandeja (HU-T9.1) también le pregunta a la API, y también oye 401.
  await page.route(`${PANEL}/api/panel/v1/pedidos*`, (r) => r.fulfill({ status: 401, json: {} }));
  await page.unroute(`${CORE}/api/core/auth/refrescar`);
  await page.route(`${CORE}/api/core/auth/refrescar`, (r) =>
    r.fulfill({ status: 401, json: {}, headers: CORS }),
  );
  await page.getByRole('link', { name: 'Pedidos' }).click();
  const dialogo = page.getByRole('alertdialog', { name: 'Vuelve a entrar' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo).toContainText('Lo que estabas escribiendo se queda en este teléfono.');
  // Lo de debajo sigue ahí: no se navegó ni se recargó.
  await expect(page.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeVisible();
  expect(page.url()).toBe(`${PANEL}/pedidos/`);
});

test('HU-T8.1 · una ruta del panel abierta directo responde con la app (SPA)', async ({ page }) => {
  const r = await page.goto(`${PANEL}/mas/`);
  expect(r?.status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();
});

test('HU-T3.5 · CA3: la galería con 300 pedidos cabe en 360 px y pasa axe', async ({ page }) => {
  await page.goto(`${PANEL}/_galeria/`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Componentes del panel' }),
  ).toBeVisible();
  await expect(page.locator('.fila')).toHaveCount(300);
  const [ancho, visible] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(ancho).toBeLessThanOrEqual(visible ?? 0);
  // Ningún dato completo de una persona en la página.
  await expect(page.locator('body')).not.toContainText('Persona de Prueba');
  await expect(page.locator('body')).not.toContainText('123 4567');
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('HU-T3.5 · CA1 y HU-T8.1 CA2: el formulario dice todos sus errores y guarda el borrador', async ({
  page,
}) => {
  await page.goto(`${PANEL}/_galeria/`);
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Escribe el nombre del producto.').first()).toBeVisible();
  await expect(page.getByText('Escribe el precio en pesos, sin centavos.').first()).toBeVisible();
  await page.getByLabel('Nombre').fill('Camisa de lino');
  await page.getByLabel('Precio').fill('129000');
  // Salir y volver (como al entrar otra vez con Google): lo escrito sigue ahí.
  await page.reload();
  await expect(page.getByLabel('Nombre')).toHaveValue('Camisa de lino');
  await expect(page.getByLabel('Precio')).toHaveValue('129000');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Es una muestra: no se envió a ninguna parte.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Nombre')).toHaveValue('');
});

test('HU-T3.5 · lo que no se puede deshacer pide un segundo paso', async ({ page }) => {
  await page.goto(`${PANEL}/_galeria/`);
  await expect(page.getByRole('button', { name: 'Sí, archivarlo' })).toBeHidden();
  await page.getByText('Archivar el producto').click();
  await page.getByRole('button', { name: 'Sí, archivarlo' }).click();
  await expect(page.getByText('Producto archivado')).toBeVisible();
});

// ── HU-T8.2, HU-T8.4 y HU-T10.6: el catálogo y el registro desde el teléfono ─────────────────

/** Entra a Ensayo Uno con la sesión ya guardada: lo que se prueba aquí es lo que sigue. */
async function enElPanel(page: Page) {
  await coreFalso(page, sesion());
  await apiFalsa(page);
  await page.goto(`${PANEL}/`);
  await entrar(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Comercio Ensayo Uno' })).toBeVisible();
}

test('HU-T8.2 · CA1 y CA4: un vestido con tallas y colores; un precio vacío no se manda como 0', async ({
  page,
}) => {
  await enElPanel(page);
  const enviados: Record<string, unknown>[] = [];
  await page.route(`${PANEL}/api/panel/v1/productos?*`, (r) =>
    r.fulfill({ json: { productos: [] } }),
  );
  await page.route(`${PANEL}/api/panel/v1/productos/guardar`, (r) => {
    const cuerpo = r.request().postDataJSON() as { variantes: { precioCop: number | null }[] };
    enviados.push(cuerpo);
    const sinPrecio = cuerpo.variantes.findIndex((v) => v.precioCop === null);
    return sinPrecio >= 0
      ? r.fulfill({
          status: 422,
          json: {
            estado: 'problemas',
            problemas: [
              { campo: `variantes.${sinPrecio}.precioCop`, mensaje: 'escribe el precio en pesos' },
            ],
          },
        })
      : r.fulfill({ json: { estado: 'guardado', id: 'p-vestido', version: 1, slug: 'vestido' } });
  });
  await page.route(`${PANEL}/api/panel/v1/productos/p-vestido`, (r) =>
    r.fulfill({
      json: {
        id: 'p-vestido',
        version: 1,
        slug: 'vestido',
        nombre: 'Vestido',
        descripcionMd: '',
        estado: 'borrador',
        enPapelera: false,
        opciones: [{ nombre: 'Talla', valores: ['S', 'M'] }],
        retracto: { aplica: true },
        soloMayores: false,
        ivaPct: null,
        variantes: [],
        medios: [],
      },
    }),
  );
  await page.getByRole('link', { name: 'Productos' }).click();
  await expect(page.getByText('Todavía no tienes productos.')).toBeVisible();
  await page.getByRole('link', { name: 'Nuevo producto' }).first().click();
  await page.getByLabel('Nombre', { exact: true }).fill('Vestido');
  await page.getByRole('button', { name: 'Agregar una opción' }).click();
  await page.getByLabel('Nombre de la opción 1').fill('Talla');
  await page.getByLabel('Valores de Talla').fill('S, M');
  await page.getByLabel('Precio de S', { exact: true }).fill('159.000');
  await page.getByLabel('Existencias de S').fill('2');
  await page.getByLabel('No se cuentan las de M').check();
  await page.getByRole('button', { name: 'Crear producto' }).click();
  // CA4: M va sin precio, como `null`, y el error vuelve a su campo.
  await expect(page.locator('#c1-precio-error')).toHaveText('escribe el precio en pesos');
  const primero = enviados[0] as { variantes: { precioCop: unknown }[] };
  expect(primero.variantes[1]?.precioCop).toBeNull();
  await page.getByLabel('Precio de M', { exact: true }).fill('159000');
  await page.getByRole('button', { name: 'Crear producto' }).click();
  await expect(page.getByText('Guardado', { exact: true })).toBeVisible();
  expect(page.url()).toBe(`${PANEL}/productos/p-vestido/`);
  const [, bien] = enviados as { op: string; variantes: unknown[] }[];
  // Corregir y volver a enviar reusa la misma operación: lo rechazado no se aplicó.
  expect(bien?.op).toBe((enviados[0] as { op: string }).op);
  expect(bien?.variantes).toEqual([
    { valores: ['S'], sku: null, precioCop: 159000, precioAntesCop: null, stock: 2 },
    { valores: ['M'], sku: null, precioCop: 159000, precioAntesCop: null, stock: null },
  ]);
  const [ancho, visible] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(ancho).toBeLessThanOrEqual(visible ?? 0);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('HU-T8.2 · CA2: si alguien más guardó antes, lo dice y no pisa lo de la otra persona', async ({
  page,
}) => {
  await enElPanel(page);
  let version = 4;
  await page.route(`${PANEL}/api/panel/v1/productos/p-camisa`, (r) =>
    r.fulfill({
      json: {
        id: 'p-camisa',
        version,
        slug: 'camisa-de-lino',
        nombre: version === 4 ? 'Camisa de lino' : 'Camisa de lino claro',
        descripcionMd: '',
        estado: 'activo',
        enPapelera: false,
        opciones: [],
        retracto: { aplica: true },
        soloMayores: false,
        ivaPct: null,
        variantes: [
          {
            id: 'v1',
            valores: [],
            sku: null,
            precioCop: 129000,
            precioAntesCop: null,
            stock: 3,
            reservado: 0,
          },
        ],
        medios: [],
      },
    }),
  );
  await page.route(`${PANEL}/api/panel/v1/productos/guardar`, (r) => {
    version = 5;
    return r.fulfill({
      status: 409,
      json: {
        estado: 'cambiado',
        motivo: 'Alguien más cambió esto mientras lo editabas.',
        version: 5,
      },
    });
  });
  await page.goto(`${PANEL}/productos/p-camisa/`);
  await expect(page.getByLabel('Precio', { exact: true })).toHaveValue('129.000');
  await page.getByLabel('Precio', { exact: true }).fill('119.000');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Alguien más guardó este producto')).toBeVisible();
  await page.getByRole('button', { name: 'Ver cómo quedó' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Camisa de lino claro' })).toBeVisible();
  await expect(page.getByLabel('Precio', { exact: true })).toHaveValue('129.000');
});

test('HU-T8.4 · CA2: borrar una colección dice que sus productos se quedan', async ({ page }) => {
  await enElPanel(page);
  let borrada = false;
  await page.route(`${PANEL}/api/panel/v1/colecciones`, (r) =>
    r.fulfill({
      json: {
        colecciones: borrada
          ? []
          : [
              {
                id: 'c-lino',
                slug: 'lino',
                nombre: 'Lino',
                descripcionMd: '',
                visible: true,
                version: 1,
                productos: ['p-camisa'],
              },
            ],
      },
    }),
  );
  await page.route(`${PANEL}/api/panel/v1/productos?*`, (r) =>
    r.fulfill({
      json: {
        productos: [
          {
            id: 'p-camisa',
            slug: 'camisa-de-lino',
            nombre: 'Camisa de lino',
            estado: 'activo',
            version: 1,
            combinaciones: 3,
            desde: 129000,
            existencias: 5,
            borrado: null,
          },
        ],
      },
    }),
  );
  await page.route(`${PANEL}/api/panel/v1/productos`, (r) =>
    r.fulfill({
      json: {
        productos: [
          {
            id: 'p-camisa',
            slug: 'camisa-de-lino',
            nombre: 'Camisa de lino',
            estado: 'activo',
            version: 1,
            combinaciones: 3,
            desde: 129000,
            existencias: 5,
            borrado: null,
          },
        ],
      },
    }),
  );
  await page.route(`${PANEL}/api/panel/v1/colecciones/borrar`, (r) => {
    borrada = true;
    return r.fulfill({ json: { estado: 'guardado', id: 'c-lino', version: 2 } });
  });
  await page.goto(`${PANEL}/productos/colecciones/c-lino/`);
  await expect(page.getByLabel('Camisa de lino')).toBeChecked();
  await page.getByText('Borrar la colección', { exact: true }).click();
  await expect(page.getByText('Se borra «Lino». Sus productos siguen en la tienda.')).toBeVisible();
  await page.getByRole('button', { name: 'Sí, borrar la colección' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Colecciones' })).toBeVisible();
  await expect(page.getByText('Todavía no tienes colecciones.')).toBeVisible();
});

/** Las partes de un `multipart/form-data`: su nombre, el del archivo si es uno, y sus bytes. */
function partesDe(cuerpo: Buffer, tipo: string) {
  const limite = Buffer.from(`--${tipo.split('boundary=')[1]}`);
  const partes: { nombre: string; archivo: string | null; bytes: Buffer }[] = [];
  let i = cuerpo.indexOf(limite);
  while (i >= 0) {
    const siguiente = cuerpo.indexOf(limite, i + limite.length);
    if (siguiente < 0) break;
    const parte = cuerpo.subarray(i + limite.length + 2, siguiente - 2);
    const fin = parte.indexOf('\r\n\r\n');
    const cabeza = parte.subarray(0, fin).toString();
    partes.push({
      nombre: /name="([^"]+)"/.exec(cabeza)?.[1] ?? '',
      archivo: /filename="([^"]+)"/.exec(cabeza)?.[1] ?? null,
      bytes: parte.subarray(fin + 4),
    });
    i = siguiente;
  }
  return partes;
}

test('HU-T8.3 · CA3: en Safari, que no hace WebP, la foto sube en JPEG y con su descripción', async ({
  page,
}) => {
  // Safari pide WebP a `canvas.toBlob` y devuelve PNG sin avisar (bitácora tienda3 2).
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (listo, tipo, calidad) {
      original.call(this, listo, tipo === 'image/webp' ? 'image/png' : tipo, calidad);
    };
  });
  await enElPanel(page);
  let medios: Record<string, unknown>[] = [];
  await page.route(`${PANEL}/api/panel/v1/productos/p-lino`, (r) =>
    r.fulfill({
      json: {
        id: 'p-lino',
        version: 1,
        slug: 'camisa-de-lino',
        nombre: 'Camisa de lino',
        descripcionMd: '',
        estado: 'activo',
        enPapelera: false,
        opciones: [],
        retracto: { aplica: true },
        soloMayores: false,
        ivaPct: null,
        variantes: [
          {
            id: 'v1',
            valores: [],
            sku: null,
            precioCop: 129000,
            precioAntesCop: null,
            stock: 3,
            reservado: 0,
          },
        ],
        medios,
      },
    }),
  );
  const subidas: { partes: ReturnType<typeof partesDe> }[] = [];
  await page.route(`${PANEL}/api/panel/v1/medios/subir`, (r) => {
    const partes = partesDe(
      r.request().postDataBuffer() ?? Buffer.alloc(0),
      r.request().headers()['content-type'] ?? '',
    );
    subidas.push({ partes });
    medios = [
      {
        id: 'a'.repeat(64),
        alt: 'Camisa de lino arena, de frente',
        ancho: 900,
        alto: 600,
        formato: 'jpeg',
        anchos: [400, 800],
        src: `https://img.laboratorio-digital.app/org-ensayo-uno/${'a'.repeat(64)}/400.jpeg`,
      },
    ];
    return r.fulfill({
      json: { estado: 'guardado', id: 'a'.repeat(64), formato: 'jpeg', anchos: [400, 800] },
    });
  });
  await page.route('https://img.laboratorio-digital.app/**', (r) =>
    r.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.goto(`${PANEL}/productos/p-lino/`);
  await expect(page.getByText('Todavía no tiene fotos.')).toBeVisible();
  // Una foto de 900×600 hecha en el mismo teléfono, elegida como si viniera de la galería.
  await page.evaluate(async () => {
    const lienzo = document.createElement('canvas');
    lienzo.width = 900;
    lienzo.height = 600;
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('sin canvas');
    ctx.fillStyle = '#c8b89a';
    ctx.fillRect(0, 0, 900, 600);
    const blob = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, 'image/png'));
    if (!blob) throw new Error('sin foto');
    const entrada = document.querySelector<HTMLInputElement>('#foto-nueva');
    if (!entrada) throw new Error('sin campo');
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'IMG_0001.png', { type: 'image/png' }));
    entrada.files = dt.files;
    entrada.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // CA1: sin descripción no sube.
  await page.getByRole('button', { name: 'Subir foto' }).click();
  await expect(page.locator('#foto-alt-error')).toHaveText(
    'Describe la foto en pocas palabras, para quien no la puede ver.',
  );
  expect(subidas).toHaveLength(0);
  await page.getByLabel('Describe la foto').fill('Camisa de lino arena, de frente');
  await page.getByRole('button', { name: 'Subir foto' }).click();
  await expect(page.getByText('Foto subida.', { exact: false })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Camisa de lino arena, de frente' })).toBeVisible();

  const [subida] = subidas;
  const partes = subida?.partes ?? [];
  const valor = (n: string) => partes.find((p) => p.nombre === n)?.bytes.toString();
  expect(valor('formato')).toBe('jpeg');
  expect(valor('alt')).toBe('Camisa de lino arena, de frente');
  expect([valor('ancho'), valor('alto')]).toEqual(['900', '600']);
  const archivos = partes.filter((p) => p.archivo !== null);
  // Solo las derivadas que alcanza el original, en JPEG de verdad: el original no sale del teléfono.
  expect(archivos.map((p) => [p.nombre, p.archivo])).toEqual([
    ['d400', '400.jpeg'],
    ['d800', '800.jpeg'],
  ]);
  for (const a of archivos) expect([...a.bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('HU-T8.5 · CA1 y CA2: ajustar y contar, con su libro, y lo apartado dicho con palabras', async ({
  page,
}) => {
  await enElPanel(page);
  const fila = {
    variante: 'v-camisa-m-arena',
    producto: 'p-camisa',
    nombre: 'Camisa de lino',
    combinacion: 'M / Arena',
    sku: null,
    stock: 4,
    apartadas: 2,
    esperan: 3,
    version: 1,
  };
  const movimientos: object[] = [];
  const enviados: Record<string, unknown>[] = [];
  await page.route(`${PANEL}/api/panel/v1/inventario`, (r) =>
    r.fulfill({ json: { filas: [fila] } }),
  );
  await page.route(`${PANEL}/api/panel/v1/inventario/v-camisa-m-arena`, (r) =>
    r.fulfill({ json: { fila, movimientos, siguiente: null } }),
  );
  await page.route(`${PANEL}/api/panel/v1/inventario/ajustar`, (r) => {
    const cuerpo = r.request().postDataJSON() as { tipo: string; cantidad: number };
    enviados.push(cuerpo);
    if (cuerpo.tipo === 'conteo' && cuerpo.cantidad < 2) {
      return r.fulfill({
        status: 422,
        json: {
          estado: 'problemas',
          problemas: [
            {
              campo: 'cantidad',
              mensaje:
                'Hay 2 unidades apartadas por pagos en curso: las existencias no pueden quedar en menos de 2.',
            },
          ],
        },
      });
    }
    movimientos.unshift({
      id: 1,
      delta: 3,
      stock: 7,
      motivo: 'conteo',
      ref: 'op',
      instante: '2026-10-15T15:42:00.000Z',
    });
    Object.assign(fila, { stock: 7, version: 2 });
    return r.fulfill({ json: { estado: 'guardado', id: fila.variante, version: 2 } });
  });
  await page.route(`${PANEL}/api/panel/v1/avisame/atender`, (r) => {
    fila.esperan = 0;
    return r.fulfill({ json: { estado: 'guardado', id: fila.variante, version: 1 } });
  });

  await page.route(`${PANEL}/api/panel/v1/productos?*`, (r) =>
    r.fulfill({ json: { productos: [] } }),
  );
  await page.getByRole('link', { name: 'Productos' }).click();
  await page.getByRole('link', { name: 'Inventario', exact: true }).click();
  await page.getByRole('link', { name: /Camisa de lino · M \/ Arena/ }).click();
  await expect(page.getByText('4 en existencia · 2 apartadas · 3 esperan')).toBeVisible();

  await page.getByLabel('Las conté').check();
  await page.getByLabel('¿Cuántas hay?').fill('1');
  await page.getByRole('button', { name: 'Guardar el conteo' }).click();
  await expect(
    page.getByText('Hay 2 unidades apartadas por pagos en curso', { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByLabel('¿Cuántas hay?')).toHaveAttribute('aria-invalid', 'true');

  await page.getByLabel('¿Cuántas hay?').fill('7');
  await page.getByRole('button', { name: 'Guardar el conteo' }).click();
  await expect(page.getByText('Conteo guardado.')).toBeVisible();
  await expect(page.getByText('Conteo: +3 → quedan 7')).toBeVisible();
  expect(enviados.at(-1)).toMatchObject({ tipo: 'conteo', cantidad: 7, version: 1 });

  await page.getByText('Ya les avisé', { exact: true }).click();
  await page.getByRole('button', { name: 'Sí, ya les avisé' }).click();
  await expect(page.getByText('3 personas pidieron que les avises')).toBeHidden();

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

/** Un pedido de la bandeja como lo da la API: el comprador ya viene tapado. */
const filaDePedido = (numero: number, extra: Record<string, unknown> = {}) => ({
  id: `ped-${numero}`,
  numero,
  estado: numero % 3 === 0 ? 'confirmado' : 'pendiente',
  formaPago: numero % 2 === 0 ? 'contraentrega' : 'transferencia',
  totalCop: 129000,
  creado: new Date(Date.UTC(2026, 9, 15, 15) - (2000 - numero) * 60_000).toISOString(),
  ciudad: 'Medellín',
  articulos: 1,
  atencion: null,
  comprador: { nombre: 'Ensayo D.', celular: '300 ••• 4567' },
  version: 1,
  ...extra,
});

test('HU-T9.1 · 300 pedidos en 360 px: filtros sin red, y una respuesta vieja no pisa la nueva', async ({
  page,
}) => {
  await enElPanel(page);
  const todos = Array.from({ length: 300 }, (_, i) => filaDePedido(1300 - i));
  let lecturas = 0;
  /** La próxima primera página trae una lista vieja, y no llega hasta que la prueba la suelta. */
  let lenta = false;
  let soltar: () => void = () => undefined;
  const suelta = new Promise<void>((listo) => {
    soltar = listo;
  });
  await page.route(`${PANEL}/api/panel/v1/pedidos*`, async (r) => {
    lecturas++;
    const cursor = new URL(r.request().url()).searchParams.get('cursor');
    const desde = cursor ? Number(cursor) : 0;
    if (!cursor && lenta) {
      lenta = false;
      await suelta;
      return r.fulfill({
        json: { atencion: [], pedidos: [filaDePedido(999, { ciudad: 'Vieja' })], siguiente: null },
      });
    }
    return r.fulfill({
      json: {
        atencion: cursor ? [] : [filaDePedido(1290, { atencion: 'monto' })],
        pedidos: todos.slice(desde, desde + 50),
        siguiente: desde + 50 < todos.length ? String(desde + 50) : null,
      },
    });
  });
  await page.getByRole('link', { name: 'Pedidos' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Necesitan atención' })).toBeVisible();
  await expect(
    page.getByText('Cobro a revisar: el monto no cuadra', { exact: false }),
  ).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Ver más' }).click();
    await expect(page.locator('.filas').last().locator('.fila')).toHaveCount(50 * (i + 2));
  }
  await expect(page.getByRole('button', { name: 'Ver más' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  // CA1: los filtros trabajan sobre lo que ya llegó, sin pedir nada.
  const antes = lecturas;
  await page.getByLabel('Estado').selectOption('confirmado');
  await page.getByLabel('Forma de pago').selectOption('contraentrega');
  await expect(page.locator('.filas').last().locator('.fila')).toHaveCount(50);
  await page.getByLabel('Número o comprador').fill('#1296');
  await expect(page.locator('.filas').last().locator('.fila')).toHaveCount(1);
  expect(lecturas).toBe(antes);
  await page.getByLabel('Número o comprador').fill('');
  await page.getByLabel('Estado').selectOption('');
  await page.getByLabel('Forma de pago').selectOption('');

  // CA2 y CA3: la lectura lenta sale primero y llega de última; la lista de antes sigue mientras
  // tanto, y al final queda la de la lectura nueva.
  lenta = true;
  await page.getByRole('button', { name: 'Actualizar' }).click();
  await expect(page.locator('.filas').last().locator('.fila')).toHaveCount(300);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('.filas').last().locator('.fila')).toHaveCount(50);
  // Ahora llega la vieja; la pantalla ya la procesó cuando pasan dos cuadros después de leerla.
  const vieja = page.waitForResponse((r) => r.url().endsWith('/api/panel/v1/pedidos'));
  soltar();
  await (await vieja).finished();
  await page.evaluate(
    () => new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo))),
  );
  await expect(page.locator('.filas').last().locator('.fila')).toHaveCount(50);
  await expect(page.getByText('Vieja', { exact: false })).toHaveCount(0);

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test.describe('con el teléfono en otra zona horaria', () => {
  // La hora del registro es la de Bogotá aunque el teléfono esté en Madrid.
  test.use({ timezoneId: 'Europe/Madrid' });

  test('HU-T10.6 · CA1: el registro en frases, con la hora de Bogotá', async ({ page }) => {
    await enElPanel(page);
    await page.route(`${PANEL}/api/panel/v1/registro`, (r) =>
      r.fulfill({
        json: {
          filas: [
            {
              id: 2,
              instante: '2026-10-15T15:42:00.000Z',
              frase: 'Tú cambiaste el precio de $129.000 a $119.000 en «Camisa de lino»',
            },
          ],
          siguiente: 2,
        },
      }),
    );
    await page.route(`${PANEL}/api/panel/v1/registro?cursor=2`, (r) =>
      r.fulfill({
        json: {
          filas: [
            {
              id: 1,
              instante: '2026-10-15T14:00:00.000Z',
              frase: 'Otra persona del equipo creó «Camisa de lino»',
            },
          ],
          siguiente: null,
        },
      }),
    );
    await page.getByRole('link', { name: 'Más' }).click();
    await page.getByRole('link', { name: 'Registro: quién cambió qué' }).click();
    await expect(
      page.getByText('Tú cambiaste el precio de $129.000 a $119.000 en «Camisa de lino»'),
    ).toBeVisible();
    // 15:42 UTC son las 10:42 en Bogotá, esté donde esté el teléfono.
    await expect(page.locator('.registro__hora').first()).toContainText('10:42');
    await page.getByRole('button', { name: 'Ver más' }).click();
    await expect(page.getByText('Otra persona del equipo creó «Camisa de lino»')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver más' })).toBeHidden();
  });
});
