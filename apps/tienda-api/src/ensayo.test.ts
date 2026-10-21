/**
 * La publicación de los comercios de prueba en el despliegue de staging (HU-T2.6 y HU-T4.4), con
 * la tienda llena (bitácora tienda3 31): la que no cabe en el plan gratuito se omite diciéndolo y
 * la otra se publica, para que staging se pueda seguir validando hasta Workers Paid.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Almacen } from './publicar.ts';
import {
  CABECERA_DESPACHO,
  crearApp,
  type Env,
  PRODUCTOS_DE_UN_ENSAYO_EN_EL_PLAN_GRATUITO,
} from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-de-los-ensayos';
const AHORA = '2026-10-19T15:00:00.000Z';

let shard: BaseD1;
let control: BaseD1;
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
  // Ensayo Uno, llena: uno más de los que caben.
  const extra = PRODUCTOS_DE_UN_ENSAYO_EN_EL_PLAN_GRATUITO + 1 - ENSAYO_UNO.productos.length;
  for (let i = 0; i < extra; i++) {
    await shard
      .prepare(
        `INSERT INTO producto (org_id, id, slug, nombre, estado, opciones, retracto, creado, actualizado)
         VALUES (?, ?, ?, ?, 'activo', '[]', 'aplica', ?, ?)`,
      )
      .bind(ENSAYO_UNO.org, `lleno-${i}`, `lleno-${i}`, `Producto lleno ${i}`, AHORA, AHORA)
      .run();
  }
}, 120_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const objetos = new Map<string, string>();
const hosts = new Map<string, string>();
const sitios: Almacen = {
  get: async (k) => {
    const t = objetos.get(k);
    return t === undefined ? null : { text: async () => t };
  },
  put: async (k, v) => void objetos.set(k, v),
};
const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  ENSAYOS: '1',
  SITIOS: sitios,
  TIENDA_HOSTS: { put: async (k: string, v: string) => void hosts.set(k, v) },
  VITRINA_RELEASE: 'r1',
  tienda_c1_s1: shard,
  tienda_control: control,
});
const publicarEnsayos = async () => {
  const r = await crearApp({ ahora: () => Date.parse(AHORA) }).request(
    '/api/ensayo/publicar',
    { method: 'POST', headers: { [CABECERA_DESPACHO]: SECRETO, 'x-ensayo': SECRETO } },
    env(),
  );
  return {
    status: r.status,
    cuerpo: (await r.json()) as Record<string, { estado: string; motivo?: string }>,
  };
};

describe('el despliegue de staging publica a los comercios de prueba (bitácora tienda3 31)', () => {
  it('la tienda de prueba llena se omite diciéndolo, y la otra se publica', async () => {
    let r = await publicarEnsayos();
    for (let vuelta = 0; r.status === 202 && vuelta < 10; vuelta++) r = await publicarEnsayos();
    expect(r.status).toBe(200);
    expect(r.cuerpo['ensayo-uno']).toEqual({
      estado: 'omitida',
      motivo: `tiene ${PRODUCTOS_DE_UN_ENSAYO_EN_EL_PLAN_GRATUITO + 1} productos y no cabe en el plan gratuito (bitácora tienda3 31); sigue con la versión que tenía`,
    });
    expect(['publicada', 'nada-cambio']).toContain(r.cuerpo['ensayo-dos']?.estado);
    const publicadas = await shard
      .prepare('SELECT org_id FROM tienda WHERE version_publicada IS NOT NULL ORDER BY org_id')
      .all<{ org_id: string }>();
    expect(publicadas.results.map((t) => t.org_id)).toEqual([ENSAYO_DOS.org]);
  });

  it('❌ bitácora tienda3 49: la que se omite vuelve a apuntar a la versión que ya tenía publicada', async () => {
    await shard
      .prepare('UPDATE tienda SET version_publicada = 3 WHERE org_id = ?')
      .bind(ENSAYO_UNO.org)
      .run();
    hosts.clear();
    let r = await publicarEnsayos();
    for (let vuelta = 0; r.status === 202 && vuelta < 10; vuelta++) r = await publicarEnsayos();
    expect(r.cuerpo['ensayo-uno']?.estado).toBe('omitida');
    const uno = JSON.parse(hosts.get('h:ensayo-uno--staging.laboratorio-digital.app') ?? '{}') as {
      version?: number;
      org?: string;
    };
    expect(uno).toMatchObject({ org: ENSAYO_UNO.org, version: 3 });
  });
});
