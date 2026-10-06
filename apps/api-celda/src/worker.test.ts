/**
 * API de la celda (HU-E5.1) contra el D1 local de un shard y tokens firmados con una clave de
 * prueba. Lo que el D1 local no imita: ver `@ed1/d1/local` (P17).
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal, vaciar } from '@ed1/d1/local';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp, type Env, TABLAS_DEL_SHARD } from './worker.ts';

const T0 = Date.UTC(2026, 9, 1, 12);
const APP = 'https://agro.ejemplo.test';
const SHARD = 'agro_c0_s1';

let db: BaseD1;
let cerrar: () => Promise<void>;
let firmante: Firmante;
beforeAll(async () => {
  ({ db, cerrar } = await baseLocal({
    configuracion: 'apps/api-celda/wrangler.c0.jsonc',
    binding: SHARD,
    base: 'celda',
  }));
  firmante = await firmanteDesde(await generarClavePrivada());
}, 60_000);
afterAll(async () => cerrar?.());
beforeEach(async () => vaciar(db, [...TABLAS_DEL_SHARD]));

const app = crearApp({ ahora: () => T0 });
const env = (extra: Partial<Env> = {}): Env => ({
  CELDA: 'c0',
  PRODUCTO: 'agro',
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  ORIGENES_APP: APP,
  [SHARD]: db,
  ...extra,
});

const token = async (datos: Partial<Parameters<typeof firmarAcceso>[1]> = {}, ahora = T0) =>
  (
    await firmarAcceso(
      firmante,
      {
        sub: 'u1',
        org: 'org-uno',
        rol: 'operario',
        celda: 'c0',
        shard: SHARD,
        anillo: 1,
        ...datos,
      },
      ahora,
    )
  ).token;

const yo = async (t: string | null, e: Env = env(), ruta = '/api/v1/yo') =>
  app.fetch(
    new Request(`https://api.ejemplo.test${ruta}`, {
      headers: t ? { authorization: `Bearer ${t}` } : {},
    }),
    e,
  );

/** Un registro mínimo directo en la base (los de verdad llegan con el push, HU-E5.2). */
const registro = (id: string, org: string, seq: number) =>
  db
    .prepare(
      `INSERT INTO registro (id, org_id, seq, finca_id, area_ids, tipo, v, fecha_agronomica,
         instante_evento, instante_recibido, persona_ids, dispositivo_id, origen, datos)
       VALUES (?, ?, ?, 'finca', '[]', 'clima', 1, '2026-10-01', '2026-10-01T12:00:00Z',
         '2026-10-01T12:00:01Z', '[]', 'telefono', 'manual', '{}')`,
    )
    .bind(id, org, seq)
    .run();

describe('CA2 · migración del shard', () => {
  it('crea las cuatro tablas, todas con org_id (tenant en cada fila)', async () => {
    const { results } = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name",
      )
      .all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual([...TABLAS_DEL_SHARD].sort());
    for (const tabla of TABLAS_DEL_SHARD) {
      const columnas = await db
        .prepare(`SELECT name FROM pragma_table_info('${tabla}')`)
        .all<{ name: string }>();
      expect(
        columnas.results.map((c) => c.name),
        tabla,
      ).toContain('org_id');
    }
  });

  it('los índices son exactamente los justificados en la migración (cada uno cuesta escrituras)', async () => {
    const { results } = await db
      .prepare(
        "SELECT tbl_name AS tabla, name FROM sqlite_master WHERE type = 'index' ORDER BY tbl_name, name",
      )
      .all<{ tabla: string; name: string }>();
    const nombrados = results.filter((r) => !r.name.startsWith('sqlite_autoindex'));
    expect(nombrados).toEqual([
      { tabla: 'catalogo', name: 'catalogo_pull' },
      { tabla: 'registro', name: 'registro_pull' },
    ]);
  });

  it('dos registros de la misma organización no pueden compartir seq, y el mismo id no entra dos veces', async () => {
    await registro('r1', 'org-uno', 1);
    await expect(registro('r2', 'org-uno', 1)).rejects.toThrow(/UNIQUE/);
    await expect(registro('r1', 'org-dos', 1)).rejects.toThrow(/UNIQUE/);
    await registro('r3', 'org-dos', 1); // otra organización, su propia secuencia
  });
});

describe('CA1 · todo /api/v1/* exige un token del CORE; org y shard salen del token', () => {
  it('con un token válido responde con su organización y cuenta solo sus registros', async () => {
    await registro('a1', 'org-uno', 1);
    await registro('a2', 'org-uno', 2);
    await registro('b1', 'org-dos', 1);
    const r = await yo(await token());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      org: 'org-uno',
      rol: 'operario',
      celda: 'c0',
      shard: SHARD,
      registros: 2,
    });
  });

  it('pedir otra organización en la URL no cambia nada: manda el token', async () => {
    await registro('b1', 'org-dos', 1);
    const r = await yo(await token(), env(), '/api/v1/yo?org=org-dos&org_id=org-dos');
    expect(await r.json()).toMatchObject({ org: 'org-uno', registros: 0 });
  });

  it.each([
    ['sin token', async () => null, 401, 'sin-sesion'],
    ['token ilegible', async () => 'basura', 401, 'sin-sesion'],
    ['token vencido', () => token({}, T0 - 13 * 60 * 60 * 1000), 401, 'sin-sesion'],
    [
      'token sin organización',
      () => token({ org: null, rol: null, shard: null, celda: null }),
      403,
      'sin-organizacion',
    ],
    ['token de otra celda', () => token({ celda: 'c9' }), 409, 'otra-celda'],
    [
      'token con un shard que la celda no tiene',
      () => token({ shard: 'agro_c0_s9' }),
      503,
      'sin-shard',
    ],
  ])('%s → %s', async (_caso, hacer, estado, clave) => {
    const r = await yo(await hacer());
    expect(r.status).toBe(estado);
    expect(await r.json()).toMatchObject({ estado: clave });
  });

  it('un token firmado con otra clave no entra', async () => {
    const otro = await firmanteDesde(await generarClavePrivada());
    const ajeno = (
      await firmarAcceso(
        otro,
        { sub: 'u', org: 'org-uno', rol: 'propietario', celda: 'c0', shard: SHARD, anillo: 1 },
        T0,
      )
    ).token;
    expect((await yo(ajeno)).status).toBe(401);
  });
});

describe('CA3 · kill switch ks:agro-cuaderno', () => {
  it('apagado responde 503 con Retry-After y el motivo en español, aun con un token válido', async () => {
    const flags = {
      get: async (k: string) => (k === 'ks:agro-cuaderno' ? 'apagado' : 'encendido'),
    };
    const r = await yo(await token(), env({ FLAGS: flags }));
    expect(r.status).toBe(503);
    expect(r.headers.get('retry-after')).toBe('120');
    expect(await r.json()).toMatchObject({
      motivo: expect.stringContaining('Tus registros siguen guardados en este teléfono'),
    });
  });

  it('encendido no estorba', async () => {
    const flags = { get: async () => 'encendido' };
    expect((await yo(await token(), env({ FLAGS: flags }))).status).toBe(200);
  });
});

describe('salud y configuración (CA4: todo sale de la configuración)', () => {
  const salud = (e: Env) => app.fetch(new Request('https://api.ejemplo.test/api/salud'), e);

  it('con la configuración y el shard migrado responde 200', async () => {
    const r = await salud(env());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ estado: 'ok', celda: 'c0', shards: 1 });
  });

  it('sin claves del CORE ni orígenes responde 503 y dice qué falta (P1)', async () => {
    const r = await salud(env({ CORE_CLAVES: '', ORIGENES_APP: '' }));
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ motivo: 'Falta CORE_CLAVES, ORIGENES_APP' });
  });

  it('un shard sin las tablas de la migración se nombra', async () => {
    const vacia = {
      prepare: () => ({ bind: () => ({ first: async () => ({ n: 0 }) }) }),
    } as unknown as BaseD1;
    const r = await salud(env({ [SHARD]: vacia }));
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ motivo: `${SHARD}: faltan tablas de la migración` });
  });

  it('solo el cuaderno puede llamar a la API desde el navegador', async () => {
    const pre = (origen: string) =>
      app.fetch(
        new Request('https://api.ejemplo.test/api/v1/yo', {
          method: 'OPTIONS',
          headers: {
            origin: origen,
            'access-control-request-method': 'GET',
            'access-control-request-headers': 'authorization',
          },
        }),
        env(),
      );
    expect((await pre(APP)).headers.get('access-control-allow-origin')).toBe(APP);
    expect((await pre('https://malo.test')).headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('bitácora agro 23 · una falla inesperada se responde en JSON con su causa', () => {
  it('si D1 falla, 503 con «falla-celda» y Retry-After, nunca un 500 en texto', async () => {
    const rota = {
      prepare: () => {
        throw new Error('D1_ERROR: algo salió mal');
      },
      batch: async () => [],
    } as unknown as BaseD1;
    const r = await yo(await token(), env({ [SHARD]: rota }));
    expect(r.status).toBe(503);
    expect(r.headers.get('retry-after')).toBe('60');
    expect(await r.json()).toMatchObject({ estado: 'falla-celda' });
  });
});

describe('HU-C4.1 · la celda acepta solo tokens de su producto', () => {
  const v2 = async (aud: string) =>
    (
      await firmarAcceso(
        firmante,
        { sub: 'u1', org: 'org-uno', rol: 'operario', celda: 'c0', shard: SHARD, anillo: 1, aud },
        T0,
        2,
      )
    ).token;

  it('un v2 del agro y un v1 entran; un v2 de otro producto no', async () => {
    expect((await yo(await v2('agro'))).status).toBe(200);
    expect((await yo(await token())).status).toBe(200);
    const otro = await yo(await v2('ensayo'));
    expect(otro.status).toBe(401);
    expect(await otro.json()).toMatchObject({ estado: 'sin-sesion' });
  });

  it('en una celda de otro producto, el v1 (sin producto) ya no entra', async () => {
    expect((await yo(await token(), env({ PRODUCTO: 'ensayo' }))).status).toBe(401);
    expect((await yo(await v2('ensayo'), env({ PRODUCTO: 'ensayo' }))).status).toBe(200);
  });

  it('una celda que no sabe su producto no acepta a nadie, y lo dice en la salud', async () => {
    const { PRODUCTO: _, ...sinProducto } = env();
    expect((await yo(await token(), sinProducto as Env)).status).toBe(503);
    const salud = await app.fetch(
      new Request('https://api.ejemplo.test/api/salud'),
      sinProducto as Env,
    );
    expect(JSON.stringify(await salud.json())).toContain('PRODUCTO');
  });
});
