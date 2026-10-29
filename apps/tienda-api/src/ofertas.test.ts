/**
 * HU-P1.4 (sprint PF3): la tarea de cada hora que hace empezar y terminar las ofertas programadas,
 * contra el shard local. Busca las tiendas con una oferta que empieza hoy o terminó ayer (en
 * Colombia), re-hornea cada una una sola vez por día, y deja las otras quietas. Ningún dato real.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { diasDeColombia, OFERTAS_PROGRAMADAS, tiendasConOfertasQueCambian } from './ofertas.ts';
import type { EntornoDeTareas } from './tareas.ts';

const AHORA = '2026-11-07T06:00:00.000Z';
let shard: BaseD1;
let cerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db: shard, cerrar } = await baseLocal({
    configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
    binding: 'tienda_c1_s1',
    base: 'tienda',
  }));
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
}, 60_000);
afterAll(async () => cerrar?.());

const oferta = (org: string, o: unknown) =>
  shard
    .prepare(
      "UPDATE producto SET oferta = ? WHERE org_id = ? AND id IN ('p-camisa', 'p-pan-de-bono')",
    )
    .bind(o === null ? null : JSON.stringify(o), org)
    .run();

describe('HU-P1.4 · las ofertas empiezan y terminan solas', () => {
  it('el día de Colombia cambia a las 5:00 UTC', () => {
    expect(diasDeColombia(Date.parse('2026-11-07T04:59:00.000Z'))).toEqual({
      hoy: '2026-11-06',
      ayer: '2026-11-05',
    });
    expect(diasDeColombia(Date.parse('2026-11-07T05:00:00.000Z'))).toEqual({
      hoy: '2026-11-07',
      ayer: '2026-11-06',
    });
  });

  it('busca las que empiezan hoy o terminaron ayer; las que siguen o no han empezado, no', async () => {
    await oferta(ENSAYO_UNO.org, { porcentaje: 20, desde: '2026-11-07', hasta: '2026-11-09' });
    await oferta(ENSAYO_DOS.org, { porcentaje: 10, desde: '2026-11-01', hasta: '2026-11-06' });
    expect((await tiendasConOfertasQueCambian(shard, '2026-11-07', '2026-11-06')).sort()).toEqual(
      [ENSAYO_DOS.org, ENSAYO_UNO.org].sort(),
    );
    expect(await tiendasConOfertasQueCambian(shard, '2026-11-08', '2026-11-07')).toEqual([]);
  });

  it('cada tienda se re-hornea una vez en el día, aunque la tarea corra cada hora', async () => {
    await oferta(ENSAYO_UNO.org, { porcentaje: 20, desde: '2026-11-07', hasta: '2026-11-09' });
    await oferta(ENSAYO_DOS.org, null);
    const flags = new Map<string, string>();
    const e = {
      celda: 'c1',
      shards: [['tienda_c1_s1', shard]],
      control: shard,
      hosts: { get: async () => null, put: async () => undefined },
      flags: {
        get: async (k: string) => flags.get(k) ?? null,
        put: async (k: string, v: string) => void flags.set(k, v),
      },
      telegram: { token: undefined, chat: undefined },
      almacen: { get: async () => null },
      release: 'r1',
    } as unknown as EntornoDeTareas;
    expect(await OFERTAS_PROGRAMADAS.correr(e, Date.parse(AHORA))).toBe(
      '1 tienda(s) con sus ofertas de hoy',
    );
    expect([...flags.keys()]).toEqual([`ofertas:2026-11-07:${ENSAYO_UNO.org}`]);
    expect(await OFERTAS_PROGRAMADAS.correr(e, Date.parse(AHORA) + 3_600_000)).toBe(
      'ninguna oferta empieza ni termina hoy',
    );
  });
});
