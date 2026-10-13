/**
 * HU-Q7.5 CA3: dos cajas en dos navegadores registran sin red, vuelven a tener señal y quedan con
 * los mismos registros, sin números repetidos ni perdidos. La celda es el Worker real de
 * `apps/parqueadero-api` en este proceso, con el D1 local; las rutas de Playwright le pasan lo que
 * cada caja pide a la nube.
 *
 * La prueba escribe `nube`, `dispositivo` y los términos aceptados (HU-Q7.11) en la caja, y la
 * fila de `dispositivo` en la celda, sin pasar por la cuenta (HU-Q7.6) ni el alta (HU-Q7.7), que prueba `parqueadero-cuenta.spec.ts`. El service
 * worker no atiende lo que va a la API, así que las rutas ven cada pedido.
 */
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import {
  abrir,
  alta,
  type Entorno,
  env,
  ORG_UNO,
  token,
} from '../../apps/parqueadero-api/src/prueba.fixture.ts';
import { VERSION_DE_LOS_TERMINOS } from '../../apps/parqueadero-api/src/terminos.ts';
import { crearApp } from '../../apps/parqueadero-api/src/worker.ts';
import { conexionesDeLaCaja } from '../../scripts/lib/cabeceras-parqueadero.ts';
import {
  abrirControlada,
  abrirMenu,
  abrirTurno,
  llenarAjustes,
  SITIO,
  teclearPlaca,
} from './parqueadero-ayudas.ts';

test.use({ testIdAttribute: 'data-prueba' });

/** La API de la celda que la CSP de staging deja: la que arma el build. */
const API = conexionesDeLaCaja('staging')[0] ?? '';
/**
 * Cinco por caja: el navegador cuesta minutos de CI. Las 20 por caja de CA3 las prueba el arnés
 * (`tests/integracion/parqueadero-dos-cajas.test.ts`) con el mismo código de la caja.
 */
const VEHICULOS = 5;

let e: Entorno;
test.beforeAll(async () => {
  e = await abrir();
});
test.afterAll(async () => e?.cerrar());

/** La celda con el reloj de verdad: los tokens y los registros son de ahora. */
const celda = crearApp();

interface Caja {
  readonly page: Page;
  readonly context: BrowserContext;
  readonly serie: string;
  sinRed: boolean;
}

/** Abre una caja en su propio navegador, vinculada a la celda, con su serie dada de alta. */
async function abrirCaja(context: BrowserContext, serie: string): Promise<Caja> {
  const caja = { page: await context.newPage(), context, serie, sinRed: false };
  await context.route(`${API}/**`, async (ruta) => {
    if (caja.sinRed) return ruta.abort('internetdisconnected');
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
  const dispositivo = `caja-${serie.toLowerCase()}-${Date.now()}`;
  await alta(e.db, ORG_UNO, dispositivo, serie);
  const acceso = await token(e, { org: ORG_UNO }, Date.now());
  await abrirControlada(caja.page);
  await expect(caja.page.getByTestId('estadias')).toBeVisible();
  await caja.page.evaluate(
    ([api, llave, id, letra, version]) =>
      new Promise<void>((listo, falla) => {
        const base = indexedDB.open('parqueadero-caja');
        base.onerror = () => falla(base.error);
        base.onsuccess = () => {
          const tx = base.result.transaction('meta', 'readwrite');
          tx.objectStore('meta').put({ clave: 'nube', api, acceso: llave });
          tx.objectStore('meta').put({ clave: 'dispositivo', id, serie: letra });
          tx.objectStore('meta').put({
            clave: 'terminos',
            version,
            aceptados: Date.now(),
            registrados: null,
          });
          tx.oncomplete = () => {
            base.result.close();
            listo();
          };
        };
      }),
    [API, acceso, dispositivo, serie, VERSION_DE_LOS_TERMINOS] as const,
  );
  await caja.page.reload();
  return caja;
}

async function cortarRed(c: Caja, sin: boolean) {
  c.sinRed = sin;
  await c.context.setOffline(sin);
}

const contar = async (tabla: string) =>
  (await e.db.prepare(`SELECT count(*) AS n FROM ${tabla}`).first<{ n: number }>())?.n ?? 0;
const nube = (c: Caja) => c.page.getByTestId('senal-nube');
const placa = (serie: string, i: number) => `${serie}${serie}${serie}${String(100 + i)}`;

async function entrar(c: Caja, p: string, nueva = true) {
  if (nueva) await c.page.getByRole('button', { name: 'Nueva entrada' }).click();
  await teclearPlaca(c.page, p);
  await c.page.getByRole('button', { name: 'Registrar' }).click();
  await expect(c.page.getByRole('heading', { level: 1 })).toContainText('Recibo de entrada');
  await c.page.getByRole('button', { name: 'Volver al inicio' }).click();
}

async function salir(c: Caja, p: string) {
  await c.page.getByTestId('estadia').filter({ hasText: p }).click();
  await c.page.getByRole('button', { name: 'Efectivo' }).click();
  await c.page.getByLabel('Recibido').fill('50.000');
  await c.page.getByRole('button', { name: /^Cobrar/ }).click();
  await expect(c.page.getByRole('heading', { level: 1 })).toContainText('Recibo de salida');
  await c.page.getByRole('button', { name: 'Volver al inicio' }).click();
}

/** Los ids de los registros de la caja, leídos de IndexedDB. */
const ids = (c: Caja) =>
  c.page.evaluate(
    () =>
      new Promise<string[]>((listo, falla) => {
        const base = indexedDB.open('parqueadero-caja');
        base.onerror = () => falla(base.error);
        base.onsuccess = () => {
          const todos = base.result.transaction('registros').objectStore('registros').getAllKeys();
          todos.onsuccess = () => {
            base.result.close();
            listo((todos.result as string[]).sort());
          };
        };
      }),
  );

test(`HU-Q7.5 CA3 · dos cajas sin red registran ${VEHICULOS} entradas y salidas cada una y quedan iguales`, async ({
  browser,
}) => {
  // Tarda unos 22 s en el CI y 32 en local. Un cuelgue se corta a los 90 s, no a los 300: el
  // 12 oct 2026 uno se llevó 5 minutos de Actions (HU-C11.8, bitácora parqueadero 37).
  test.setTimeout(90_000);
  // La caja A configura el parqueadero; la B baja los ajustes de la nube.
  const a = await abrirCaja(await browser.newContext(), 'A');
  await abrirMenu(a.page, 'Ajustes del parqueadero');
  await llenarAjustes(a.page, { ensayo: 'uno', imprimir: 'No' });
  // Lo guardado sale solo a los pocos segundos, sin que nadie toque nada.
  await expect.poll(() => contar('catalogo')).toBeGreaterThanOrEqual(2);
  await expect(nube(a)).toHaveText('Todo en la nube');
  const b = await abrirCaja(await browser.newContext(), 'B');
  await expect(b.page.getByRole('button', { name: 'Nueva entrada' })).toBeVisible();
  await expect(nube(b)).toHaveText('Todo en la nube');

  // Sin red, cada caja abre su turno y registra igual: nada espera a la nube.
  for (const c of [a, b]) {
    await cortarRed(c, true);
    await c.page.getByRole('button', { name: 'Nueva entrada' }).click();
    await abrirTurno(c.page);
    for (let i = 0; i < VEHICULOS; i++) await entrar(c, placa(c.serie, i), i > 0);
    for (let i = 0; i < VEHICULOS; i++) await salir(c, placa(c.serie, i));
    await expect(nube(c)).toHaveText(`${1 + 2 * VEHICULOS} en este dispositivo, sin señal`);
  }

  // Vuelve la señal: A sube, B sube y baja lo de A, y A baja lo de B al volver la señal otra vez.
  await cortarRed(a, false);
  await expect(nube(a)).toHaveText('Todo en la nube');
  await cortarRed(b, false);
  await expect(nube(b)).toHaveText('Todo en la nube');
  await cortarRed(a, true);
  await cortarRed(a, false);
  await expect.poll(async () => (await ids(a)).length).toBe(2 * (1 + 2 * VEHICULOS));
  expect(await ids(a)).toEqual(await ids(b));

  // En la celda, cada serie con todos sus números, desde el 1, una vez.
  for (const serie of ['A', 'B']) {
    const r = await e.db
      .prepare(
        'SELECT count(*) AS n, count(DISTINCT consecutivo) AS distintos, min(consecutivo) AS desde, max(consecutivo) AS hasta FROM registro WHERE serie = ?',
      )
      .bind(serie)
      .first<{ n: number; distintos: number; desde: number; hasta: number }>();
    expect(r).toEqual({
      n: 2 * VEHICULOS,
      distintos: 2 * VEHICULOS,
      desde: 1,
      hasta: 2 * VEHICULOS,
    });
  }
  expect(await contar('cuarentena')).toBe(0);
  // Ningún vehículo quedó adentro en ninguna de las dos.
  for (const c of [a, b]) {
    await expect(c.page.getByTestId('estadias')).toContainText('No hay vehículos adentro.');
  }
});
