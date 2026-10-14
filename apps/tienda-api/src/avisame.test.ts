/**
 * HU-T6.5: «Avísame cuando haya». Suma uno por cada persona que espera una variante agotada, sin
 * guardar nada de ella (CA2), y con su límite por IP.
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
import {
  CABECERA_DESPACHO,
  CABECERA_TIENDA,
  crearApp,
  type Env,
  type Limitador,
} from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-14T15:00:00.000Z';
const SECRETO = 'secreto-de-prueba-del-despacho';

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
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const libre: Limitador = { limit: async () => ({ success: true }) };
const env = (extra: Record<string, unknown> = {}): Env => ({
  CELDA: 'c1',
  SECRETO_DESPACHO: SECRETO,
  tienda_c1_s1: shard,
  tienda_control: control,
  LIMITE_AVISAME: libre,
  ...extra,
});
const pedir = (variante: string, e: Env = env(), org = ENSAYO_UNO.org) =>
  crearApp().request(
    '/api/v1/avisame',
    {
      method: 'POST',
      body: JSON.stringify({ variante }),
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        [CABECERA_TIENDA]: JSON.stringify({ org, shard: 'tienda_c1_s1' }),
        'cf-connecting-ip': '203.0.113.9',
        'content-type': 'application/json',
      },
    },
    e,
  );

describe('«Avísame cuando haya» (HU-T6.5)', () => {
  it('suma uno por cada vez que alguien espera una variante agotada (CA1)', async () => {
    expect(await (await pedir('v-camisa-l-azul')).json()).toEqual({ estado: 'anotado' });
    await pedir('v-camisa-l-azul');
    const fila = await shard
      .prepare('SELECT personas FROM interes_reposicion WHERE org_id = ? AND variante_id = ?')
      .bind(ENSAYO_UNO.org, 'v-camisa-l-azul')
      .first<{ personas: number }>();
    expect(fila?.personas).toBe(2);
  });

  it('❌ no guarda ningún dato de la persona: ni su IP ni nada más (CA2)', async () => {
    const { results } = await shard.prepare('PRAGMA table_info(interes_reposicion)').all<{
      name: string;
    }>();
    expect(results.map((c) => c.name)).toEqual([
      'org_id',
      'variante_id',
      'personas',
      'desde',
      'ultimo',
    ]);
    const { results: filas } = await shard.prepare('SELECT * FROM interes_reposicion').all();
    expect(JSON.stringify(filas)).not.toContain('203.0.113.9');
  });

  it('❌ una variante disponible, o sin inventario, no suma: 409', async () => {
    expect((await pedir('v-camisa-m-arena')).status).toBe(409);
    expect((await pedir('v-pan-de-bono', env(), ENSAYO_DOS.org)).status).toBe(409);
  });

  it('❌ la variante de otra tienda, o una que no existe: 404', async () => {
    expect((await pedir('v-pan-de-bono')).status).toBe(404);
    expect((await pedir('no-existe')).status).toBe(404);
  });

  it('❌ pasado el límite por IP: 429, y no suma', async () => {
    const antes = await shard
      .prepare('SELECT personas FROM interes_reposicion WHERE variante_id = ?')
      .bind('v-camisa-l-azul')
      .first<{ personas: number }>();
    const r = await pedir(
      'v-camisa-l-azul',
      env({ LIMITE_AVISAME: { limit: async () => ({ success: false }) } }),
    );
    expect(r.status).toBe(429);
    const despues = await shard
      .prepare('SELECT personas FROM interes_reposicion WHERE variante_id = ?')
      .bind('v-camisa-l-azul')
      .first<{ personas: number }>();
    expect(despues?.personas).toBe(antes?.personas);
  });
});
