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
