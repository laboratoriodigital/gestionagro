/**
 * HU-Q7.6 en el navegador: la caja del piloto entra con la cuenta, vuelve con el código, sube el
 * parqueadero y lo ve verificado en la nube, con la CSP de staging de verdad. El CORE es falso
 * (Google no se prueba aquí) y firma con la clave que acepta la celda; la celda es el Worker real
 * de `apps/parqueadero-api` en este proceso, con el D1 local.
 */
import { type BrowserContext, expect, type Route, test } from '@playwright/test';
import { abrir, type Entorno, env, token } from '../../apps/parqueadero-api/src/prueba.fixture.ts';
import { VERSION_DE_LOS_TERMINOS } from '../../apps/parqueadero-api/src/terminos.ts';
import { crearApp } from '../../apps/parqueadero-api/src/worker.ts';
import { conexionesDeLaCaja, coreDeLaCaja } from '../../scripts/lib/cabeceras-parqueadero.ts';
import {
  abrirControlada,
  abrirTurno,
  CAJA,
  llenarAjustes,
  SITIO,
  teclearPlaca,
} from './parqueadero-ayudas.ts';

test.use({ testIdAttribute: 'data-prueba' });

const API = conexionesDeLaCaja('staging')[0] ?? '';
const CORE = coreDeLaCaja('staging')[0] ?? '';
/** El parqueadero que la caja crea en la cuenta, con el id que ella genera. */
let org = '';

let e: Entorno;
test.beforeAll(async () => {
  e = await abrir();
});
test.afterAll(async () => e?.cerrar());

const celda = crearApp();
const cors = { 'access-control-allow-origin': SITIO, 'access-control-allow-headers': '*' };

/** El plan que pone el CORE en el token y en la lista de parqueaderos (HU-C5.5). */
interface PlanDelCore {
  readonly plan: string;
  readonly plan_vence: string | null;
}
const PAGADO: PlanDelCore = { plan: 'parqueadero', plan_vence: null };

/** El CORE falso: canje sin parqueadero; crear el parqueadero; renovar hacia él. */
async function core(ruta: Route, plan: PlanDelCore = PAGADO) {
  const p = ruta.request();
  const camino = new URL(p.url()).pathname;
  if (p.method() === 'OPTIONS') return ruta.fulfill({ status: 204, headers: cors });
  if (camino === '/api/core/auth/google/inicio') {
    // Google y el consentimiento pasan; el CORE vuelve a la caja con el código de un uso.
    return ruta.fulfill({ status: 302, headers: { location: `${CAJA}#entrar=codigo-de-prueba` } });
  }
  const cuerpo = JSON.parse(p.postData() ?? '{}') as Record<string, string>;
  if (camino === '/api/core/organizaciones') {
    org = cuerpo['id'] ?? '';
    return ruta.fulfill({ status: 201, headers: cors, json: { org_id: org } });
  }
  const conOrg = camino === '/api/core/auth/refrescar' && org !== '' && cuerpo['org_id'] === org;
  const sesion = {
    acceso: await token(
      e,
      conOrg ? { org, plan: plan.plan } : { org: null, rol: null, celda: null, shard: null },
      Date.now(),
    ),
    acceso_vence: Date.now() + 15 * 60_000,
    refresh: 'refresh-de-prueba',
    refresh_vence: Date.now() + 86_400_000,
    usuario: { nombre: 'Dueña de Ensayo', email: 'ensayo@ejemplo.test' },
    organizaciones: conOrg
      ? [{ org_id: org, nombre: 'Ensayo Uno', rol: 'propietario', ...plan, aviso: null }]
      : [],
    org_id: conOrg ? org : null,
    url_api: conOrg ? API : null,
  };
  return ruta.fulfill({ status: 200, headers: cors, json: sesion });
}

/** La celda es el Worker real en este proceso: lo que la caja le pide va por aquí. */
async function celdaEnLaRuta(context: BrowserContext) {
  await context.route(`${API}/**`, async (ruta) => {
    const p = ruta.request();
    const r = await celda.fetch(
      new Request(p.url(), {
        method: p.method(),
        headers: p.headers(),
        body: p.method() === 'GET' ? null : p.postData(),
      }),
      env(e, { ORIGENES_APP: SITIO }),
    );
    await ruta.fulfill({
      status: r.status,
      headers: Object.fromEntries(r.headers),
      body: Buffer.from(await r.arrayBuffer()),
    });
  });
}

test('HU-Q7.6 · la caja del piloto entra, sube su parqueadero y lo ve verificado', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  org = '';
  await context.route(`${CORE}/**`, (ruta) => core(ruta));
  await celdaEnLaRuta(context);

  // La caja de v0.2.x: ajustes, un turno y una entrada, todo en el teléfono.
  await abrirControlada(page);
  await page.getByRole('button', { name: 'Ajustes del parqueadero' }).click();
  await llenarAjustes(page, { ensayo: 'uno', imprimir: 'No' });
  await page.getByRole('button', { name: 'Nueva entrada' }).click();
  await abrirTurno(page);
  await teclearPlaca(page, 'PIL100');
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Recibo de entrada');
  await page.getByRole('button', { name: 'Volver al inicio' }).click();

  // HU-Q7.11 CA1: antes de entrar, qué sube y qué no; sin aceptar los términos no se entra.
  await page.getByRole('button', { name: 'Cuenta y nube' }).click();
  await expect(page.getByTestId('terminos')).toContainText('número de celular del conductor');
  const entrar = page.getByRole('button', { name: 'Entrar con Google' });
  await expect(entrar).toBeDisabled();
  await page.getByRole('checkbox', { name: /Acepto los términos/ }).check();
  // Entrar: va a la cuenta y vuelve con el código, que no se queda en la barra.
  await entrar.click();
  await expect(page.getByTestId('quien')).toContainText('Dueña de Ensayo');
  expect(page.url()).not.toContain('entrar');

  await page.getByRole('button', { name: 'Subir este parqueadero a la nube' }).click();
  await expect(page.getByTestId('estado-de-la-cuenta')).toContainText('con la serie A');
  await expect(page.getByTestId('reclamo')).toContainText('verificado', { timeout: 30_000 });
  const fila = await e.db
    .prepare("SELECT count(*) AS n FROM registro WHERE org_id = ? AND serie = 'A'")
    .bind(org)
    .first<{ n: number }>();
  expect(fila?.n).toBe(1);
  await expect(page.getByTestId('cajas')).toContainText('serie A');
  // La celda guardó cuándo se aceptaron (CA1).
  const caja = await e.db
    .prepare('SELECT terminos_version AS v FROM dispositivo WHERE org_id = ?')
    .bind(org)
    .first<{ v: string | null }>();
  expect(caja?.v).toBe(VERSION_DE_LOS_TERMINOS);

  // HU-Q7.11 CA2: con cuenta, el aviso ya no dice que los datos no salen del teléfono.
  await page.getByRole('button', { name: 'Volver al inicio' }).click();
  await page.getByRole('button', { name: 'Aviso de privacidad' }).click();
  await expect(page.getByTestId('aviso')).toContainText('también en la nube');
  await expect(page.getByTestId('aviso')).not.toContainText('no salen de este teléfono');
});

test('HU-Q7.10 · con el plan gratuito la nube espera; pagado en Bold, la caja sube', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  org = '';
  let pagado = false;
  const ORDEN = 'parqueadero-01926a1b-2c3d-7e4f-8a9b-0c1d2e3f4a5b';
  const vence = new Date(Date.now() + 37 * 86_400_000).toISOString();
  let pedido: Record<string, unknown> = {};
  await context.route(`${CORE}/**`, async (ruta) => {
    const p = ruta.request();
    const camino = new URL(p.url()).pathname;
    if (p.method() === 'OPTIONS') return ruta.fulfill({ status: 204, headers: cors });
    if (camino === '/api/core/pago/crear') {
      pedido = JSON.parse(p.postData() ?? '{}') as Record<string, unknown>;
      const vuelta = new URL(String(pedido['vuelta']));
      vuelta.searchParams.set('pago', ORDEN);
      return ruta.fulfill({
        headers: cors,
        json: {
          orden: ORDEN,
          pruebas: true,
          libreria: 'https://checkout.bold.co/library/boldPaymentButton.js',
          checkout: { redirectionUrl: vuelta.toString() },
        },
      });
    }
    if (camino === '/api/core/pago/confirmar') {
      pagado = true;
      return ruta.fulfill({
        headers: cors,
        json: { estado: 'aprobado', motivo: null, plan: 'parqueadero', plan_vence: vence },
      });
    }
    return core(
      ruta,
      pagado ? { plan: 'parqueadero', plan_vence: vence } : { plan: 'gratis', plan_vence: null },
    );
  });
  // Bold falso: el checkout «paga» y vuelve a la dirección que armó el CORE, como Bold.
  await context.route('https://checkout.bold.co/**', (ruta) =>
    ruta.fulfill({
      contentType: 'text/javascript',
      body: 'window.BoldCheckout = class { constructor(d) { this.d = d; } open() { location.assign(this.d.redirectionUrl); } };',
    }),
  );
  await celdaEnLaRuta(context);

  await abrirControlada(page);
  await page.getByRole('button', { name: 'Ajustes del parqueadero' }).click();
  await llenarAjustes(page, { ensayo: 'uno', imprimir: 'No' });
  await page.getByRole('button', { name: 'Cuenta y nube' }).click();
  await page.getByRole('checkbox', { name: /Acepto los términos/ }).check();
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
  await expect(page.getByTestId('quien')).toContainText('Dueña de Ensayo');

  // Con el plan gratuito la celda no recibe la caja, y la caja dice por qué y ofrece pagar (CA3).
  await page.getByRole('button', { name: 'Subir este parqueadero a la nube' }).click();
  await expect(page.getByTestId('aviso-de-la-cuenta')).toContainText('no está al día');
  await expect(page.getByTestId('texto-del-plan')).toContainText('Plan Gratis');

  // CA1: pagar un mes abre Bold con lo que armó el CORE; la caja no manda el monto.
  await page.getByRole('button', { name: /^Pagar un mes · \$59\.000/ }).click();
  await expect(page.getByTestId('estado-de-la-cuenta')).toContainText(
    'Pago aprobado: la nube sigue hasta el',
  );
  expect(pedido).toEqual({ plan: 'parqueadero', meses: 1, vuelta: `${SITIO}/caja/` });
  expect(page.url()).not.toContain('pago=');
  await expect(page.getByTestId('texto-del-plan')).toContainText(
    'Plan Parqueadero: la nube sigue hasta el',
  );

  // Pagado, el acceso nuevo trae el plan y la caja sube.
  await page.getByRole('button', { name: 'Subir este parqueadero a la nube' }).click();
  await expect(page.getByTestId('estado-de-la-cuenta')).toContainText('con la serie A');
  await expect(page.getByTestId('reclamo')).toContainText('verificado', { timeout: 30_000 });
});
