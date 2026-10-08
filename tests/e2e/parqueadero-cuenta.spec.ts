/**
 * HU-Q7.6 en el navegador: la caja del piloto entra con la cuenta, vuelve con el código, sube el
 * parqueadero y lo ve verificado en la nube, con la CSP de staging de verdad. El CORE es falso
 * (Google no se prueba aquí) y firma con la clave que acepta la celda; la celda es el Worker real
 * de `apps/parqueadero-api` en este proceso, con el D1 local.
 */
import { expect, type Route, test } from '@playwright/test';
import { abrir, type Entorno, env, token } from '../../apps/parqueadero-api/src/prueba.fixture.ts';
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

/** El CORE falso: canje sin parqueadero; crear el parqueadero; renovar hacia él. */
async function core(ruta: Route) {
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
      conOrg ? { org } : { org: null, rol: null, celda: null, shard: null },
      Date.now(),
    ),
    acceso_vence: Date.now() + 15 * 60_000,
    refresh: 'refresh-de-prueba',
    refresh_vence: Date.now() + 86_400_000,
    usuario: { nombre: 'Dueña de Ensayo', email: 'ensayo@ejemplo.test' },
    organizaciones: conOrg ? [{ org_id: org, nombre: 'Ensayo Uno', rol: 'propietario' }] : [],
    org_id: conOrg ? org : null,
    url_api: conOrg ? API : null,
  };
  return ruta.fulfill({ status: 200, headers: cors, json: sesion });
}

test('HU-Q7.6 · la caja del piloto entra, sube su parqueadero y lo ve verificado', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await context.route(`${CORE}/**`, core);
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

  // Entrar: va a la cuenta y vuelve con el código, que no se queda en la barra.
  await page.getByRole('button', { name: 'Cuenta y nube' }).click();
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
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
});
