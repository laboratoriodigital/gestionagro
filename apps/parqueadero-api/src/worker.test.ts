/**
 * La API de la celda del parqueadero (HU-Q7.4): salud, el token del CORE (CA1, CA4) y el kill
 * switch (CA3), contra el D1 local del shard de c2.
 */
import type { BaseD1 } from '@ed1/d1';
import { ENTRADA_ENSAYO } from '@ed1/parqueadero-schema/ensayos';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  abrir,
  alta,
  CAJA,
  deRegistro,
  type Entorno,
  entrada,
  lote,
  ORG_DOS,
  ORG_UNO,
  pedir,
  SHARD,
  T0,
  token,
  vaciarShard,
} from './prueba.fixture.ts';
import { TABLAS_DEL_SHARD } from './worker.ts';

let e: Entorno;
beforeAll(async () => {
  e = await abrir();
}, 60_000);
afterAll(async () => e?.cerrar());
beforeEach(async () => vaciarShard(e.db));

const kv = (valores: Record<string, string>) => ({
  get: async (clave: string) => valores[clave] ?? null,
});

describe('GET /api/salud, sin token', () => {
  it('con la configuración y el shard migrado responde ok', async () => {
    const r = await pedir(e, '/api/salud', null);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ estado: 'ok', celda: 'c2', shards: 1 });
  });

  it('las tablas que mira son las del shard, todas con org_id', async () => {
    const { results } = await e.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'ref_%' AND name <> 'd1_migrations' ORDER BY name",
      )
      .all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual([...TABLAS_DEL_SHARD].sort());
    for (const tabla of TABLAS_DEL_SHARD) {
      const columnas = await e.db
        .prepare(`SELECT name FROM pragma_table_info('${tabla}')`)
        .all<{ name: string }>();
      expect(
        columnas.results.map((c) => c.name),
        tabla,
      ).toContain('org_id');
    }
  });

  it('sin configuración dice qué falta, y un shard que no responde se nombra (P1)', async () => {
    const r = await pedir(e, '/api/salud', null, {}, { CORE_CLAVES: '', ORIGENES_APP: '' });
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ motivo: 'Falta CORE_CLAVES, ORIGENES_APP' });
    const caida = {
      prepare: () => {
        throw new Error('D1 no responde');
      },
    } as unknown as BaseD1;
    const r2 = await pedir(e, '/api/salud', null, {}, { [SHARD]: caida });
    expect(r2.status).toBe(503);
    expect(await r2.json()).toMatchObject({ motivo: `${SHARD}: la base no respondió` });
  });
});

describe('CA1 · /api/v1/* exige el token del CORE; el parqueadero sale del token', () => {
  it('con un token del parqueadero responde con su organización y cuenta solo lo suyo', async () => {
    await alta(e.db, ORG_UNO, ENTRADA_ENSAYO.dispositivo_id, 'A');
    await alta(e.db, ORG_DOS, ENTRADA_ENSAYO.dispositivo_id, 'A');
    const subir = async (org: string, n: number) =>
      pedir(e, '/api/v1/sync/push', await token(e, { org }), {
        method: 'POST',
        body: lote([deRegistro(entrada(n))].map((o) => ({ ...o }))),
      });
    expect((await subir(ORG_UNO, 1)).status).toBe(200);
    expect((await subir(ORG_UNO, 2)).status).toBe(200);
    expect((await subir(ORG_DOS, 3)).status).toBe(200);
    const yo = async (org: string) =>
      (await pedir(e, '/api/v1/yo', await token(e, { org }))).json() as Promise<{
        org: string;
        registros: number;
      }>;
    expect(await yo(ORG_UNO)).toMatchObject({ org: ORG_UNO, registros: 2 });
    expect(await yo(ORG_DOS)).toMatchObject({ org: ORG_DOS, registros: 1 });
  });

  it('sin token responde 401 y la caja sabe por qué', async () => {
    const r = await pedir(e, '/api/v1/yo', null);
    expect(r.status).toBe(401);
    expect(await r.json()).toMatchObject({ estado: 'sin-sesion' });
  });

  it('un token sin parqueadero responde 403, y uno de otra celda 409', async () => {
    expect((await pedir(e, '/api/v1/yo', await token(e, { org: null }))).status).toBe(403);
    expect((await pedir(e, '/api/v1/yo', await token(e, { celda: 'c0' }))).status).toBe(409);
  });
});

describe('CA4 ❌ · un token ajeno no entra ni escribe', () => {
  const subirCon = async (t: string) => {
    await alta(e.db, ORG_UNO, ENTRADA_ENSAYO.dispositivo_id, 'A');
    const r = await pedir(e, '/api/v1/sync/push', t, {
      method: 'POST',
      body: lote([deRegistro(entrada(1))]),
    });
    const filas = await e.db.prepare('SELECT count(*) AS n FROM registro').first<{ n: number }>();
    return { status: r.status, filas: filas?.n };
  };

  it.each([
    ['de la tienda (aud = tienda)', { aud: 'tienda' }, 2],
    ['del agro, v1 sin aud', {}, 1],
  ] as const)('un token %s responde 401 y no escribe', async (_, datos, version) => {
    expect(await subirCon(await token(e, datos, T0, version))).toEqual({ status: 401, filas: 0 });
  });

  it('un token vencido responde 401 y no escribe', async () => {
    expect(await subirCon(await token(e, {}, T0 - 13 * 3_600_000))).toEqual({
      status: 401,
      filas: 0,
    });
  });

  it('un token firmado con otra clave responde 401 y no escribe', async () => {
    const otra = await abrir();
    try {
      expect(await subirCon(await token(otra))).toEqual({ status: 401, filas: 0 });
    } finally {
      await otra.cerrar();
    }
  });
});

describe('CA3 · ks:parqueadero apagado', () => {
  it('responde 503 con Retry-After antes de mirar el token, y la salud sigue', async () => {
    const r = await pedir(
      e,
      '/api/v1/sync/push',
      null,
      { method: 'POST' },
      {
        FLAGS: kv({ 'ks:parqueadero': 'apagado' }),
      },
    );
    expect(r.status).toBe(503);
    expect(r.headers.get('retry-after')).toBe('120');
    expect(await r.json()).toMatchObject({ estado: 'apagado' });
    const salud = await pedir(
      e,
      '/api/salud',
      null,
      {},
      {
        FLAGS: kv({ 'ks:parqueadero': 'apagado' }),
      },
    );
    expect(salud.status).toBe(200);
  });

  it('el kill switch de otro producto no lo apaga', async () => {
    const r = await pedir(
      e,
      '/api/v1/yo',
      await token(e),
      {},
      {
        FLAGS: kv({ 'ks:agro-cuaderno': 'apagado', 'ks:parqueadero-fotos': 'apagado' }),
      },
    );
    expect(r.status).toBe(200);
  });
});

describe('CORS', () => {
  it('solo responde al origen de la caja', async () => {
    const pre = (origen: string) =>
      pedir(e, '/api/v1/sync/push', null, {
        method: 'OPTIONS',
        headers: { origin: origen, 'access-control-request-method': 'POST' },
      });
    expect((await pre(CAJA)).headers.get('access-control-allow-origin')).toBe(CAJA);
    expect(
      (await pre('https://otro.ejemplo.test')).headers.get('access-control-allow-origin'),
    ).toBe(null);
  });
});
