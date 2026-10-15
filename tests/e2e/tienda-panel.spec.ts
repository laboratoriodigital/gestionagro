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

const cifrasEnCero = { pedidos: 0, vendidos: 0, ventasCop: 0, ticketCop: null, tasaDeCierre: null };
/** HU-T14.2: el tablero de una tienda que todavía no vende. */
const tableroVacio = () => ({
  periodos: { altura: '2026-09-15', anteriorCompleto: false },
  hoy: cifrasEnCero,
  mes: cifrasEnCero,
  anterior: cifrasEnCero,
  pendientes: {
    porConfirmar: 0,
    porDespachar: 0,
    recaudosAtrasados: 0,
    solicitudesPorVencer: 0,
    solicitudesVencidas: 0,
    pagosSinExistencias: 0,
    cobrosARevisar: 0,
    agotados: 0,
  },
  contraentrega: {
    cerrados: 0,
    devueltos: 0,
    cobradoCop: 0,
    costosCop: 0,
    netoCop: 0,
    sinCostos: 0,
    enCamino: 0,
  },
});

/** La API falsa: `/yo` responde con la tienda del último token pedido; Inicio, sin ventas. */
async function apiFalsa(page: Page, tienda = UNO) {
  const pedidos: string[] = [];
  await page.route(`${PANEL}/api/panel/v1/tablero`, (ruta) =>
    ruta.fulfill({ json: tableroVacio() }),
  );
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

test('HU-T9.2 y HU-T9.3 · ver los datos de entrega, confirmar por WhatsApp y confirmar', async ({
  page,
}) => {
  const consola: string[] = [];
  page.on('console', (m) => consola.push(m.text()));
  await enElPanel(page);
  const pedido = {
    ...filaDePedido(1045, { estado: 'pendiente', formaPago: 'transferencia', articulos: 2 }),
    canal: 'whatsapp',
    subtotalCop: 258000,
    descuentoCop: 0,
    envioCop: 0,
    cuponCodigo: null,
    envioNombre: null,
    totalCop: 258000,
    lineas: [
      {
        variante: 'v-camisa-m-arena',
        nombre: 'Camisa de lino',
        opciones: 'Talla: M · Color: Arena',
        cantidad: 2,
        precioUnitarioCop: 129000,
        totalCop: 258000,
        descontado: false,
      },
    ],
    historia: [] as object[],
    conContacto: true,
  };
  const mensaje =
    'Hola, Ensayo. Te escribimos de Comercio Ensayo Uno por tu pedido #1045:\n• 2 × Camisa de lino (Talla: M · Color: Arena): $258.000\nTotal: $258.000';
  const confirmados: unknown[] = [];
  await page.route(`${PANEL}/api/panel/v1/pedidos/ped-1045`, (r) => r.fulfill({ json: pedido }));
  await page.route(`${PANEL}/api/panel/v1/pedidos/contacto`, (r) => {
    pedido.historia.push({
      instante: '2026-10-15T15:50:00.000Z',
      tipo: 'contacto_leido',
      de: null,
      a: null,
      quien: 'Tú',
    });
    return r.fulfill({
      json: {
        estado: 'ok',
        contacto: {
          nombre: 'Ensayo Dos Compradora',
          celular: '3001234567',
          direccion: 'Calle de prueba 99',
        },
      },
    });
  });
  await page.route(`${PANEL}/api/panel/v1/pedidos/whatsapp`, (r) =>
    r.fulfill({
      json: {
        estado: 'ok',
        url: `https://wa.me/573001234567?text=${encodeURIComponent(mensaje)}`,
        mensaje,
      },
    }),
  );
  await page.route(`${PANEL}/api/panel/v1/pedidos/confirmar`, (r) => {
    confirmados.push(r.request().postDataJSON());
    Object.assign(pedido, { estado: 'confirmado', version: 2 });
    return r.fulfill({ json: { estado: 'guardado', id: pedido.id, version: 2 } });
  });

  await page.goto(`${PANEL}/pedidos/ped-1045/`);
  await expect(page.getByRole('heading', { level: 1, name: 'Pedido #1045' })).toBeVisible();
  await expect(page.getByText('Ensayo D. · 300 ••• 4567')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Compradora');

  await page.getByRole('button', { name: 'Ver datos de entrega' }).click();
  await expect(page.getByText('Calle de prueba 99')).toBeVisible();
  await expect(page.getByText('Tú vio los datos de entrega')).toHaveCount(0);
  await expect(page.getByText('Tú viste los datos de entrega')).toBeVisible();

  await page.getByRole('button', { name: 'Confirmar por WhatsApp' }).click();
  await expect(page.locator('pre.mensaje')).toHaveText(mensaje);
  await expect(page.getByRole('link', { name: 'Abrir WhatsApp con el mensaje' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/573001234567\?text=/,
  );

  await page.getByText('Confirmar el pedido', { exact: true }).click();
  await expect(
    page.getByText('Salen 2 unidades del inventario y el pedido queda confirmado.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sí, confirmar' }).click();
  await expect(page.getByText('Pedido confirmado.', { exact: false })).toBeVisible();
  expect(confirmados).toEqual([expect.objectContaining({ pedido: 'ped-1045', version: 1 })]);

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  // HU-T9.2 CA2: los datos de la compradora no quedan en los registros de la consola.
  expect(consola.filter((t) => /Compradora|3001234567|Calle de prueba/.test(t))).toEqual([]);
});

/** Un pedido como lo da `GET /pedidos/:id`, de una camisa contra entrega, ya confirmado. */
const pedidoDelPanel = (numero: number, extra: Record<string, unknown> = {}) => ({
  ...filaDePedido(numero, { estado: 'confirmado', formaPago: 'contraentrega', version: 2 }),
  canal: 'whatsapp',
  subtotalCop: 129000,
  descuentoCop: 0,
  envioCop: 0,
  cuponCodigo: null,
  envioNombre: null,
  lineas: [
    {
      variante: 'v-camisa-m-arena',
      nombre: 'Camisa de lino',
      opciones: 'Talla: M · Color: Arena',
      cantidad: 1,
      precioUnitarioCop: 129000,
      totalCop: 129000,
      descontado: true,
    },
  ],
  historia: [] as object[],
  conContacto: false,
  transportadora: null as string | null,
  guia: null as string | null,
  recaudo: null as Record<string, unknown> | null,
  ...extra,
});

/** Los errores de axe de la pantalla, por su nombre: ninguno. */
async function sinFallasDeAxe(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test('HU-T9.4 · CA2: contra entrega, el panel dice cuál falta; con la guía, despacha y nace el recaudo', async ({
  page,
}) => {
  await enElPanel(page);
  const pedido = pedidoDelPanel(1050);
  const despachos: Record<string, unknown>[] = [];
  await page.route(`${PANEL}/api/panel/v1/pedidos/ped-1050`, (r) => r.fulfill({ json: pedido }));
  await page.route(`${PANEL}/api/panel/v1/pedidos/despachar`, (r) => {
    const cuerpo = r.request().postDataJSON() as Record<string, unknown>;
    despachos.push(cuerpo);
    Object.assign(pedido, {
      estado: 'despachado',
      version: 3,
      transportadora: cuerpo['transportadora'],
      guia: cuerpo['guia'],
      recaudo: { estado: 'por_recaudar', montoCop: 129000, comisionCop: 3500, fleteIdaCop: null },
    });
    return r.fulfill({ json: { estado: 'guardado', id: pedido.id, version: 3 } });
  });

  await page.goto(`${PANEL}/pedidos/ped-1050/`);
  await expect(page.getByRole('heading', { level: 2, name: 'Despachar' })).toBeVisible();
  await page.getByRole('button', { name: 'Despachar' }).click();
  // Todos los errores en la misma vuelta, y la API no se llama.
  await expect(page.getByText('Falta corregir 2 cosas:')).toBeVisible();
  await expect(page.getByLabel('Transportadora')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Número de guía')).toHaveAttribute('aria-invalid', 'true');
  expect(despachos).toEqual([]);

  await page.getByLabel('Transportadora').fill('Transportadora Ensayo');
  await page.getByLabel('Número de guía').fill('GE-000123');
  await page.getByLabel(/Comisión del recaudo/).fill('3.500');
  await sinFallasDeAxe(page);
  await page.getByRole('button', { name: 'Despachar' }).click();
  await expect(page.getByText(/La plata queda por recaudar/)).toBeVisible();
  expect(despachos).toEqual([
    expect.objectContaining({
      pedido: 'ped-1050',
      version: 2,
      transportadora: 'Transportadora Ensayo',
      guia: 'GE-000123',
      comisionCop: 3500,
      fleteIdaCop: null,
    }),
  ]);
  await expect(page.getByText('GE-000123')).toBeVisible();
  await expect(page.getByText(/^Por recaudar/)).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Despachar' })).toHaveCount(0);
});

test('HU-T9.5 · aceptación de M2: contra entrega de punta a punta, confirmar, despachar, recaudar y liquidar', async ({
  page,
}) => {
  await enElPanel(page);
  const pedido = pedidoDelPanel(1060, {
    estado: 'pendiente',
    version: 1,
    lineas: [{ ...pedidoDelPanel(1060).lineas[0], descontado: false }],
  });
  const llamadas: string[] = [];
  /** La API falsa lleva el pedido de estado en estado, como la de verdad. */
  const cambio = (ruta: string, hacer: (cuerpo: Record<string, unknown>) => void) =>
    page.route(`${PANEL}/api/panel/v1/${ruta}`, (r) => {
      const cuerpo = r.request().postDataJSON() as Record<string, unknown>;
      llamadas.push(ruta);
      expect(cuerpo['version'] ?? pedido.version).toBe(pedido.version);
      hacer(cuerpo);
      pedido.version += 1;
      return r.fulfill({ json: { estado: 'guardado', id: pedido.id, version: pedido.version } });
    });
  await page.route(`${PANEL}/api/panel/v1/pedidos/ped-1060`, (r) => r.fulfill({ json: pedido }));
  await cambio('pedidos/confirmar', () => Object.assign(pedido, { estado: 'confirmado' }));
  await cambio('pedidos/despachar', (c) =>
    Object.assign(pedido, {
      estado: 'despachado',
      transportadora: c['transportadora'],
      guia: c['guia'],
      recaudo: { estado: 'por_recaudar', montoCop: 129000, netoCop: 117000, liquidacionRef: null },
    }),
  );
  await cambio('pedidos/entregar', () =>
    Object.assign(pedido, {
      estado: 'entregado',
      recaudo: { estado: 'recaudado', montoCop: 129000, netoCop: 117000, liquidacionRef: null },
    }),
  );
  const liquidaciones: unknown[] = [];
  await page.route(`${PANEL}/api/panel/v1/recaudos/liquidar`, (r) => {
    liquidaciones.push(r.request().postDataJSON());
    Object.assign(pedido.recaudo ?? {}, { liquidacionRef: 'LIQ-0001' });
    return r.fulfill({ json: { estado: 'guardado', id: 'LIQ-0001', version: 1 } });
  });
  await page.route(`${PANEL}/api/panel/v1/recaudos`, (r) => {
    const recaudo = pedido.recaudo as { estado: string; liquidacionRef: string | null } | null;
    const fila = {
      pedido: pedido.id,
      numero: 1060,
      estado: recaudo?.estado,
      montoCop: 129000,
      comisionCop: null,
      fleteIdaCop: 12000,
      fleteVueltaCop: null,
      netoCop: 117000,
      transportadora: pedido.transportadora,
      guia: pedido.guia,
      desde: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    };
    const abierta = recaudo && !recaudo.liquidacionRef;
    const sinLiquidar = abierta && recaudo.estado === 'recaudado';
    return r.fulfill({
      json: {
        porRecaudar: { montoCop: 0, cantidad: 0, desde: null },
        sinLiquidar: sinLiquidar
          ? { montoCop: 129000, cantidad: 1, desde: fila.desde }
          : { montoCop: 0, cantidad: 0, desde: null },
        perdidos: { montoCop: 0, cantidad: 0, desde: null },
        recaudos: abierta ? [fila] : [],
      },
    });
  });

  await page.goto(`${PANEL}/pedidos/ped-1060/`);
  await page.getByText('Confirmar el pedido', { exact: true }).click();
  await page.getByRole('button', { name: 'Sí, confirmar' }).click();
  await page.getByLabel('Transportadora').fill('Transportadora Ensayo');
  await page.getByLabel('Número de guía').fill('GE-000777');
  await page.getByRole('button', { name: 'Despachar' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'En camino' })).toBeVisible();
  await page.getByText('Marcar entregado', { exact: true }).click();
  await expect(page.getByText(/cobró \$129\.000: la plata queda recaudada/)).toBeVisible();
  await page.getByRole('button', { name: 'Sí, se entregó' }).click();
  await expect(page.getByText(/^Recaudado: falta que la transportadora lo liquide/)).toBeVisible();

  await page.goto(`${PANEL}/pedidos/recaudos/`);
  await expect(page.getByRole('heading', { level: 1, name: 'Recaudos' })).toBeVisible();
  await expect(page.getByText('1 pedido; el más viejo se cobró hace 2 días.')).toBeVisible();
  await page.getByRole('button', { name: 'Liquidar' }).click();
  await expect(page.getByText('Falta corregir 2 cosas:')).toBeVisible();
  expect(liquidaciones).toEqual([]);
  await page.getByLabel(/#1060/).check();
  await page.getByLabel('Número de la liquidación').fill('LIQ-0001');
  await sinFallasDeAxe(page);
  await page.getByRole('button', { name: 'Liquidar 1 pedido por $129.000' }).click();
  await expect(
    page.getByText('Liquidación LIQ-0001 guardada: 1 pedido por $129.000.'),
  ).toBeVisible();
  expect(liquidaciones).toEqual([
    expect.objectContaining({ pedidos: ['ped-1060'], liquidacionRef: 'LIQ-0001' }),
  ]);
  expect(llamadas).toEqual(['pedidos/confirmar', 'pedidos/despachar', 'pedidos/entregar']);
  await expect(
    page.getByText('La transportadora no te debe nada de lo que ya cobró.'),
  ).toBeVisible();
});

test('HU-T9.5 · CA1: devolver pide si las unidades volvieron y el flete de vuelta', async ({
  page,
}) => {
  await enElPanel(page);
  const pedido = pedidoDelPanel(1061, {
    estado: 'despachado',
    version: 3,
    transportadora: 'Transportadora Ensayo',
    guia: 'GE-1',
    recaudo: { estado: 'por_recaudar', montoCop: 129000, netoCop: 117000, liquidacionRef: null },
  });
  const devoluciones: unknown[] = [];
  await page.route(`${PANEL}/api/panel/v1/pedidos/ped-1061`, (r) => r.fulfill({ json: pedido }));
  await page.route(`${PANEL}/api/panel/v1/pedidos/devolver`, (r) => {
    devoluciones.push(r.request().postDataJSON());
    Object.assign(pedido, { estado: 'devuelto', version: 4 });
    return r.fulfill({ json: { estado: 'guardado', id: pedido.id, version: 4 } });
  });
  await page.goto(`${PANEL}/pedidos/ped-1061/`);
  await page.getByText('Recibir una devolución', { exact: true }).click();
  await page.getByLabel(/Las unidades volvieron/).check();
  await page.getByLabel('Flete de vuelta').fill('10.000');
  await sinFallasDeAxe(page);
  await page.getByRole('button', { name: 'Sí, recibir la devolución' }).click();
  await expect(
    page.getByText('Devolución recibida. Las unidades volvieron al inventario.'),
  ).toBeVisible();
  expect(devoluciones).toEqual([
    expect.objectContaining({
      pedido: 'ped-1061',
      version: 3,
      volvio: true,
      fleteVueltaCop: 10000,
    }),
  ]);
});

test('HU-T9.6 · CA1: anotar un pedido que llegó por teléfono, con todos sus errores en la misma vuelta', async ({
  page,
}) => {
  await enElPanel(page);
  const fila = (variante: string, combinacion: string, stock: number) => ({
    variante,
    producto: 'p-camisa',
    nombre: 'Camisa de lino',
    combinacion,
    sku: null,
    precioCop: 129000,
    stock,
    apartadas: 0,
    esperan: 0,
    version: 1,
  });
  await page.route(`${PANEL}/api/panel/v1/inventario`, (r) =>
    r.fulfill({
      json: {
        filas: [fila('v-camisa-m-arena', 'M / Arena', 4), fila('v-camisa-s-arena', 'S / Arena', 1)],
      },
    }),
  );
  const anotados: Record<string, unknown>[] = [];
  await page.route(`${PANEL}/api/panel/v1/pedidos/anotar`, (r) => {
    anotados.push(r.request().postDataJSON() as Record<string, unknown>);
    return r.fulfill({ json: { estado: 'guardado', id: 'ped-2001', version: 1 } });
  });
  await page.route(`${PANEL}/api/panel/v1/pedidos/ped-2001`, (r) =>
    r.fulfill({
      json: pedidoDelPanel(2001, {
        estado: 'pendiente',
        formaPago: 'efectivo',
        canal: 'panel',
        version: 1,
        totalCop: 266000,
      }),
    }),
  );

  await page.route(`${PANEL}/api/panel/v1/pedidos`, (r) =>
    r.fulfill({ json: { atencion: [], pedidos: [], siguiente: null } }),
  );
  await page.goto(`${PANEL}/pedidos/`);
  await page.getByRole('link', { name: 'Anotar un pedido' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Anotar un pedido' })).toBeVisible();
  await page.getByRole('button', { name: 'Anotar el pedido' }).click();
  await expect(page.getByText('Falta corregir 2 cosas:')).toBeVisible();
  expect(anotados).toEqual([]);

  await page.getByLabel(/M \/ Arena/).fill('2');
  await page.getByLabel('Cómo paga').selectOption('efectivo');
  await page.getByLabel(/^Envío/).fill('8.000');
  await page.getByLabel(/^Nombre/).fill('Ensayo Dos Compradora');
  await expect(page.getByText('Total: $266.000')).toBeVisible();
  await sinFallasDeAxe(page);
  await page.getByRole('button', { name: 'Anotar el pedido' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pedido #2001' })).toBeVisible();
  await expect(page.getByText('Se anotó en el panel')).toBeVisible();
  expect(anotados).toEqual([
    expect.objectContaining({
      lineas: [{ variante: 'v-camisa-m-arena', cantidad: 2 }],
      formaPago: 'efectivo',
      envioCop: 8000,
      contacto: { nombre: 'Ensayo Dos Compradora' },
    }),
  ]);
});

test('HU-T9.6 · CA1 y CA2: una nota, un enlace nuevo y cancelar preguntando si las unidades vuelven', async ({
  page,
}) => {
  await enElPanel(page);
  const pedido = pedidoDelPanel(1070, { formaPago: 'transferencia' });
  const pedidos: Record<string, unknown[]> = { nota: [], enlace: [], cancelar: [] };
  await page.route(`${PANEL}/api/panel/v1/pedidos/ped-1070`, (r) => r.fulfill({ json: pedido }));
  await page.route(`${PANEL}/api/panel/v1/pedidos/nota`, (r) => {
    const cuerpo = r.request().postDataJSON() as { texto: string };
    pedidos['nota']?.push(cuerpo);
    pedido.historia.push({
      instante: '2026-10-15T16:00:00.000Z',
      tipo: 'nota',
      de: null,
      a: null,
      quien: 'Tú',
      nota: cuerpo.texto,
    });
    return r.fulfill({ json: { estado: 'guardado', id: pedido.id, version: 2 } });
  });
  await page.route(`${PANEL}/api/panel/v1/pedidos/enlace`, (r) => {
    pedidos['enlace']?.push(r.request().postDataJSON());
    return r.fulfill({
      json: {
        estado: 'ok',
        enlace:
          'https://ensayo-uno--staging.laboratorio-digital.app/pedido/#c=ABC123&s=SecretoNuevoDePrueba01',
      },
    });
  });
  await page.route(`${PANEL}/api/panel/v1/pedidos/cancelar`, (r) => {
    pedidos['cancelar']?.push(r.request().postDataJSON());
    Object.assign(pedido, { estado: 'cancelado', version: 3 });
    return r.fulfill({ json: { estado: 'guardado', id: pedido.id, version: 3 } });
  });

  await page.goto(`${PANEL}/pedidos/ped-1070/`);
  await page.getByLabel('Agregar una nota').fill('Llamar antes de las 5');
  await page.getByRole('button', { name: 'Guardar la nota' }).click();
  await expect(page.getByText('Tú: «Llamar antes de las 5»')).toBeVisible();

  await page.getByText('Hacer un enlace de seguimiento nuevo', { exact: true }).click();
  await expect(page.getByText(/El que tenía antes deja de servir/)).toBeVisible();
  await page.getByRole('button', { name: 'Sí, hacer uno nuevo' }).click();
  await expect(page.getByText('Este es el enlace nuevo; el de antes ya no sirve.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mandarlo por WhatsApp' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/\?text=.*SecretoNuevoDePrueba01/,
  );

  await page.getByText('Cancelar el pedido', { exact: true }).click();
  await expect(page.getByLabel(/vuelven al inventario/)).toBeChecked();
  await sinFallasDeAxe(page);
  await page.getByRole('button', { name: 'Sí, cancelar el pedido' }).click();
  await expect(
    page.getByText('Pedido cancelado. Las unidades volvieron al inventario.'),
  ).toBeVisible();
  expect(pedidos['cancelar']).toEqual([
    expect.objectContaining({ pedido: 'ped-1070', version: 2, volvio: true }),
  ]);
  await expect(page.getByText('Cancelar el pedido', { exact: true })).toHaveCount(0);
});

test('HU-T10.1 · CA1 y CA2: un envío de 45 días lo avisa, y un cupón dice sus usos y si se agotó', async ({
  page,
}) => {
  await enElPanel(page);
  const venta = {
    envios: [
      {
        id: 'e-medellin',
        nombre: 'Medellín',
        precioCop: 8000,
        gratisDesdeCop: 150000,
        ciudades: ['Medellín', 'Envigado'],
        diasMin: 1,
        diasMax: 2,
        activa: true,
        version: 1,
        plazo: 'llega en 1 a 2 días',
      },
    ],
    cupones: [
      {
        codigo: 'CINCUENTA',
        tipo: 'porcentaje',
        valor: 10,
        minimoCop: 0,
        desde: null,
        hasta: '2026-10-31',
        usosMaximos: 50,
        usos: 50,
        activo: true,
        version: 3,
      },
    ],
  };
  await page.route(`${PANEL}/api/panel/v1/venta`, (r) => r.fulfill({ json: venta }));
  const guardados: Record<string, Record<string, unknown>[]> = { envios: [], cupones: [] };
  await page.route(`${PANEL}/api/panel/v1/*/guardar`, (r) => {
    const que = new URL(r.request().url()).pathname.split('/')[4] ?? '';
    guardados[que]?.push(r.request().postDataJSON() as Record<string, unknown>);
    return r.fulfill({ json: { estado: 'guardado', id: 'x', version: 1 } });
  });

  await page.goto(`${PANEL}/mas/`);
  await page.getByRole('link', { name: 'Envíos y cupones' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Envíos y cupones' })).toBeVisible();
  await expect(page.getByText('en Medellín, Envigado · llega en 1 a 2 días')).toBeVisible();
  await expect(page.getByText('agotado: 50 de 50 usos')).toBeVisible();
  await sinFallasDeAxe(page);

  await page.getByRole('link', { name: 'Agregar un envío' }).click();
  await page.getByRole('button', { name: 'Guardar el envío' }).click();
  await expect(page.getByText('Falta corregir 2 cosas:')).toBeVisible();
  await page.getByLabel(/^Nombre/).fill('Bodega');
  await page.getByLabel(/^Precio/).fill('40.000');
  await page.getByLabel(/como mínimo/).fill('35');
  await page.getByLabel(/como máximo/).fill('45');
  await expect(page.getByText('Pasa de 30 días calendario')).toBeVisible();
  await sinFallasDeAxe(page);
  await page.getByRole('button', { name: 'Guardar el envío' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Envíos y cupones' })).toBeVisible();
  expect(guardados['envios']).toEqual([
    expect.objectContaining({
      nombre: 'Bodega',
      precioCop: 40000,
      gratisDesdeCop: null,
      ciudades: null,
      diasMin: 35,
      diasMax: 45,
      activa: true,
    }),
  ]);

  await page.getByRole('link', { name: 'Crear un cupón' }).click();
  await page.getByLabel(/^Código/).fill('bienvenida');
  await page.getByLabel('Un porcentaje').check();
  await page.getByLabel(/^Porcentaje/).fill('150');
  await page.getByLabel(/^Vale desde/).fill('2026-11-01');
  await page.getByLabel(/^Vale hasta/).fill('2026-10-01');
  await page.getByRole('button', { name: 'Guardar el cupón' }).click();
  await expect(page.getByText('Falta corregir 2 cosas:')).toBeVisible();
  expect(guardados['cupones']).toEqual([]);
  await page.getByLabel(/^Porcentaje/).fill('15');
  await page.getByLabel(/^Vale hasta/).fill('2026-11-30');
  await page.getByLabel(/Cuántas veces/).fill('50');
  await sinFallasDeAxe(page);
  await page.getByRole('button', { name: 'Guardar el cupón' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Envíos y cupones' })).toBeVisible();
  expect(guardados['cupones']).toEqual([
    expect.objectContaining({
      codigo: 'BIENVENIDA',
      tipo: 'porcentaje',
      valor: 15,
      desde: '2026-11-01',
      hasta: '2026-11-30',
      usosMaximos: 50,
    }),
  ]);
});

test('HU-T10.4 · CA1 y CA2: publicar dice todo lo que falta; las versiones y volver a una anterior', async ({
  page,
}) => {
  await enElPanel(page);
  const version = (n: number, estado: string, extra: Record<string, unknown> = {}) => ({
    version: n,
    estado,
    autor: 'Tú',
    automatica: false,
    pedida: `2026-10-1${n}T15:00:00.000Z`,
    publicada: `2026-10-1${n}T15:00:05.000Z`,
    archivos: 30 + n,
    motivo: null,
    ...extra,
  });
  let datos = {
    versionPublicada: 2,
    versiones: [
      version(2, 'publicada'),
      version(1, 'reemplazada', { autor: 'Otra persona del equipo' }),
    ],
  };
  await page.route(`${PANEL}/api/panel/v1/publicaciones`, (r) => r.fulfill({ json: datos }));
  const respuestas = [
    {
      status: 422,
      json: {
        estado: 'compuerta',
        fallas: [
          {
            codigo: 'dato-faltante',
            mensaje: 'Escribe el WhatsApp donde recibes los pedidos',
            donde: 'Ajustes › Contacto',
          },
          { codigo: 'sin-foto', mensaje: 'Sube una foto de «Camisa de lino»', donde: 'Productos' },
        ],
      },
    },
    { status: 200, json: { estado: 'publicada', version: 3, archivos: 33, nuevos: 4 } },
  ];
  await page.route(`${PANEL}/api/panel/v1/publicar`, (r) => {
    const siguiente = respuestas.shift();
    if (siguiente?.status === 200)
      datos = {
        versionPublicada: 3,
        versiones: [
          version(3, 'publicada'),
          version(2, 'reemplazada'),
          ...datos.versiones.slice(1),
        ],
      };
    return r.fulfill(siguiente ?? { status: 500, json: {} });
  });
  const vueltas: unknown[] = [];
  await page.route(`${PANEL}/api/panel/v1/publicaciones/volver`, (r) => {
    vueltas.push(r.request().postDataJSON());
    datos = {
      versionPublicada: 1,
      versiones: [version(3, 'reemplazada'), version(2, 'reemplazada'), version(1, 'publicada')],
    };
    return r.fulfill({ json: { estado: 'publicada', version: 1, antes: 3 } });
  });

  await page.goto(`${PANEL}/mas/`);
  await page.getByRole('link', { name: 'Publicar y versiones' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Publicar' })).toBeVisible();
  await expect(page.getByText('La que ve la tienda · 32 archivos')).toBeVisible();
  await expect(page.getByText(/Otra persona del equipo/)).toBeVisible();

  await page.getByRole('button', { name: 'Publicar los cambios' }).click();
  await expect(page.getByText('Antes de publicar, corrige 2 cosas.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ajustes › Contacto' })).toHaveAttribute(
    'href',
    '/mas/ajustes/contacto/',
  );
  await expect(page.getByText('Sube una foto de «Camisa de lino»')).toBeVisible();
  await sinFallasDeAxe(page);

  await page.getByRole('button', { name: 'Publicar los cambios' }).click();
  await expect(page.getByText('Publicaste la versión 3')).toBeVisible();
  await expect(page.getByText('Antes de publicar, corrige 2 cosas.')).toHaveCount(0);

  await page.getByText('Volver a la versión 1', { exact: true }).click();
  await page.getByRole('button', { name: 'Sí, volver a la versión 1' }).click();
  await expect(page.getByText('La tienda volvió a la versión 1')).toBeVisible();
  await expect(
    page.getByText('Los pedidos y el inventario no cambian.', { exact: false }).first(),
  ).toBeVisible();
  expect(vueltas).toEqual([{ version: 1 }]);
  await expect(page.getByText('Volver a la versión 3', { exact: true })).toBeVisible();
  await sinFallasDeAxe(page);
});

test('HU-T10.3 · CA2 y CA3: cambiar el WhatsApp pide volver a entrar sin perder lo escrito, y se verifica', async ({
  page,
}) => {
  await enElPanel(page);
  const contacto = {
    datos: {
      whatsapp: '+573000000001',
      whatsappVerificado: true,
      correo: 'ensayo-uno@ejemplo.test',
    } as Record<string, unknown>,
    version: 3,
  };
  const ajustes = () => ({
    secciones: {
      identidad: { datos: { nombre: 'Comercio Ensayo Uno' }, version: 1 },
      contacto,
      legal: { datos: { tipoPersona: 'juridica' }, version: 1 },
    },
    faltantes:
      contacto.datos['whatsappVerificado'] === true
        ? ['legal.razonSocial']
        : ['legal.razonSocial', 'contacto.whatsappVerificado'],
  });
  const guardados: { version: number; datos: Record<string, unknown> }[] = [];
  const verificados: unknown[] = [];
  await page.route(`${PANEL}/api/panel/v1/ajustes`, (r) => r.fulfill({ json: ajustes() }));
  await page.route(`${PANEL}/api/panel/v1/ajustes/guardar`, (r) => {
    const cuerpo = r.request().postDataJSON() as (typeof guardados)[number];
    guardados.push(cuerpo);
    // La primera vez entró hace más de 10 minutos.
    if (guardados.length === 1)
      return r.fulfill({
        status: 401,
        json: {
          estado: 'reautenticar',
          motivo: 'Para cambiar esto, vuelve a entrar con Google.',
        },
      });
    contacto.datos = { ...cuerpo.datos, whatsappVerificado: false };
    contacto.version = 4;
    return r.fulfill({ json: { estado: 'guardado', id: 'contacto', version: 4 } });
  });
  await page.route(`${PANEL}/api/panel/v1/ajustes/verificar-whatsapp`, (r) => {
    verificados.push(r.request().postDataJSON());
    contacto.datos = { ...contacto.datos, whatsappVerificado: true };
    contacto.version = 5;
    return r.fulfill({ json: { estado: 'guardado', id: 'contacto', version: 5 } });
  });
  await page.context().route('https://wa.me/**', (r) => r.fulfill({ body: 'chat de prueba' }));

  await page.goto(`${PANEL}/mas/`);
  await page.getByRole('link', { name: 'Ajustes de la tienda' }).click();
  await expect(page.getByText('Falta 1 dato para publicar')).toBeVisible();
  await expect(page.getByText('Datos legales: Razón social o nombre completo')).toBeVisible();
  await page.getByRole('link', { name: /Contacto/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Contacto' })).toBeVisible();
  await expect(page.getByText('Tu WhatsApp está verificado')).toBeVisible();

  await page.getByLabel('WhatsApp de la tienda').fill('300 999 8877');
  await page.getByRole('button', { name: 'Guardar contacto' }).click();
  const dialogo = page.getByRole('alertdialog', { name: 'Vuelve a entrar' });
  await expect(dialogo).toContainText('Para cambiar esto, vuelve a entrar con Google.');

  // CA2: vuelve de Google a la misma pantalla, con lo que había escrito.
  await dialogo.getByRole('button', { name: 'Entrar con Google' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Contacto' })).toBeVisible();
  expect(page.url()).toBe(`${PANEL}/mas/ajustes/contacto/`);
  await expect(page.getByLabel('WhatsApp de la tienda')).toHaveValue('300 999 8877');
  await page.getByRole('button', { name: 'Guardar contacto' }).click();
  await expect(page.getByText('Guardamos contacto.')).toBeVisible();
  expect(guardados).toHaveLength(2);
  for (const g of guardados) {
    expect(g).toMatchObject({ version: 3, datos: { whatsapp: '+573009998877' } });
    expect(g.datos).not.toHaveProperty('whatsappVerificado');
  }

  // CA3: sin verificar hasta abrir el chat de prueba y decir que es el propio.
  await expect(page.getByText('Tu WhatsApp está sin verificar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sí, es mi WhatsApp' })).toHaveCount(0);
  const chat = page.getByRole('link', { name: 'Abrir el chat de prueba' });
  await expect(chat).toHaveAttribute('href', /^https:\/\/wa\.me\/573009998877\?text=/);
  const [ventana] = await Promise.all([page.waitForEvent('popup'), chat.click()]);
  await ventana.close();
  await page.getByRole('button', { name: 'Sí, es mi WhatsApp' }).click();
  await expect(page.getByText('Tu WhatsApp quedó verificado.')).toBeVisible();
  expect(verificados).toEqual([expect.objectContaining({ version: 4 })]);

  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(360);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('HU-T10.5 · CA1: el propietario invita por WhatsApp; quien recibe entra con Google y se une', async ({
  page,
}) => {
  await enElPanel(page);
  const CODIGO = 'codigo-de-ensayo-t105';
  const creadas: unknown[] = [];
  await page.route(`${CORE}/api/core/invitaciones`, (r) => {
    creadas.push(r.request().postDataJSON());
    return r.fulfill({
      status: 201,
      json: { codigo: CODIGO, rol: 'colaborador', expira: '2026-10-22T15:00:00.000Z' },
      headers: CORS,
    });
  });
  await page.goto(`${PANEL}/mas/`);
  await page.getByRole('link', { name: 'Equipo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Equipo' })).toBeVisible();
  await expect(page.getByText(/No puede cambiar el cobro, el dominio, el plan/)).toBeVisible();
  await page.getByRole('button', { name: 'Invitar a un colaborador' }).click();
  const whatsapp = page.getByRole('link', { name: 'Mandar por WhatsApp' });
  await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/);
  expect(creadas).toEqual([{ rol: 'colaborador' }]);
  const mensaje =
    new URL((await whatsapp.getAttribute('href')) ?? '').searchParams.get('text') ?? '';
  const enlace = `${PANEL}/unirme/#invitacion=${CODIGO}`;
  expect(mensaje).toContain(`tienda Comercio Ensayo Uno`);
  expect(mensaje).toContain(enlace);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // Quien recibe abre el enlace sin sesión y entra con una cuenta que todavía no tiene tienda.
  await page.goto(`${PANEL}/mas/`);
  await page.getByRole('button', { name: 'Salir de la cuenta en este teléfono' }).click();
  // Salir borra la sesión del teléfono sin esperar a nadie: abrir el enlace antes la encuentra.
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();
  await page.route(`${CORE}/api/core/auth/canje`, (r) =>
    r.fulfill({ json: sesion({ organizaciones: [], org_id: null }), headers: CORS }),
  );
  await page.route(`${PANEL}/api/panel/v1/yo`, (r) => r.fulfill({ json: yo(DOS) }));
  const vistas: { codigo: unknown; auth: string | undefined }[] = [];
  await page.route(`${CORE}/api/core/invitaciones/ver`, (r) => {
    vistas.push({
      codigo: (r.request().postDataJSON() as { codigo: unknown }).codigo,
      auth: r.request().headers()['authorization'],
    });
    return r.fulfill({
      json: {
        estado: 'vigente',
        finca: 'Comercio Ensayo Dos',
        rol: 'colaborador',
        invita: 'Ensayo Uno',
        expira: '2026-10-22T15:00:00.000Z',
      },
      headers: CORS,
    });
  });
  const aceptadas: { codigo: unknown; auth: string | undefined }[] = [];
  await page.route(`${CORE}/api/core/invitaciones/aceptar`, (r) => {
    aceptadas.push({
      codigo: (r.request().postDataJSON() as { codigo: unknown }).codigo,
      auth: r.request().headers()['authorization'],
    });
    return r.fulfill({
      json: { org_id: DOS.org_id, finca: 'Comercio Ensayo Dos', rol: 'colaborador' },
      headers: CORS,
    });
  });

  await page.goto(enlace);
  await expect(
    page.getByText('Ensayo Uno te invitó a Comercio Ensayo Dos como colaborador.'),
  ).toBeVisible();
  // El código sale de la barra antes de cualquier pedido, y va en el cuerpo, sin sesión.
  expect(page.url()).toBe(`${PANEL}/unirme/`);
  expect(vistas).toEqual([{ codigo: CODIGO, auth: undefined }]);
  await page.getByLabel(/Leí y acepto la política de tratamiento de datos/).check();
  await page.getByRole('button', { name: 'Entrar con Google para unirme' }).click();

  // Vuelve de Google a «Unirme», con el código guardado en el teléfono.
  await page.getByRole('button', { name: 'Unirme a Comercio Ensayo Dos' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Comercio Ensayo Dos' })).toBeVisible();
  expect(page.url()).toBe(`${PANEL}/`);
  expect(aceptadas).toEqual([{ codigo: CODIGO, auth: `Bearer ${token('tienda')}` }]);
  await expect(page.locator('.barra')).toContainText('Colaborador');
});

test('HU-T10.5 · aceptación de M2: el colaborador sin equipo ni cobro, el modo sin cambiar, y el 403 dicho', async ({
  page,
}) => {
  await coreFalso(page, sesion({ organizaciones: [DOS], org_id: DOS.org_id }));
  await apiFalsa(page, DOS);
  const venta = {
    datos: {
      modo: 'whatsapp',
      formas: ['contraentrega', 'transferencia'],
      abierta: true,
      pedidoMinimoCop: 20000,
    } as Record<string, unknown>,
    version: 2,
  };
  // Como la API: al colaborador no le manda el cobro.
  await page.route(`${PANEL}/api/panel/v1/ajustes`, (r) =>
    r.fulfill({
      json: {
        secciones: { identidad: { datos: { nombre: 'Comercio Ensayo Dos' }, version: 1 }, venta },
        faltantes: [],
      },
    }),
  );
  const guardados: { datos: Record<string, unknown> }[] = [];
  await page.route(`${PANEL}/api/panel/v1/ajustes/guardar`, (r) => {
    const cuerpo = r.request().postDataJSON() as { datos: Record<string, unknown> };
    guardados.push(cuerpo);
    // La segunda vez, el propietario ya le había quitado el permiso: la API decide.
    if (guardados.length === 2)
      return r.fulfill({
        status: 403,
        json: { estado: 'prohibido', motivo: 'Tu rol no puede cambiar esta parte de los ajustes.' },
      });
    venta.datos = cuerpo.datos;
    venta.version += 1;
    return r.fulfill({ json: { estado: 'guardado', id: 'venta', version: venta.version } });
  });
  await page.goto(`${PANEL}/`);
  await entrar(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Comercio Ensayo Dos' })).toBeVisible();

  // CA2: «Más» no ofrece el equipo; abierto directo, tampoco.
  await page.getByRole('link', { name: 'Más' }).click();
  await expect(page.getByRole('link', { name: 'Ajustes de la tienda' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Equipo' })).toHaveCount(0);
  await page.goto(`${PANEL}/mas/equipo/`);
  await expect(page.getByText('Solo quien administra la tienda maneja el equipo.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Invitar a un colaborador' })).toHaveCount(0);

  // Ajustes sin cobro; en la venta, el modo se ve pero no se cambia.
  await page.goto(`${PANEL}/mas/ajustes/`);
  await expect(page.getByRole('link', { name: /Venta/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Cobro/ })).toHaveCount(0);
  await page.getByRole('link', { name: /Venta/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Venta' })).toBeVisible();
  await expect(page.getByText('Lo cambia quien administra la tienda.')).toBeVisible();
  await expect(page.getByText('Por WhatsApp', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Las dos' })).toHaveCount(0);

  // Lo del día a día sí, y el modo viaja como estaba.
  await page.getByLabel('Pedido mínimo').fill('30000');
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(page.getByText('Guardamos venta.')).toBeVisible();
  expect(guardados[0]?.datos).toMatchObject({ modo: 'whatsapp', pedidoMinimoCop: 30000 });

  // CA3 ❌: si la API dice que no, lo dice en palabras y nada se da por guardado.
  await page.getByLabel('Pedido mínimo').fill('35000');
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(
    page.getByText('Tu rol no puede cambiar esta parte de los ajustes.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('No se guardó')).toBeVisible();
  expect(venta.datos['pedidoMinimoCop']).toBe(30000);

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
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

test('HU-T9.7 · CA1 y CA3: la vencida arriba y en rojo; responder, mandarla y solo entonces cerrar', async ({
  page,
}) => {
  await enElPanel(page);
  const fila = (o: Record<string, unknown>) => ({
    tipo: 'Queja',
    tipoId: 'queja',
    estado: 'radicada',
    creada: '2026-10-01T15:00:00.000Z',
    respondida: null as string | null,
    cerrada: null as string | null,
    pedido: null,
    alerta: null,
    reloj: 'respuesta',
    ...o,
  });
  const vencida = fila({
    id: 's-3',
    radicado: 'R-3',
    vence: '2026-10-13',
    dias: -2,
    alerta: 'vencida',
    pedido: 1050,
  });
  const lista = {
    solicitudes: [
      vencida,
      fila({
        id: 's-5',
        radicado: 'R-5',
        tipo: 'Retracto',
        tipoId: 'retracto',
        vence: '2026-10-18',
        dias: 3,
        alerta: 'pronto',
        reloj: 'reembolso',
      }),
      fila({
        id: 's-6',
        radicado: 'R-6',
        tipo: 'Consulta de datos',
        tipoId: 'datos_consulta',
        vence: '2026-10-25',
        dias: 10,
      }),
      fila({
        id: 's-2',
        radicado: 'R-2',
        estado: 'respondida',
        vence: '2026-10-20',
        dias: 5,
        respondida: '2026-10-14T15:00:00.000Z',
      }),
    ],
    reembolsos: [
      {
        pedidoId: 'ped-1061',
        pedido: 1061,
        aprobado: '2026-09-30T15:00:00.000Z',
        vence: '2026-10-15',
        dias: 0,
        alerta: 'hoy',
      },
    ],
  };
  const detalle = {
    estado: 'ok',
    solicitud: vencida,
    contacto: '3001234567',
    texto: 'La camisa llegó con una costura abierta en la manga.',
    codigoDelPedido: 'K7M2Q9',
    respuesta: null as { texto: string; instante: string } | null,
  };
  const llamadas: Record<string, unknown>[] = [];
  await page.route(`${PANEL}/api/panel/v1/pedidos`, (r) =>
    r.fulfill({ json: { atencion: [], pedidos: [], siguiente: null } }),
  );
  await page.route(`${PANEL}/api/panel/v1/solicitudes`, (r) => r.fulfill({ json: lista }));
  await page.route(`${PANEL}/api/panel/v1/solicitudes/ver`, (r) => {
    expect(r.request().postDataJSON()).toEqual({ id: 's-3' });
    return r.fulfill({ json: detalle });
  });
  await page.route(`${PANEL}/api/panel/v1/solicitudes/responder`, (r) => {
    const cuerpo = r.request().postDataJSON() as { respuesta: string };
    llamadas.push({ ruta: 'responder', ...cuerpo });
    detalle.respuesta = { texto: cuerpo.respuesta, instante: '2026-10-15T15:00:00.000Z' };
    detalle.solicitud = {
      ...vencida,
      estado: 'respondida',
      alerta: null,
      respondida: '2026-10-15T15:00:00.000Z',
    };
    return r.fulfill({ json: { estado: 'guardado', id: 's-3', version: null } });
  });
  await page.route(`${PANEL}/api/panel/v1/solicitudes/cerrar`, (r) => {
    llamadas.push({ ruta: 'cerrar', ...(r.request().postDataJSON() as object) });
    detalle.solicitud = {
      ...detalle.solicitud,
      estado: 'cerrada',
      cerrada: '2026-10-15T15:05:00.000Z',
    };
    return r.fulfill({ json: { estado: 'guardado', id: 's-3', version: null } });
  });

  await page.getByRole('link', { name: 'Pedidos', exact: true }).click();
  await page.getByRole('link', { name: 'Solicitudes' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Solicitudes' })).toBeVisible();
  await expect(page.getByText('Una solicitud venció')).toBeVisible();
  // CA3: la vencida va primero entre las que esperan, en rojo y dicho en palabras.
  const primera = page.getByRole('listitem').filter({ hasText: /^R-/ }).first();
  await expect(primera).toContainText('R-3');
  await expect(primera).toContainText('Venció hace 2 días, sin respuesta');
  await expect(primera).toHaveClass(/solicitud--vencida/);
  await expect(primera.locator('.vence--mal')).toHaveCount(1);
  // CA1: a 3 días avisa; el retracto dice que corre el reembolso; el pago sin existencias, el suyo.
  await expect(page.getByText('Vence en 3 días, el 18 de octubre')).toBeVisible();
  await expect(page.getByText(/retracto: el reembolso corre/)).toBeVisible();
  await expect(page.getByText('Vence hoy: reembolsar antes de que acabe el día')).toBeVisible();
  await sinFallasDeAxe(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await page.getByRole('link', { name: /R-3/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /R-3/ })).toBeVisible();
  await expect(
    page.getByText('La camisa llegó con una costura abierta en la manga.'),
  ).toBeVisible();
  // ❌ CA3: sin respuesta no hay cómo cerrarla.
  await expect(page.getByText('Cerrar la solicitud')).toHaveCount(0);
  await page.getByRole('button', { name: 'Guardar la respuesta' }).click();
  await expect(page.getByLabel('Tu respuesta')).toHaveAttribute('aria-invalid', 'true');
  expect(llamadas).toEqual([]);
  await sinFallasDeAxe(page);

  await page
    .getByLabel('Tu respuesta')
    .fill('Te mandamos otra camisa esta semana; la guía te llega por WhatsApp.');
  await page.getByRole('button', { name: 'Guardar la respuesta' }).click();
  await expect(page.getByText('Respuesta guardada. Ahora mándasela a la persona.')).toBeVisible();
  const mandar = page.getByRole('link', { name: 'Mandarla por WhatsApp' });
  await expect(mandar).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/573001234567\?text=Respuesta%20a%20tu%20solicitud%20R-3/,
  );
  await page.getByText('Cerrar la solicitud').click();
  await page.getByRole('button', { name: 'Sí, cerrarla' }).click();
  await expect(page.getByText('Solicitud cerrada.')).toBeVisible();
  await expect(page.getByText('Cerrar la solicitud')).toHaveCount(0);
  expect(llamadas).toEqual([
    expect.objectContaining({
      ruta: 'responder',
      id: 's-3',
      respuesta: 'Te mandamos otra camisa esta semana; la guía te llega por WhatsApp.',
    }),
    expect.objectContaining({ ruta: 'cerrar', id: 's-3' }),
  ]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('HU-T14.2 · CA1: Inicio dice lo urgente arriba, cómo voy frente a febrero entero y el margen', async ({
  page,
}) => {
  await coreFalso(page, sesion());
  await apiFalsa(page);
  await page.route(`${PANEL}/api/panel/v1/tablero`, (r) =>
    r.fulfill({
      json: {
        ...tableroVacio(),
        periodos: { altura: '2028-02-29', anteriorCompleto: true },
        hoy: { pedidos: 3, vendidos: 1, ventasCop: 100000, ticketCop: 100000, tasaDeCierre: 1 / 3 },
        mes: { pedidos: 8, vendidos: 5, ventasCop: 440000, ticketCop: 88000, tasaDeCierre: 5 / 8 },
        anterior: {
          pedidos: 3,
          vendidos: 2,
          ventasCop: 120000,
          ticketCop: 60000,
          tasaDeCierre: 2 / 3,
        },
        pendientes: {
          ...tableroVacio().pendientes,
          porConfirmar: 1,
          porDespachar: 4,
          recaudosAtrasados: 1,
          solicitudesVencidas: 1,
          agotados: 1,
        },
        contraentrega: {
          cerrados: 3,
          devueltos: 1,
          cobradoCop: 190000,
          costosCop: 43500,
          netoCop: 146500,
          sinCostos: 1,
          enCamino: 1,
        },
      },
    }),
  );
  await page.goto(`${PANEL}/`);
  await entrar(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Lo que hay que hacer' })).toBeVisible();
  const pendientes = page.locator('.pendientes li');
  await expect(pendientes.first()).toHaveText('1 solicitud vencida sin respuesta');
  await expect(pendientes.first()).toHaveClass(/pendiente--urgente/);
  await expect(pendientes).toHaveText([
    '1 solicitud vencida sin respuesta',
    '1 recaudo sin liquidar hace más de 3 días hábiles',
    '1 pedido por confirmar',
    '4 pedidos por despachar',
    '1 combinación agotada',
  ]);
  // CA3: el 31 de marzo no existe en febrero, y lo dice.
  await expect(page.getByText(/Sube 267 %/)).toBeVisible();
  await expect(page.getByText(/frente a febrero entero/)).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: 'El mes anterior (febrero entero)' }),
  ).toBeVisible();
  await expect(page.getByText('$440.000')).toBeVisible();
  await expect(page.getByText('77 %')).toBeVisible();
  await expect(page.getByText(/A 1 pedido le falta la comisión o el flete/)).toBeVisible();
  await sinFallasDeAxe(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await pendientes.first().getByRole('link').click();
  await expect(page).toHaveURL(`${PANEL}/pedidos/solicitudes/`);
});

test('HU-T14.2 · ❌ si el tablero no llega, lo dice sin inventar ceros', async ({ page }) => {
  await coreFalso(page, sesion());
  await apiFalsa(page);
  await page.route(`${PANEL}/api/panel/v1/tablero`, (r) =>
    r.fulfill({ status: 503, json: { estado: 'error', motivo: 'La tienda no responde ahora.' } }),
  );
  await page.goto(`${PANEL}/`);
  await entrar(page);
  await expect(page.getByText('No pudimos leer el tablero')).toBeVisible();
  await expect(page.getByText('$0')).toHaveCount(0);
  await expect(page.getByText('Productos en tu plan')).toBeVisible();
});
