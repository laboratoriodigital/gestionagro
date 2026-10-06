/**
 * Bajar cambios (HU-E5.3, lado de la celda) contra el D1 local de un shard. Los datos entran por
 * el push real, como en producción. Lo que el D1 local no imita: `@ed1/d1/local` (P17).
 */
import { uuidv7, validarRegistro } from '@ed1/agro-schema';
import type { BaseD1, SentenciaD1 } from '@ed1/d1';
import { baseLocal, vaciar } from '@ed1/d1/local';
import { PAGINA_MAXIMA, type RespuestaPull } from '@ed1/sync';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp, type Env, TABLAS_DEL_SHARD } from './worker.ts';

const T0 = Date.UTC(2026, 9, 1, 12);
const SHARD = 'agro_c0_s1';
const ORG_UNO = uuidv7(() => T0);
const ORG_DOS = uuidv7(() => T0 + 1);

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

let ahora = T0;
const app = crearApp({ ahora: () => ahora });
const env = (extra: Partial<Env> = {}, base: BaseD1 = db): Env => ({
  CELDA: 'c0',
  PRODUCTO: 'agro',
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  ORIGENES_APP: 'https://agro.ejemplo.test',
  [SHARD]: base,
  ...extra,
});
const token = async (org: string) =>
  (
    await firmarAcceso(
      firmante,
      { sub: 'u1', org, rol: 'propietario', celda: 'c0', shard: SHARD, anillo: 1 },
      T0,
    )
  ).token;

let t = T0;
const nuevoId = () => uuidv7(() => ++t);
const actualizado = '2026-10-01T12:00:00.000Z';

async function subir(org: string, ops: object[]) {
  const r = await app.fetch(
    new Request('https://api.ejemplo.test/api/v1/sync/push', {
      method: 'POST',
      headers: { authorization: `Bearer ${await token(org)}`, 'content-type': 'application/json' },
      body: JSON.stringify({ protocolo: 1, dispositivo: 'telefono-a', app: '0.1.0', ops }),
    }),
    env(),
  );
  expect(r.status).toBe(200);
}

/** Una finca con un área y `n` registros de clima, subidos en lotes de 25. */
async function fincaConRegistros(org: string, nombre: string, n: number) {
  const finca = nuevoId();
  const area = nuevoId();
  await subir(org, [
    {
      id: `${finca}@v1`,
      entidad: 'finca',
      entidad_id: finca,
      version: 1,
      datos: {
        id: finca,
        org_id: null,
        version: 1,
        actualizado,
        nombre,
        municipio: 'Municipio Ensayo',
        regimen: 'ecologico',
      },
    },
    {
      id: `${area}@v1`,
      entidad: 'area',
      entidad_id: area,
      version: 1,
      datos: {
        id: area,
        org_id: null,
        version: 1,
        actualizado,
        finca_id: finca,
        padre_id: null,
        tipo: 'nave',
        nombre: 'Nave 1',
        area_m2: 500,
        capacidad_plantas: null,
        activa: true,
      },
    },
  ]);
  const ops = Array.from({ length: n }, () => {
    const id = nuevoId();
    return {
      id,
      entidad: 'registro',
      entidad_id: id,
      version: 1,
      datos: {
        id,
        org_id: null,
        finca_id: finca,
        area_ids: [area],
        ciclo_id: null,
        tipo: 'clima',
        v: 1,
        fecha_agronomica: '2026-10-01',
        instante_evento: actualizado,
        autor_usuario_id: null,
        persona_ids: [],
        dispositivo_id: 'telefono-a',
        origen: 'manual',
        anula_id: null,
        datos: { temperaturaC: 24, humedadRelativaPct: 70, temperaturaHojaC: null, dpvKPa: 0.895 },
      },
    };
  });
  for (let i = 0; i < ops.length; i += 25) await subir(org, ops.slice(i, i + 25));
  return { finca, area };
}

async function bajar(org: string, cursor = { registro: 0, catalogo: 0 }, e: Env = env()) {
  const r = await app.fetch(
    new Request(
      `https://api.ejemplo.test/api/v1/sync/pull?registro=${cursor.registro}&catalogo=${cursor.catalogo}`,
      {
        headers: { authorization: `Bearer ${await token(org)}` },
      },
    ),
    e,
  );
  return {
    estado: r.status,
    cabeceras: r.headers,
    cuerpo: (await r.json()) as RespuestaPull & { motivo?: string },
  };
}

describe('CA1 · páginas de ≤ 200 con el cursor del teléfono, sin escribir nada', () => {
  it('250 registros salen en dos páginas, los catálogos primero, y el cursor no repite nada', async () => {
    await fincaConRegistros(ORG_UNO, 'Finca Ensayo Uno', 250);
    const p1 = await bajar(ORG_UNO);
    expect(p1.cuerpo.catalogos.map((c) => c.entidad)).toEqual(['finca', 'area']);
    expect(p1.cuerpo.catalogos.length + p1.cuerpo.registros.length).toBe(PAGINA_MAXIMA);
    expect(p1.cuerpo.mas).toBe(true);
    const p2 = await bajar(ORG_UNO, p1.cuerpo.cursor);
    expect(p2.cuerpo.catalogos).toEqual([]);
    expect(p2.cuerpo.registros).toHaveLength(250 - (PAGINA_MAXIMA - 2));
    expect(p2.cuerpo.mas).toBe(false);
    const ids = [...p1.cuerpo.registros, ...p2.cuerpo.registros].map((r) => r.id);
    expect(new Set(ids).size).toBe(250);
    const p3 = await bajar(ORG_UNO, p2.cuerpo.cursor);
    expect(p3.cuerpo).toMatchObject({
      catalogos: [],
      registros: [],
      mas: false,
      cursor: p2.cuerpo.cursor,
    });
  }, 60_000); // sube 250 registros antes de bajarlos: con toda la suite en paralelo pasa de 5 s

  it('atender un pull no escribe ninguna fila', async () => {
    await fincaConRegistros(ORG_UNO, 'Finca Ensayo Uno', 3);
    const sentencias: string[] = [];
    const contada: BaseD1 = {
      prepare: (sql) => {
        sentencias.push(sql);
        return db.prepare(sql);
      },
      batch: (s: SentenciaD1[]) => {
        sentencias.push(`batch de ${s.length}`);
        return db.batch(s);
      },
    };
    const r = await bajar(ORG_UNO, { registro: 0, catalogo: 0 }, env({}, contada));
    expect(r.estado).toBe(200);
    expect(sentencias).toHaveLength(2);
    expect(sentencias.every((s) => /^\s*SELECT/i.test(s))).toBe(true);
  });

  it('lo que baja tiene la forma del teléfono: valida con el mismo esquema y no trae seq', async () => {
    await fincaConRegistros(ORG_UNO, 'Finca Ensayo Uno', 2);
    const r = await bajar(ORG_UNO);
    for (const registro of r.cuerpo.registros) {
      expect(() => validarRegistro(registro)).not.toThrow();
      expect(registro).not.toHaveProperty('seq');
      expect(registro).not.toHaveProperty('instante_recibido');
      expect(registro.org_id).toBe(ORG_UNO);
    }
  });

  it('cada organización baja solo lo suyo (tenant del token)', async () => {
    await fincaConRegistros(ORG_UNO, 'Finca Ensayo Uno', 3);
    await fincaConRegistros(ORG_DOS, 'Finca Ensayo Dos', 2);
    const dos = await bajar(ORG_DOS);
    expect(dos.cuerpo.registros).toHaveLength(2);
    expect(dos.cuerpo.catalogos.find((c) => c.entidad === 'finca')?.datos).toMatchObject({
      nombre: 'Finca Ensayo Dos',
    });
    expect([
      ...dos.cuerpo.registros.map((r) => r.org_id),
      ...dos.cuerpo.catalogos.map((c) => c.datos.org_id),
    ]).toEqual(Array(4).fill(ORG_DOS));
  });

  it('un cursor ilegible responde 400', async () => {
    const r = await app.fetch(
      new Request('https://api.ejemplo.test/api/v1/sync/pull?registro=-1&catalogo=0', {
        headers: { authorization: `Bearer ${await token(ORG_UNO)}` },
      }),
      env(),
    );
    expect(r.status).toBe(400);
  });
});

describe('CA3 y HU-E8.6 · la celda según su nivel (ARQUITECTURA §8.2)', () => {
  const conNivel = (nivel: string) => ({
    get: async (k: string) => (k === 'nivel' ? nivel : 'encendido'),
  });
  const subirCon = async (nivel: string) => {
    const id = nuevoId();
    const r = await app.fetch(
      new Request('https://api.ejemplo.test/api/v1/sync/push', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await token(ORG_UNO)}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          protocolo: 1,
          dispositivo: 't',
          app: '0.1.0',
          ops: [{ id, entidad: 'registro', entidad_id: id, version: 1, datos: {} }],
        }),
      }),
      env({ FLAGS: conNivel(nivel) }),
    );
    return { estado: r.status, cuerpo: (await r.json()) as { estado?: string; reanuda?: string } };
  };

  it('«esencial» a las 18:59 de Bogotá: el pull espera un minuto y dice la causa; el push sigue', async () => {
    await fincaConRegistros(ORG_UNO, 'Finca Ensayo Uno', 1);
    ahora = Date.UTC(2026, 9, 1, 23, 59); // 18:59 en Bogotá
    const r = await bajar(
      ORG_UNO,
      { registro: 0, catalogo: 0 },
      env({ FLAGS: conNivel('esencial') }),
    );
    expect(r.estado).toBe(503);
    expect(r.cabeceras.get('retry-after')).toBe('60');
    expect(r.cuerpo).toMatchObject({ estado: 'esencial', reanuda: '2026-10-02T00:00:00.000Z' });
    expect((await subirCon('esencial')).estado).toBe(200);
    ahora = T0;
  });

  it('«bloqueo»: ni sube ni baja, y los dos dicen la causa y cuándo vuelve', async () => {
    await fincaConRegistros(ORG_UNO, 'Finca Ensayo Uno', 1);
    const bajada = await bajar(
      ORG_UNO,
      { registro: 0, catalogo: 0 },
      env({ FLAGS: conNivel('bloqueo') }),
    );
    expect(bajada).toMatchObject({ estado: 503, cuerpo: { estado: 'bloqueo' } });
    const subida = await subirCon('bloqueo');
    expect(subida).toMatchObject({ estado: 503, cuerpo: { estado: 'bloqueo' } });
  });

  it('«ahorro»: todo sigue y el pull lo dice para que el teléfono espacie las revisiones', async () => {
    await fincaConRegistros(ORG_UNO, 'Finca Ensayo Uno', 1);
    const r = await bajar(
      ORG_UNO,
      { registro: 0, catalogo: 0 },
      env({ FLAGS: conNivel('ahorro') }),
    );
    expect(r.estado).toBe(200);
    expect(r.cuerpo.nivel).toBe('ahorro');
  });
});
