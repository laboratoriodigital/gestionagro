/**
 * HU-P3.3 (sprint PF3): el rol «Despachos», con un token del CORE firmado de verdad. Ve y mueve los
 * pedidos, lleva los recaudos y ve el inventario; la API le niega con 403 todo lo demás, aunque el
 * panel no se lo ofrezca (CA2): la matriz de `permisos.ts` es la única fuente. Ningún dato real.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { ACCIONES, puede } from '@ed1/tienda-schema/permisos';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-de-despachos';
const T0 = Date.UTC(2026, 10, 10, 15);
const AHORA = new Date(T0).toISOString();
const PERSONA = '0199e0a0-0000-7000-8000-0000000000d6';
const UNO = ENSAYO_UNO.org;

let shard: BaseD1;
let control: BaseD1;
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
  cerrar.push(s.cerrar, c.cerrar);
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl([ENSAYO_UNO, ENSAYO_DOS], 'c1', AHORA))
    await control.prepare(sql.replace(/;$/, '')).run();
  firmante = await firmanteDesde(await generarClavePrivada());
}, 120_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  tienda_c1_s1: shard,
  tienda_control: control,
});

const pedir = async (ruta: string, cuerpo?: unknown) => {
  const { token } = await firmarAcceso(
    firmante,
    {
      sub: PERSONA,
      org: UNO,
      rol: 'despachos',
      celda: 'c1',
      shard: 'tienda_c1_s1',
      anillo: 1,
      aud: 'tienda',
      plan: 'pro',
      auth_time: Math.floor(T0 / 1000),
    },
    T0,
    2,
  );
  return crearApp({ ahora: () => T0, enSegundoPlano: () => undefined }).request(
    `/api/panel/v1/${ruta}`,
    {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    },
    env(),
  );
};

const op = (n: number) => `op-despachos-${n}`.padEnd(16, '0');

describe('HU-P3.3 · el rol «Despachos»', () => {
  it('la matriz le da solo lo de despachar, y el colaborador puede todo eso también', () => {
    expect(ACCIONES.filter((a) => puede('despachos', a)).sort()).toEqual(
      [
        'inventario.ver',
        'pedidos.contacto_ver',
        'pedidos.gestionar',
        'pedidos.link_pago',
        'pedidos.ver',
        'recaudos.gestionar',
        'sesion.ver',
        'tablero.ver',
      ].sort(),
    );
    for (const a of ACCIONES.filter((x) => puede('despachos', x)))
      expect(puede('colaborador', a)).toBe(true);
  });

  it('ve los pedidos, el tablero, los recaudos y el inventario', async () => {
    for (const ruta of ['pedidos', 'tablero', 'recaudos', 'inventario'])
      expect((await pedir(ruta)).status, ruta).toBe(200);
  });

  it.each([
    [
      'productos/guardar',
      { op: op(1), nombre: 'X', variantes: [{ valores: [], precioCop: 1000, stock: 1 }] },
    ],
    ['productos/lote', { op: op(2), ids: ['p-camisa'], cambio: { tipo: 'papelera' } }],
    [
      'inventario/ajustar',
      { op: op(3), variante: 'v-camisa-m-arena', tipo: 'ajuste', cantidad: 1 },
    ],
    ['avisame/atender', { op: op(4), variante: 'v-camisa-m-arena' }],
    ['ajustes/guardar', { op: op(5), seccion: 'identidad', version: 1, datos: { nombre: 'X' } }],
    ['publicar', { op: op(6) }],
    ['envios/guardar', { op: op(7), nombre: 'X', precioCop: 1000 }],
    ['cupones/guardar', { op: op(8), codigo: 'X', tipo: 'valor', valor: 1000 }],
    ['paginas/guardar', { op: op(9), slug: 'x', titulo: 'Xx', cuerpo: 'x', visible: true }],
  ])('❌ %s: 403, aunque el panel no lo ofrezca', async (ruta, cuerpo) => {
    expect((await pedir(ruta, cuerpo)).status).toBe(403);
  });

  it.each(['ajustes', 'venta', 'productos', 'registro', 'exportar'])(
    '❌ ver %s: 403',
    async (ruta) => {
      expect((await pedir(ruta)).status).toBe(403);
    },
  );
});
