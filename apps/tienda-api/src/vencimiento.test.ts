/**
 * HU-T13.5 CA3 y WI-T13.5.2: el plan de la tienda al día, con el reloj movido. Contra el shard y la
 * base de control locales, con los dos comercios de prueba; el almacén y el KV son de mentira.
 * Ningún dato es real.
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
import { type Almacen, publicar } from './publicar.ts';
import { guardarElPlan, vencerLosPlanes } from './vencimiento.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-20T15:00:00.000Z';
const PROPIO = 'www.ensayo-uno.example';
/** El token del CORE trae el vencimiento en segundos, con la gracia ya sumada. */
const VENCE_UNO = '2026-10-25T00:00:00.000Z';

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
  // Ensayo Uno, en el plan Entrada hasta el 25 oct, con su dominio propio como principal.
  await shard
    .prepare('UPDATE tienda SET plan = ?, plan_vence = ? WHERE org_id = ?')
    .bind('entrada', VENCE_UNO, ENSAYO_UNO.org)
    .run();
  await control
    .prepare("UPDATE dominio SET rol = 'alias' WHERE org_id = ?")
    .bind(ENSAYO_UNO.org)
    .run();
  await control
    .prepare(
      "INSERT INTO dominio (hostname, org_id, celda_id, tipo, rol, estado, creado, activado) VALUES (?, ?, 'c1', 'propio', 'canonico', 'activo', ?, ?)",
    )
    .bind(PROPIO, ENSAYO_UNO.org, AHORA, AHORA)
    .run();
}, 60_000);

afterAll(async () => {
  for (const c of cerrar) await c();
});

function almacen() {
  const objetos = new Map<string, string>();
  const a: Almacen & { objetos: Map<string, string> } = {
    objetos,
    get: async (clave) => {
      const t = objetos.get(clave);
      return t === undefined ? null : { text: async () => t };
    },
    put: async (clave, valor) => void objetos.set(clave, valor),
  };
  return a;
}
const kv = () => {
  const valores = new Map<string, string>();
  return { valores, put: async (k: string, v: string) => void valores.set(k, v) };
};
const planDe = (org: string) =>
  shard
    .prepare('SELECT plan, plan_vence FROM tienda WHERE org_id = ?')
    .bind(org)
    .first<{ plan: string; plan_vence: string | null }>();
const entorno = (instante: string, hosts = kv(), sitios?: Almacen) => ({
  shards: [['tienda_c1_s1', shard]] as [string, BaseD1][],
  control,
  hosts,
  celda: 'c1',
  instante,
  ...(sitios ? { sitios, release: 'r1' } : {}),
});

describe('guardar el plan del token (HU-T13.5)', () => {
  it('guarda el plan y su vencimiento solo si cambiaron', async () => {
    expect(await guardarElPlan(shard, ENSAYO_DOS.org, 'gratis', null)).toBe(false);
    const vence = Date.parse('2026-12-01T00:00:00.000Z') / 1000;
    expect(await guardarElPlan(shard, ENSAYO_DOS.org, 'entrada', vence)).toBe(true);
    expect(await planDe(ENSAYO_DOS.org)).toEqual({
      plan: 'entrada',
      plan_vence: '2026-12-01T00:00:00.000Z',
    });
    expect(await guardarElPlan(shard, ENSAYO_DOS.org, 'entrada', vence)).toBe(false);
    expect(await guardarElPlan(shard, ENSAYO_DOS.org, 'gratis', null)).toBe(true);
  });
});

describe('el plan vencido, con el reloj movido (WI-T13.5.2)', () => {
  it('antes del vencimiento (con la gracia) nada cambia', async () => {
    const hosts = kv();
    expect(await vencerLosPlanes(entorno('2026-10-24T23:59:00.000Z', hosts))).toEqual({
      vencidas: [],
      fallas: [],
    });
    expect(hosts.valores.size).toBe(0);
    expect((await planDe(ENSAYO_UNO.org))?.plan).toBe('entrada');
  });

  it('❌ CA3: pasada la gracia, la tienda queda en el gratuito y el dominio propio redirige a la dirección de la plataforma', async () => {
    const hosts = kv();
    expect(await vencerLosPlanes(entorno('2026-10-25T01:00:00.000Z', hosts))).toEqual({
      vencidas: [ENSAYO_UNO.org],
      fallas: [],
    });
    expect(await planDe(ENSAYO_UNO.org)).toEqual({ plan: 'gratis', plan_vence: null });
    const plataforma = hostDeStaging(ENSAYO_UNO.slug);
    expect(JSON.parse(hosts.valores.get(`h:${PROPIO}`) ?? '{}')).toMatchObject({
      rol: 'alias',
      canonico: plataforma,
    });
    expect(JSON.parse(hosts.valores.get(`h:${plataforma}`) ?? '{}')).toMatchObject({
      rol: 'canonico',
      canonico: plataforma,
    });
    // La base no cambia: con el plan de vuelta, el dominio propio vuelve a ser el principal.
    const { results } = await control
      .prepare('SELECT hostname, rol FROM dominio WHERE org_id = ? ORDER BY hostname')
      .bind(ENSAYO_UNO.org)
      .all();
    expect(results).toEqual([
      { hostname: plataforma, rol: 'alias' },
      { hostname: PROPIO, rol: 'canonico' },
    ]);
    // Ensayo Dos, sin vencimiento, no se tocó; una segunda vuelta no encuentra nada.
    expect(await planDe(ENSAYO_DOS.org)).toEqual({ plan: 'gratis', plan_vence: null });
    expect((await vencerLosPlanes(entorno('2026-10-25T02:00:00.000Z'))).vencidas).toEqual([]);
  });

  it('❌ CA3: lo publicado se vuelve a hornear sin lo que el plan ya no incluye, sin que el comercio publique', async () => {
    // Ensayo Dos paga Entrada y publica con los feeds encendidos.
    await shard
      .prepare('UPDATE tienda SET plan = ?, plan_vence = ? WHERE org_id = ?')
      .bind('entrada', '2026-11-01T00:00:00.000Z', ENSAYO_DOS.org)
      .run();
    await shard
      .prepare(
        "INSERT INTO ajuste (org_id, seccion, esquema, datos, actualizado, actualizado_por) VALUES (?, 'agentes', 1, ?, ?, 'prueba') ON CONFLICT (org_id, seccion) DO UPDATE SET datos = excluded.datos",
      )
      .bind(
        ENSAYO_DOS.org,
        JSON.stringify({ feeds: { google: true, meta: false, agentes: false } }),
        AHORA,
      )
      .run();
    const r2 = almacen();
    const hosts = kv();
    expect(
      await publicar({
        shard,
        shardNombre: 'tienda_c1_s1',
        control,
        sitios: r2,
        hosts,
        celda: 'c1',
        release: 'r1',
        org: ENSAYO_DOS.org,
        pedidaPor: 'usuario:prueba',
        ahora: AHORA,
        omitir: ['sin-foto'],
      }),
    ).toMatchObject({ estado: 'publicada', version: 1 });
    const feeds = (v: number) =>
      Object.keys(
        (
          JSON.parse(r2.objetos.get(`sitios/${ENSAYO_DOS.org}/${v}/manifiesto.json`) ?? '{}') as {
            archivos: Record<string, unknown>;
          }
        ).archivos,
      ).filter((r) => r.startsWith('/feeds/'));
    expect(feeds(1)).toEqual(['/feeds/google.xml']);

    // Pasa la gracia: la tarea la vuelve a hornear con los límites del gratuito.
    const vuelta = await vencerLosPlanes(entorno('2026-11-01T01:00:00.000Z', hosts, r2));
    expect(vuelta).toEqual({ vencidas: [ENSAYO_DOS.org], fallas: [] });
    const fila = await shard
      .prepare('SELECT version_publicada FROM tienda WHERE org_id = ?')
      .bind(ENSAYO_DOS.org)
      .first<{ version_publicada: number }>();
    expect(fila?.version_publicada).toBe(2);
    expect(feeds(2)).toEqual([]);
    // Lo que el comercio eligió sigue guardado: con el plan de vuelta y publicando, vuelve.
    const datos = JSON.parse(r2.objetos.get(`sitios/${ENSAYO_DOS.org}/2/datos.json`) ?? '{}') as {
      datos: { feeds?: unknown; plan?: { feeds: boolean } };
    };
    expect(datos.datos.feeds).toEqual({ google: true, meta: false, agentes: false });
    expect(datos.datos.plan?.feeds).toBe(false);
  });
});
