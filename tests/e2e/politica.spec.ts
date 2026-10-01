/**
 * La política de datos dice la verdad sobre lo que la app hace (HU-E0.5, CA2; bitácora ecommerce
 * 112). Se abre cada página en un navegador de verdad y se compara con lo que declara
 * `content/agro/privacidad/politica.json`: scripts de terceros, cookies y a dónde se conecta el
 * cuaderno. Si alguien agrega un script de medición sin cambiar la política, esta prueba falla.
 */
import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { conexionesDelCuaderno } from '../../scripts/lib/cabeceras.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';

const politica = JSON.parse(readFileSync('content/agro/privacidad/politica.json', 'utf8')) as {
  version: string;
  estado: string;
  revision: string;
  scripts_de_terceros: string[];
  cookies: { nombre: string }[];
  encargados: { quien: string; proveedor: string }[];
};

const PAGINAS = [
  '/herramientas/agro/',
  '/herramientas/agro/calculadora-dpv/',
  '/agro/privacidad/',
  '/agro/app/',
];

/** Abre la página y devuelve los orígenes de todo lo que pidió y de sus scripts. */
async function visitar(page: Page, ruta: string) {
  const origenes = new Set<string>();
  page.on('request', (r) => origenes.add(new URL(r.url()).origin));
  await page.goto(ruta);
  await page.waitForLoadState('networkidle');
  const scripts = await page
    .locator('script[src]')
    .evaluateAll((ss) =>
      ss.map((s) => new URL((s as HTMLScriptElement).src, location.href).origin),
    );
  return { origenes, scripts, propio: new URL(page.url()).origin };
}

for (const ruta of PAGINAS) {
  test(`${ruta}: ningún script ni pedido de terceros que la política no declare`, async ({
    page,
  }) => {
    const { origenes, scripts, propio } = await visitar(page, ruta);
    const ajenos = [...new Set([...origenes, ...scripts])].filter((o) => o !== propio);
    expect(ajenos).toEqual(politica.scripts_de_terceros);
  });

  test(`${ruta}: no deja cookies (la única cookie de la política es del servidor de cuentas)`, async ({
    page,
    context,
  }) => {
    await visitar(page, ruta);
    expect(await context.cookies()).toEqual([]);
    expect(politica.cookies.map((c) => c.nombre)).toEqual(['agro_oauth']);
  });
}

test('la CSP del cuaderno solo deja conectarse a la nube que nombra la política', async ({
  page,
}) => {
  const respuesta = await page.goto('/agro/app/');
  const csp = respuesta?.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toContain('unsafe-inline');
  const conectar = /connect-src ([^;]+)/.exec(csp)?.[1]?.split(' ') ?? [];
  expect(conectar).toEqual(["'self'", ...conexionesDelCuaderno(cargarCeldas())]);
  // Esas direcciones son del proveedor de la nube que la política cuenta como aliado.
  expect(politica.encargados.map((e) => e.proveedor)).toContain('Cloudflare, Inc.');
});

test('la página de la política existe, dice su versión y, mientras sea borrador, lo dice y no se indexa', async ({
  page,
}) => {
  await page.goto('/agro/privacidad/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Política de tratamiento de datos',
  );
  await expect(page.getByText(`Versión ${politica.version}`)).toBeVisible();
  for (const e of politica.encargados) {
    await expect(page.locator('[data-prueba="politica-encargados"]')).toContainText(e.quien);
  }
  // Lenguaje de finca, sin detalles técnicos ni de cómo está hecho (revisión del dueño, 1 oct 2026).
  const texto = (await page.locator('main').textContent()) ?? '';
  for (const tecnico of [
    'Cloudflare',
    'agro_oauth',
    'IndexedDB',
    'Worker',
    'D1',
    'token',
    'servidor de cuentas',
  ]) {
    expect(texto, tecnico).not.toContain(tecnico);
  }
  if (politica.estado !== 'vigente') {
    await expect(page.locator('[data-prueba="politica-borrador"]')).toContainText(
      politica.revision,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  }
});

test('las calculadoras enlazan la política', async ({ page }) => {
  await page.goto('/herramientas/agro/calculadora-dpv/');
  await expect(
    page.getByRole('link', { name: 'Política de tratamiento de datos' }),
  ).toHaveAttribute('href', '/agro/privacidad/');
});
