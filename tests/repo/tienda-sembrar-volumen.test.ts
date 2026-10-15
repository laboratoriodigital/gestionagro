/**
 * HU-T3.7 CA1: la siembra de volumen va a local o a staging, nunca a otro lado, y en staging exige
 * que Ensayo Uno ya exista. Con un D1 de mentira: nada sale a la red.
 */
import { describe, expect, it } from 'vitest';
import { ENSAYO_UNO } from '../../packages/tienda-schema/src/ensayos.ts';
import { siembraDeVolumen } from '../../packages/tienda-schema/src/volumen.ts';
import {
  baseDeStaging,
  destinoDe,
  SiembraRechazada,
  sembrarEnStaging,
} from '../../scripts/tienda/sembrar-volumen.ts';

const AHORA = '2026-10-20T17:00:00.000Z';

function d1Falso(conTienda: boolean) {
  const consultas: string[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    if (url.includes('?name=')) {
      const nombre = decodeURIComponent(url.split('?name=')[1]?.split('&')[0] ?? '');
      return Response.json({ result: [{ uuid: 'uuid-de-prueba', name: nombre }] });
    }
    expect(url).toContain('/d1/database/uuid-de-prueba/query');
    const { sql } = JSON.parse(String(init?.body)) as { sql: string };
    consultas.push(sql);
    const results =
      sql.startsWith('SELECT org_id FROM tienda') && conTienda ? [{ org_id: 'x' }] : [];
    return Response.json({ success: true, result: [{ results }] });
  };
  return { fetch, consultas };
}

describe('la siembra de volumen (HU-T3.7 CA1)', () => {
  it('❌ solo local o staging: producción, o nada, se rechaza antes de tocar credenciales', () => {
    expect(destinoDe(['--destino', 'local'])).toBe('local');
    expect(destinoDe(['--destino', 'staging'])).toBe('staging');
    expect(() => destinoDe(['--destino', 'produccion'])).toThrow(/nunca produccion/);
    expect(() => destinoDe([])).toThrow(SiembraRechazada);
  });

  it('llena la base de staging del shard, sentencia por sentencia, después de ver que Ensayo Uno existe', async () => {
    expect(baseDeStaging()).toMatch(/_staging$/);
    const d1 = d1Falso(true);
    const n = await sembrarEnStaging({
      token: 't',
      cuenta: 'c',
      ahora: AHORA,
      fetch: d1.fetch,
      decir: () => undefined,
    });
    expect(n).toBe(siembraDeVolumen(ENSAYO_UNO, AHORA).length);
    expect(d1.consultas[0]).toMatch(/^SELECT org_id FROM tienda/);
    expect(d1.consultas).toHaveLength(n + 1);
    // D1 limita el tamaño de una sentencia: ninguna pasa de 100 KB.
    for (const sql of d1.consultas)
      expect(new TextEncoder().encode(sql).length).toBeLessThan(100_000);
  });

  it('❌ sin Ensayo Uno en staging, no siembra nada y dice que se despliegue primero', async () => {
    const d1 = d1Falso(false);
    await expect(
      sembrarEnStaging({
        token: 't',
        cuenta: 'c',
        ahora: AHORA,
        fetch: d1.fetch,
        decir: () => undefined,
      }),
    ).rejects.toThrow(/despliega staging primero/);
    expect(d1.consultas).toHaveLength(1);
  });
});
