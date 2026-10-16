/**
 * HU-T3.7: Comercio Ensayo Uno con la tienda llena (2.000 productos de 6 combinaciones y 300
 * pedidos del mes en todos los estados), por las mismas rutas que usa el panel y por la misma
 * publicación que corre la cola del horno. Lo que una tienda vacía no enseña:
 *
 * - **CA3 ❌.** Publicar pasa la compuerta (cada página dentro de su presupuesto de peso) y termina
 *   dentro de un minuto aquí; la cola del horno le da hasta 5 minutos de CPU (TIENDA §10.3).
 * - Ninguna consulta pasa de los 100 parámetros que admite D1: la base local no lo imita.
 * - El tablero, la bandeja, los productos y el inventario responden con todo eso adentro.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_UNO, siembraDelControl, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { siembraDeVolumen, VOLUMEN } from '@ed1/tienda-schema/volumen';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contandoParametros, TOPE_DE_PARAMETROS_D1 } from './parametros.fixture.ts';
import { type Almacen, type Contexto, publicar } from './publicar.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-del-volumen';
const T0 = Date.UTC(2026, 9, 20, 17);
const AHORA = new Date(T0).toISOString();
const UNO = ENSAYO_UNO.org;
/** Lo que se le exige aquí: la cola da 5 minutos de CPU, y esta máquina no es un Worker. */
const UN_MINUTO = 60_000;

let shard: BaseD1;
let control: BaseD1;
let contado: ReturnType<typeof contandoParametros>;
let firmante: Firmante;
const cerrar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const s = await baseLocal({
    configuracion: CONFIGURACION,
    binding: 'tienda_c1_s1',
    base: 'tienda',
  });
  const c = await baseLocal({
    configuracion: CONFIGURACION,
    binding: 'tienda_control',
    base: 'tienda-control',
  });
  shard = s.db;
  control = c.db;
  contado = contandoParametros(shard);
  cerrar.push(s.cerrar, c.cerrar);
  for (const sql of [
    ...siembraDelShard([ENSAYO_UNO], AHORA),
    ...siembraDeVolumen(ENSAYO_UNO, AHORA),
  ])
    await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl([ENSAYO_UNO], 'c1', AHORA))
    await control.prepare(sql.replace(/;$/, '')).run();
  firmante = await firmanteDesde(await generarClavePrivada());
}, 120_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const cuenta = async (sql: string) =>
  (await shard.prepare(sql).bind(UNO).first<{ n: number }>())?.n;

const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  tienda_c1_s1: contado.db,
  tienda_control: control,
});
const pedir = async (ruta: string) => {
  const { token } = await firmarAcceso(
    firmante,
    {
      sub: '0199e0a0-0000-7000-8000-0000000000db',
      org: UNO,
      rol: 'propietario',
      celda: 'c1',
      shard: 'tienda_c1_s1',
      anillo: 1,
      aud: 'tienda',
      plan: 'entrada',
      auth_time: Math.floor(T0 / 1000),
    },
    T0,
    2,
  );
  const r = await crearApp({ ahora: () => T0, enSegundoPlano: () => undefined }).request(
    `/api/panel/v1/${ruta}`,
    { headers: { [CABECERA_DESPACHO]: SECRETO, authorization: `Bearer ${token}` } },
    env(),
  );
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
};

describe('HU-T3.7 · CA1: la siembra de volumen', () => {
  it('2.000 productos de 6 combinaciones, 10 colecciones y 300 pedidos del mes en los 8 estados', async () => {
    const productos = VOLUMEN.productos + ENSAYO_UNO.productos.length;
    expect(await cuenta('SELECT count(*) AS n FROM producto WHERE org_id = ?')).toBe(productos);
    expect(
      await cuenta("SELECT count(*) AS n FROM variante WHERE org_id = ? AND id LIKE 'vol-%'"),
    ).toBe(VOLUMEN.productos * VOLUMEN.combinaciones);
    expect(
      await cuenta("SELECT count(*) AS n FROM coleccion WHERE org_id = ? AND id LIKE 'vol-%'"),
    ).toBe(VOLUMEN.colecciones);
    expect(
      await cuenta(
        "SELECT count(*) AS n FROM pedido WHERE org_id = ? AND creado >= '2026-10-01T05:00:00.000Z' AND creado <= '2026-10-20T17:00:00.000Z'",
      ),
    ).toBe(VOLUMEN.pedidos);
    expect(await cuenta('SELECT count(DISTINCT estado) AS n FROM pedido WHERE org_id = ?')).toBe(8);
    // Volver a sembrar no duplica nada.
    for (const sql of siembraDeVolumen(ENSAYO_UNO, AHORA))
      await shard.prepare(sql.replace(/;$/, '')).run();
    expect(await cuenta('SELECT count(*) AS n FROM pedido WHERE org_id = ?')).toBe(VOLUMEN.pedidos);
  });
});

describe('HU-T3.7 · CA3 ❌: la tienda llena se publica a tiempo y dentro de sus presupuestos', () => {
  it('publicar pasa la compuerta en menos de un minuto, sin pasar de 100 parámetros por consulta', async () => {
    const objetos = new Map<string, string>();
    const sitios: Almacen = {
      get: async (k) => {
        const t = objetos.get(k);
        return t === undefined ? null : { text: async () => t };
      },
      put: async (k, v) => objetos.set(k, v),
    };
    const hosts = new Map<string, string>();
    const contexto: Contexto = {
      shard: contado.db,
      shardNombre: 'tienda_c1_s1',
      control,
      sitios,
      hosts: { put: async (k: string, v: string) => void hosts.set(k, v) },
      celda: 'c1',
      release: 'r1',
      org: UNO,
      pedidaPor: 'usuario:prueba',
      ahora: AHORA,
      omitir: ['sin-foto'],
    };
    contado.reiniciar();
    const inicio = performance.now();
    const r = await publicar(contexto);
    const ms = performance.now() - inicio;
    expect(r, JSON.stringify(r).slice(0, 2000)).toMatchObject({ estado: 'publicada', version: 1 });
    expect(ms).toBeLessThan(UN_MINUTO);
    expect(contado.mas()).toBeLessThanOrEqual(TOPE_DE_PARAMETROS_D1);
    const m = JSON.parse(objetos.get(`sitios/${UNO}/1/manifiesto.json`) ?? '{}') as {
      archivos: Record<string, unknown>;
    };
    const fichas = Object.keys(m.archivos).filter((k) => /^\/p\/[^/]+\/index\.html$/.test(k));
    expect(fichas).toHaveLength(VOLUMEN.productos + ENSAYO_UNO.productos.length);
  }, 120_000);
});

describe('HU-T3.7 · el panel con la tienda llena', () => {
  it.each([['tablero'], ['pedidos'], ['productos'], ['inventario'], ['solicitudes']])(
    '%s responde sin pasar de 100 parámetros por consulta',
    async (ruta) => {
      contado.reiniciar();
      const r = await pedir(ruta);
      expect(r.status, JSON.stringify(r.cuerpo).slice(0, 500)).toBe(200);
      expect(contado.mas()).toBeLessThanOrEqual(TOPE_DE_PARAMETROS_D1);
    },
  );

  it('el tablero cuenta los 300 pedidos del mes y los agotados', async () => {
    const { cuerpo } = await pedir('tablero');
    expect((cuerpo['mes'] as { pedidos: number }).pedidos).toBe(VOLUMEN.pedidos);
    const pendientes = cuerpo['pendientes'] as { agotados: number; porConfirmar: number };
    expect(pendientes.agotados).toBeGreaterThan(0);
    expect(pendientes.porConfirmar).toBeGreaterThan(0);
  });

  it('la bandeja va de a 50 y su cursor llega al pedido 300', async () => {
    let cursor: string | null = null;
    let vistos = 0;
    for (let vuelta = 0; vuelta < 10; vuelta++) {
      const { cuerpo } = await pedir(
        `pedidos${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
      const filas = cuerpo['pedidos'] as unknown[];
      expect(filas.length).toBeLessThanOrEqual(50);
      vistos += filas.length;
      cursor = (cuerpo['siguiente'] as string | null) ?? null;
      if (!cursor) break;
    }
    expect(vistos).toBe(VOLUMEN.pedidos);
  });
});
