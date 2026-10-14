/**
 * HU-T17.1: las tareas periódicas de la Tienda. Contra el shard y la base de control locales con
 * los dos comercios de prueba (HU-T2.6), y KV y Telegram de mentira: qué toca a cada hora, que una
 * tarea que falla no tumba a las demás (CA3), que la salud diga si alguna se atrasó (CA1) y que
 * `TIENDA_HOSTS` se rehaga desde la base y avise si difería (CA2).
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  hostDeStaging,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  despachar,
  type EntornoDeTareas,
  estadoDeLasTareas,
  hostsEsperados,
  type KvDeTareas,
  RECONSTRUIR_HOSTS,
  type Tarea,
  tocan,
} from './tareas.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-14T15:00:00.000Z';

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

function kv(inicial: Record<string, string> = {}): KvDeTareas & { datos: Map<string, string> } {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    get: async (k) => datos.get(k) ?? null,
    put: async (k, v) => {
      datos.set(k, v);
    },
  };
}

/** Un Telegram de mentira que guarda los textos enviados. */
function telegram() {
  const enviados: string[] = [];
  const fetchFalso = (async (_url: string, init: RequestInit) => {
    enviados.push((JSON.parse(String(init.body)) as { text: string }).text);
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  return { enviados, fetchFalso };
}

const entorno = (extra: Partial<EntornoDeTareas> = {}): EntornoDeTareas => ({
  celda: 'c1',
  shards: [['tienda_c1_s1', shard]],
  control,
  hosts: kv(),
  flags: kv(),
  telegram: { token: 'x', chat: '1' },
  ...extra,
});

describe('qué toca en cada hora (HU-T17.1)', () => {
  it('cada hora, la diaria a las 3 a. m. de Bogotá y la semanal el lunes a esa hora', () => {
    expect(tocan(Date.parse('2026-10-14T15:00:00Z'))).toEqual(['hora']);
    expect(tocan(Date.parse('2026-10-14T08:00:00Z'))).toEqual(['hora', 'dia']);
    expect(tocan(Date.parse('2026-10-12T08:00:00Z'))).toEqual(['hora', 'dia', 'semana']);
    expect(tocan(Date.parse('2026-10-12T09:00:00Z'))).toEqual(['hora']);
  });
});

describe('el despacho de las tareas', () => {
  const ok: Tarea = { nombre: 'ok', frecuencia: 'hora', correr: async () => 'hecho' };
  const rota: Tarea = {
    nombre: 'rota',
    frecuencia: 'hora',
    correr: async () => {
      throw new Error('la base no respondió');
    },
  };
  const diaria: Tarea = { nombre: 'diaria', frecuencia: 'dia', correr: async () => 'hecho' };

  it('❌ una tarea que falla no tumba a las demás y deja su causa (CA3)', async () => {
    const flags = kv();
    const corridas = await despachar(entorno({ flags }), Date.parse(AHORA), [rota, ok, diaria]);
    expect(corridas).toEqual([
      { nombre: 'rota', ok: false, resumen: 'la base no respondió' },
      { nombre: 'ok', ok: true, resumen: 'hecho' },
    ]);
    expect(JSON.parse(flags.datos.get('tarea:rota') ?? '{}')).toMatchObject({ ok: false });
    expect(flags.datos.has('tarea:diaria')).toBe(false);
  });

  it('la salud dice si cada tarea va al día, se atrasó, falló o nunca corrió (CA1)', async () => {
    const flags = kv();
    await despachar(entorno({ flags }), Date.parse(AHORA), [rota, ok]);
    const ahora = Date.parse(AHORA);
    expect(await estadoDeLasTareas(flags, [ok, rota, diaria], ahora + 60_000)).toEqual({
      ok: 'al-dia',
      rota: 'fallo',
      diaria: 'nunca',
    });
    expect((await estadoDeLasTareas(flags, [ok], ahora + 3 * 3_600_000))['ok']).toBe('atrasada');
  });
});

describe('la diaria rehace TIENDA_HOSTS desde la base (CA2)', () => {
  it('cada hostname activo con su tienda, su shard y su canónico', async () => {
    const esperados = await hostsEsperados(entorno());
    const uno = JSON.parse(esperados.get(`h:${hostDeStaging(ENSAYO_UNO.slug)}`) ?? '{}');
    expect(uno).toEqual({
      org: ENSAYO_UNO.org,
      celda: 'c1',
      shard: 'tienda_c1_s1',
      version: null,
      canonico: hostDeStaging(ENSAYO_UNO.slug),
      estado: 'abierta',
      rol: 'canonico',
    });
    expect(esperados.size).toBe(2);
  });

  it('si está al día no escribe ni avisa', async () => {
    const t = telegram();
    const hosts = kv(Object.fromEntries(await hostsEsperados(entorno())));
    const resumen = await RECONSTRUIR_HOSTS.correr(
      entorno({ hosts, fetch: t.fetchFalso }),
      Date.parse(AHORA),
    );
    expect(resumen).toBe('2 direcciones al día');
    expect(t.enviados).toEqual([]);
  });

  it('❌ si el KV difiere o le falta una dirección, gana la base y avisa por Telegram', async () => {
    const t = telegram();
    const esperados = await hostsEsperados(entorno());
    const clave = `h:${hostDeStaging(ENSAYO_DOS.slug)}`;
    const hosts = kv({ [clave]: JSON.stringify({ org: 'otra', celda: 'c9' }) });
    const resumen = await RECONSTRUIR_HOSTS.correr(
      entorno({ hosts, fetch: t.fetchFalso }),
      Date.parse(AHORA),
    );
    expect(resumen).toBe('2 corregidas');
    expect(Object.fromEntries(hosts.datos)).toEqual(Object.fromEntries(esperados));
    expect(t.enviados).toHaveLength(1);
    expect(t.enviados[0]).toContain(`${hostDeStaging(ENSAYO_DOS.slug)}: difería`);
    expect(t.enviados[0]).toContain(`${hostDeStaging(ENSAYO_UNO.slug)}: faltaba`);
  });
});
