/**
 * Subir registros sin duplicar ni perder (HU-E5.2, lado de la celda) contra el D1 local de un
 * shard, con las dos fincas de prueba (P4). Lo que el D1 local no imita: ver
 * `@ed1/d1/local` (P17); el límite de 50 consultas por invocación se cuenta aquí.
 */
import { uuidv7 } from '@ed1/agro-schema';
import { LOTE_MAXIMO, type Operacion } from '@ed1/agro-schema/sync';
import type { BaseD1, SentenciaD1 } from '@ed1/d1';
import { baseLocal, vaciar } from '@ed1/d1/local';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FINCA_ENSAYO_DOS, FINCA_ENSAYO_UNO } from '../../../tests/fixtures/fincas.ts';
import { crearApp, type Env, TABLAS_DEL_SHARD } from './worker.ts';

const T0 = Date.UTC(2026, 9, 1, 12);
const SHARD = 'agro_c0_s1';
const ORG_UNO = uuidv7(() => T0);
const ORG_DOS = uuidv7(() => T0 + 1);
const LIMITE_D1_GRATUITO = 50;

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

/** Cuenta cada consulta que llega a D1, también las de un batch (CA1, P17). */
function contando(base: BaseD1) {
  const cuenta = { consultas: 0 };
  const reales = new WeakMap<object, SentenciaD1>();
  const envolver = (s: SentenciaD1): SentenciaD1 => {
    const e: SentenciaD1 = {
      bind: (...v) => envolver(s.bind(...v)),
      first: (...a) => {
        cuenta.consultas++;
        return s.first(...a);
      },
      all: (...a) => {
        cuenta.consultas++;
        return s.all(...a);
      },
      run: () => {
        cuenta.consultas++;
        return s.run();
      },
    } as SentenciaD1;
    reales.set(e, s);
    return e;
  };
  const envuelta: BaseD1 = {
    prepare: (sql) => envolver(base.prepare(sql)),
    batch: (sentencias) => {
      cuenta.consultas += sentencias.length;
      return base.batch(sentencias.map((s) => reales.get(s) ?? s));
    },
  };
  return { db: envuelta, cuenta, reales };
}

const app = crearApp({ ahora: () => T0 });
const env = (base: BaseD1 = db): Env => ({
  CELDA: 'c0',
  PRODUCTO: 'agro',
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  ORIGENES_APP: 'https://agro.ejemplo.test',
  [SHARD]: base,
});
const tokenDe = async (org: string) =>
  (
    await firmarAcceso(
      firmante,
      { sub: 'u1', org, rol: 'propietario', celda: 'c0', shard: SHARD, anillo: 1, aud: 'agro' },
      T0,
    )
  ).token;

async function push(
  org: string,
  ops: unknown[],
  base: BaseD1 = db,
  extra: Record<string, unknown> = {},
) {
  const r = await app.fetch(
    new Request('https://api.ejemplo.test/api/v1/sync/push', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await tokenDe(org)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocolo: 1,
        dispositivo: 'telefono-1',
        app: '0.1.0',
        ops,
        ...extra,
      }),
    }),
    env(base),
  );
  return {
    estado: r.status,
    cuerpo: (await r.json()) as { acks: { id: string; estado: string; motivo?: string }[] },
  };
}

let t = T0;
const nuevoId = () => uuidv7(() => ++t);
const actualizado = '2026-10-01T12:00:00.000Z';

const fincaOp = (
  id: string,
  nombre: string,
  version = 1,
  municipio = 'Municipio Ensayo',
): Operacion => ({
  id: `${id}@v${version}`,
  entidad: 'finca',
  entidad_id: id,
  version,
  datos: { id, org_id: null, version, actualizado, nombre, municipio, regimen: 'ecologico' },
});
const areaOp = (id: string, fincaId: string, nombre: string): Operacion => ({
  id: `${id}@v1`,
  entidad: 'area',
  entidad_id: id,
  version: 1,
  datos: {
    id,
    org_id: null,
    version: 1,
    actualizado,
    finca_id: fincaId,
    padre_id: null,
    tipo: 'nave',
    nombre,
    area_m2: 500,
    capacidad_plantas: null,
    activa: true,
  },
});
const climaOp = (fincaId: string, areaId: string, humedad = 70, id = nuevoId()): Operacion => ({
  id,
  entidad: 'registro',
  entidad_id: id,
  version: 1,
  datos: {
    id,
    org_id: null,
    finca_id: fincaId,
    area_ids: [areaId],
    ciclo_id: null,
    tipo: 'clima',
    v: 1,
    fecha_agronomica: '2026-10-01',
    instante_evento: '2026-10-01T12:00:00.000Z',
    autor_usuario_id: null,
    persona_ids: [],
    dispositivo_id: 'telefono-1',
    origen: 'manual',
    anula_id: null,
    datos: { temperaturaC: 24, humedadRelativaPct: humedad, temperaturaHojaC: null, dpvKPa: 0.895 },
  },
});
const contar = async (tabla: string, org?: string) =>
  (
    await db
      .prepare(`SELECT count(*) AS n FROM ${tabla}${org ? ' WHERE org_id = ?' : ''}`)
      .bind(...(org ? [org] : []))
      .first<{ n: number }>()
  )?.n;

/** Una finca de prueba con un área, ya en la nube. */
async function fincaEnLaNube(org: string, f = FINCA_ENSAYO_UNO) {
  const finca = nuevoId();
  const area = nuevoId();
  const r = await push(org, [
    fincaOp(finca, f.finca.nombre),
    areaOp(area, finca, f.areas[0]?.nombre ?? 'Nave 1'),
  ]);
  expect(r.cuerpo.acks.map((a) => a.estado)).toEqual(['aceptado', 'aceptado']);
  return { finca, area };
}

describe('CA1 · lotes de ≤ 25 operaciones, dentro de las 50 consultas de D1 gratuito', () => {
  it('un lote lleno de registros nuevos usa como mucho 3 lecturas + 1 escritura por operación', async () => {
    const { finca, area } = await fincaEnLaNube(ORG_UNO);
    const { db: contada, cuenta } = contando(db);
    const ops = Array.from({ length: LOTE_MAXIMO }, () => climaOp(finca, area));
    const r = await push(ORG_UNO, ops, contada);
    expect(r.cuerpo.acks.every((a) => a.estado === 'aceptado')).toBe(true);
    expect(cuenta.consultas).toBeLessThanOrEqual(3 + LOTE_MAXIMO);
    expect(cuenta.consultas).toBeLessThanOrEqual(LIMITE_D1_GRATUITO);
  });

  it('un lote lleno de catálogos actualizados también cabe', async () => {
    const finca = nuevoId();
    const areas = Array.from({ length: LOTE_MAXIMO - 1 }, () => nuevoId());
    await push(ORG_UNO, [
      fincaOp(finca, 'Finca Ensayo Uno'),
      ...areas.map((a, i) => areaOp(a, finca, `Nave ${i}`)),
    ]);
    const { db: contada, cuenta } = contando(db);
    const v2 = areas.map((a, i) => {
      const op = areaOp(a, finca, `Nave ${i} renombrada`);
      return { ...op, id: `${a}@v2`, version: 2, datos: { ...(op.datos as object), version: 2 } };
    });
    const r = await push(ORG_UNO, [fincaOp(finca, 'Finca Ensayo Uno', 2), ...v2], contada);
    expect(r.cuerpo.acks.every((a) => a.estado === 'aceptado')).toBe(true);
    expect(cuenta.consultas).toBeLessThanOrEqual(LIMITE_D1_GRATUITO);
    expect(await contar('entidad_historial')).toBe(LOTE_MAXIMO); // cada versión 1 quedó en el historial
  });

  it(`un lote de ${LOTE_MAXIMO + 1} se rechaza entero sin escribir: el teléfono parte el lote`, async () => {
    const { finca, area } = await fincaEnLaNube(ORG_UNO);
    const r = await push(
      ORG_UNO,
      Array.from({ length: LOTE_MAXIMO + 1 }, () => climaOp(finca, area)),
    );
    expect(r.estado).toBe(413);
    expect(await contar('registro')).toBe(0);
  });
});

describe('CA2 · reenviar el mismo lote no duplica', () => {
  it('cada operación vuelve como duplicado y no hay filas nuevas', async () => {
    const { finca, area } = await fincaEnLaNube(ORG_UNO);
    const ops = [climaOp(finca, area), climaOp(finca, area)];
    await push(ORG_UNO, ops);
    const otra = await push(ORG_UNO, ops);
    expect(otra.cuerpo.acks.map((a) => a.estado)).toEqual(['duplicado', 'duplicado']);
    expect(await contar('registro')).toBe(2);
    const finca2 = await push(ORG_UNO, [fincaOp(finca, FINCA_ENSAYO_UNO.finca.nombre)]);
    expect(finca2.cuerpo.acks[0]?.estado).toBe('duplicado');
  });

  it('seq crece por organización, cada una con la suya', async () => {
    const uno = await fincaEnLaNube(ORG_UNO, FINCA_ENSAYO_UNO);
    const dos = await fincaEnLaNube(ORG_DOS, FINCA_ENSAYO_DOS);
    await push(ORG_UNO, [climaOp(uno.finca, uno.area), climaOp(uno.finca, uno.area)]);
    await push(ORG_DOS, [climaOp(dos.finca, dos.area)]);
    const seqs = await db
      .prepare('SELECT org_id, seq FROM registro ORDER BY org_id, seq')
      .all<{ org_id: string; seq: number }>();
    expect(seqs.results.filter((r) => r.org_id === ORG_UNO).map((r) => r.seq)).toEqual([1, 2]);
    expect(seqs.results.filter((r) => r.org_id === ORG_DOS).map((r) => r.seq)).toEqual([1]);
  });
});

describe('CA3 · lo que no valida va a cuarentena con su motivo; nunca se descarta', () => {
  it('una humedad de 120 % queda en cuarentena nombrando el campo, y el resto del lote entra', async () => {
    const { finca, area } = await fincaEnLaNube(ORG_UNO);
    const mala = climaOp(finca, area, 120);
    const r = await push(ORG_UNO, [climaOp(finca, area), mala]);
    expect(r.cuerpo.acks[0]?.estado).toBe('aceptado');
    expect(r.cuerpo.acks[1]).toMatchObject({
      id: mala.id,
      estado: 'cuarentena',
      motivo: expect.stringContaining('datos.humedadRelativaPct'),
    });
    const guardada = await db
      .prepare('SELECT motivo, operacion FROM cuarentena WHERE id = ?')
      .bind(mala.id)
      .first<{ motivo: string; operacion: string }>();
    expect(JSON.parse(guardada?.operacion ?? '{}')).toEqual(mala);
    await push(ORG_UNO, [mala]); // reenviarla no la duplica
    expect(await contar('cuarentena')).toBe(1);
  });

  it.each([
    [
      'de otra organización',
      (f: { finca: string; area: string }) => {
        const op = climaOp(f.finca, f.area);
        return { ...op, datos: { ...(op.datos as object), org_id: ORG_DOS } };
      },
      'El dato es de otra organización',
    ],
    [
      'de otra finca',
      (f: { finca: string; area: string }) => climaOp(nuevoId(), f.area),
      'El dato es de otra finca',
    ],
    [
      'una segunda finca',
      () => fincaOp(nuevoId(), FINCA_ENSAYO_DOS.finca.nombre),
      'ya tiene otra finca',
    ],
  ])('tenant: un dato %s va a cuarentena', async (_caso, hacer, motivo) => {
    const f = await fincaEnLaNube(ORG_UNO);
    const r = await push(ORG_UNO, [hacer(f)]);
    expect(r.cuerpo.acks[0]).toMatchObject({
      estado: 'cuarentena',
      motivo: expect.stringContaining(motivo),
    });
  });

  it('un id que ya usa otra organización no se pisa ni se dice duplicado', async () => {
    const uno = await fincaEnLaNube(ORG_UNO, FINCA_ENSAYO_UNO);
    const dos = await fincaEnLaNube(ORG_DOS, FINCA_ENSAYO_DOS);
    const op = climaOp(uno.finca, uno.area);
    await push(ORG_UNO, [op]);
    const ajena = climaOp(dos.finca, dos.area, 70, op.id);
    const r = await push(ORG_DOS, [ajena]);
    expect(r.cuerpo.acks[0]).toMatchObject({
      estado: 'cuarentena',
      motivo: 'Ese id ya lo usa otra organización',
    });
  });

  it('un registro antes de que exista la finca espera en cuarentena con el motivo', async () => {
    const r = await push(ORG_UNO, [climaOp(nuevoId(), nuevoId())]);
    expect(r.cuerpo.acks[0]?.motivo).toBe(
      'La finca todavía no está en la nube: debe subir primero',
    );
  });
});

describe('catálogos: la última escritura gana y ninguna versión se pierde (ADR-4)', () => {
  it('HU-E5.4 CA1: dos teléfonos editan sin señal: gana el último que llega y el otro queda en el historial', async () => {
    const { finca } = await fincaEnLaNube(ORG_UNO);
    const v2 = await push(ORG_UNO, [fincaOp(finca, 'Finca Ensayo Uno', 2, 'Otro municipio')]);
    expect(v2.cuerpo.acks[0]?.estado).toBe('aceptado');
    expect(await db.prepare('SELECT motivo, version FROM entidad_historial').first()).toEqual({
      motivo: 'edicion',
      version: 1,
    });
    // Otro teléfono editó la v1 sin señal y llega después: gana, con la versión siguiente.
    const otro = await push(
      ORG_UNO,
      [fincaOp(finca, 'Finca Ensayo Uno', 2, 'Municipio de otro teléfono')],
      db,
      { dispositivo: 'telefono-2' },
    );
    expect(otro.cuerpo.acks[0]?.estado).toBe('aceptado');
    const vigente = await db
      .prepare('SELECT version, datos, reemplazo FROM catalogo WHERE id = ?')
      .bind(finca)
      .first<{ version: number; datos: string; reemplazo: string }>();
    expect(vigente?.version).toBe(3);
    expect(JSON.parse(vigente?.datos ?? '{}')).toMatchObject({
      version: 3,
      municipio: 'Municipio de otro teléfono',
    });
    // A quién se le reemplazó: el teléfono 1, que lo avisará al bajar.
    expect(JSON.parse(vigente?.reemplazo ?? '{}')).toEqual({
      version: 2,
      dispositivo: 'telefono-1',
      por_usuario: 'u1',
    });
    const perdida = await db
      .prepare("SELECT version, datos FROM entidad_historial WHERE motivo = 'conflicto'")
      .first<{ version: number; datos: string }>();
    expect(perdida?.version).toBe(2);
    expect(JSON.parse(perdida?.datos ?? '{}')).toMatchObject({ municipio: 'Otro municipio' });
    // Reenviar lo que la celda ya tiene (la v1 o la v2 del historial) no pisa nada.
    for (const [version, municipio] of [
      [1, 'Municipio Ensayo'],
      [2, 'Otro municipio'],
    ] as const) {
      const r = await push(ORG_UNO, [fincaOp(finca, 'Finca Ensayo Uno', version, municipio)]);
      expect(r.cuerpo.acks[0]?.estado).toBe('duplicado');
    }
    expect(
      await db.prepare('SELECT version FROM catalogo WHERE id = ?').bind(finca).first(),
    ).toEqual({ version: 3 });
  });

  it('HU-E5.4: dos ediciones seguidas del mismo teléfono no se avisan como conflicto', async () => {
    const { finca } = await fincaEnLaNube(ORG_UNO);
    await push(ORG_UNO, [fincaOp(finca, 'Finca Ensayo Uno', 2, 'Municipio a')]);
    await push(ORG_UNO, [fincaOp(finca, 'Finca Ensayo Uno', 2, 'Municipio b')]);
    expect(
      await db.prepare('SELECT version, reemplazo FROM catalogo WHERE id = ?').bind(finca).first(),
    ).toEqual({ version: 3, reemplazo: null });
  });

  it('HU-E5.4 CA3: los registros nunca generan conflicto: el mismo id es siempre el mismo registro', async () => {
    const { finca, area } = await fincaEnLaNube(ORG_UNO);
    const op = climaOp(finca, area, 70);
    expect((await push(ORG_UNO, [op])).cuerpo.acks[0]?.estado).toBe('aceptado');
    const otro = await push(ORG_UNO, [climaOp(finca, area, 40, op.id)], db, {
      dispositivo: 'telefono-2',
    });
    expect(otro.cuerpo.acks[0]?.estado).toBe('duplicado');
    expect(await contar('entidad_historial')).toBe(0);
    const guardado = await db
      .prepare('SELECT datos FROM registro WHERE id = ?')
      .bind(op.id)
      .first<{ datos: string }>();
    expect(JSON.parse(guardado?.datos ?? '{}')).toMatchObject({ humedadRelativaPct: 70 });
  });

  it('si otro teléfono escribió en el mismo instante, responde «reintentar» y no pierde la versión', async () => {
    const { finca } = await fincaEnLaNube(ORG_UNO);
    // Entre la lectura y la escritura, otro teléfono deja la finca en v3.
    const { db: base, reales } = contando(db);
    const conCarrera: BaseD1 = {
      prepare: base.prepare,
      batch: async (s) => {
        await db
          .prepare(
            "UPDATE catalogo SET version = 3, actualizado = '2026-10-01T12:05:00.000Z' WHERE id = ?",
          )
          .bind(finca)
          .run();
        return db.batch(s.map((x) => reales.get(x) ?? x));
      },
    };
    const v2 = fincaOp(finca, 'Finca Ensayo Uno', 2, 'Municipio v2');
    const r = await push(ORG_UNO, [v2], conCarrera);
    expect(r.cuerpo.acks[0]?.estado).toBe('reintentar');
    // En la vuelta siguiente decide la regla de HU-E5.4: gana la que llega última, y la v3 del
    // otro teléfono queda en el historial.
    const otra = await push(ORG_UNO, [v2]);
    expect(otra.cuerpo.acks[0]?.estado).toBe('aceptado');
    const vigente = await db
      .prepare('SELECT version, datos FROM catalogo WHERE id = ?')
      .bind(finca)
      .first<{ version: number; datos: string }>();
    expect(vigente?.version).toBe(4);
    expect(JSON.parse(vigente?.datos ?? '{}')).toMatchObject({ municipio: 'Municipio v2' });
    expect(
      await db
        .prepare('SELECT version FROM entidad_historial WHERE entidad_id = ? AND version = 3')
        .bind(finca)
        .first(),
    ).toEqual({ version: 3 });
  });
});

describe('protocolo', () => {
  it('otra versión del protocolo pide actualizar la app y no escribe nada', async () => {
    const r = await push(ORG_UNO, [fincaOp(nuevoId(), 'Finca Ensayo Uno')], db, { protocolo: 2 });
    expect(r.estado).toBe(400);
    expect(await contar('catalogo')).toBe(0);
  });
});
