/**
 * Lo común de las pruebas de la API del parqueadero: el D1 local del shard de c2, los tokens del
 * CORE firmados con una clave de prueba y los dos parqueaderos de prueba (P4). Lo que el D1 local
 * no imita: ver `@ed1/d1/local` (P17).
 */
import type { BaseD1, SentenciaD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import type { Registro } from '@ed1/parqueadero-schema';
import { DISPOSITIVO, ENTRADA_ENSAYO } from '@ed1/parqueadero-schema/ensayos';
import type { Operacion } from '@ed1/parqueadero-schema/sync';
import { PROTOCOLO } from '@ed1/sync';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { crearApp, type Env, TABLAS_DEL_SHARD } from './worker.ts';

export const T0 = Date.UTC(2026, 9, 7, 12);
export const SHARD = 'parqueadero_c2_s1';
export const CAJA = 'https://caja.ejemplo.test';
/** Ensayo Uno y Ensayo Dos (`@ed1/parqueadero-schema/ensayos`), como organizaciones. */
export const ORG_UNO = '0199b8a0-0000-7000-8000-0000000000a1';
export const ORG_DOS = '0199b8a0-0000-7000-8000-0000000000a2';
/** Las cuentas de prueba: el CORE da ids UUIDv7, como los de los registros. */
export const PROPIETARIO = '0199b8a0-0000-7000-8000-0000000000b1';
export const CAJERO = '0199b8a0-0000-7000-8000-0000000000b2';

export interface Entorno {
  db: BaseD1;
  cerrar: () => Promise<void>;
  firmante: Firmante;
}

export async function abrir(): Promise<Entorno> {
  const { db, cerrar } = await baseLocal({
    configuracion: 'apps/parqueadero-api/wrangler.c2.jsonc',
    binding: SHARD,
    base: 'parqueadero',
  });
  return { db, cerrar, firmante: await firmanteDesde(await generarClavePrivada()) };
}

/**
 * Deja el shard vacío. Un registro solo se borra con una purga autorizada (P21): la prueba la
 * escribe para cada parqueadero antes de borrar, como lo haría el retiro de verdad.
 */
export async function vaciarShard(db: BaseD1): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO purga (org_id, autorizada, autor, exportacion_huella)
       SELECT DISTINCT org_id, '2026-10-07T00:00:00Z', 'prueba', '${'0'.repeat(64)}' FROM registro`,
    )
    .run();
  for (const tabla of TABLAS_DEL_SHARD) await db.prepare(`DELETE FROM ${tabla}`).run();
}

/** Da de alta una caja con su serie, como `POST /api/v1/dispositivos` (HU-Q7.7), sin pasar por él. */
export const alta = (db: BaseD1, org: string, dispositivo: string, serie: string) =>
  db
    .prepare(
      `INSERT INTO dispositivo (org_id, id, serie, nombre, estado, creado) VALUES (?, ?, ?, ?, 'activo', ?)`,
    )
    .bind(org, dispositivo, serie, `Caja ${serie}`, new Date(T0).toISOString())
    .run();

export const app = crearApp({ ahora: () => T0 });

export const env = (e: Entorno, extra: Partial<Env> = {}): Env => ({
  CELDA: 'c2',
  PRODUCTO: 'parqueadero',
  CORE_CLAVES: JSON.stringify([e.firmante.publica]),
  ORIGENES_APP: CAJA,
  [SHARD]: e.db,
  ...extra,
});

type Datos = Parameters<typeof firmarAcceso>[1];

/** Un token v2 del CORE para el parqueadero, como lo emite HU-C4.3; uno v1 no lleva `aud`. */
export const token = async (
  e: Entorno,
  datos: Partial<Datos> = {},
  ahora = T0,
  version: 1 | 2 = 2,
) => {
  const { aud, ...resto }: Datos = {
    sub: PROPIETARIO,
    org: ORG_UNO,
    rol: 'propietario',
    celda: 'c2',
    shard: SHARD,
    anillo: 1,
    aud: 'parqueadero',
    ...datos,
  };
  return (
    await firmarAcceso(e.firmante, version === 2 && aud ? { ...resto, aud } : resto, ahora, version)
  ).token;
};

export const pedir = (
  e: Entorno,
  ruta: string,
  t: string | null,
  init: RequestInit = {},
  ex?: Partial<Env>,
) =>
  app.fetch(
    new Request(`https://api.ejemplo.test${ruta}`, {
      ...init,
      headers: { ...(t ? { authorization: `Bearer ${t}` } : {}), ...(init.headers ?? {}) },
    }),
    env(e, ex),
  );

/** Un id UUIDv7 de prueba, distinto por número. */
export const idDe = (n: number) => `0199bc3e-3b40-7000-8000-${String(n).padStart(12, '0')}`;

/** Una entrada de la caja de prueba con su propio id y consecutivo. */
export const entrada = (n: number, cambios: Partial<Registro> = {}): Registro => ({
  ...ENTRADA_ENSAYO,
  id: idDe(n),
  estadia_id: idDe(n),
  consecutivo: n,
  dispositivo_id: DISPOSITIVO,
  ...cambios,
});

export const anulacion = (
  n: number,
  anula: Registro,
  cambios: Partial<Registro> = {},
): Registro => ({
  ...ENTRADA_ENSAYO,
  id: idDe(n),
  tipo: 'anulacion',
  estadia_id: anula.estadia_id,
  anula_id: anula.id,
  serie: null,
  consecutivo: null,
  datos: { motivo: 'Placa mal escrita', operador: 'Cajero de prueba' },
  ...cambios,
});

export const deRegistro = (r: Registro): Operacion => ({
  id: r.id,
  entidad: 'registro',
  entidad_id: r.id,
  version: 1,
  datos: r,
});

export const deCatalogo = (c: { id: string; version: number; entidad: string }): Operacion => ({
  id: `${c.id}@v${c.version}`,
  entidad: c.entidad as Operacion['entidad'],
  entidad_id: c.id,
  version: c.version,
  datos: c,
});

export const lote = (ops: unknown[], dispositivo = DISPOSITIVO) =>
  JSON.stringify({ protocolo: PROTOCOLO, dispositivo, app: '0.3.0', ops });

/** Cuenta cada consulta que llega a D1, también las de un batch (P17). */
export function contando(base: BaseD1) {
  const cuenta = { consultas: 0, escrituras: 0 };
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
        cuenta.escrituras++;
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
      cuenta.escrituras += sentencias.length;
      return base.batch(sentencias.map((s) => reales.get(s) ?? s));
    },
  };
  return { db: envuelta, cuenta };
}
