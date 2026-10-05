/**
 * Los casos de la receta para rehacer una tabla padre en D1 (PLATAFORMA §4.4, ADR-25, HU-C2.1).
 *
 * Cada caso arma una padre con una hija que la referencia y la rehace como lo haría una
 * migración: crear la nueva, copiar, borrar la vieja, renombrar la nueva. Todo en un solo
 * `batch`, que en D1 es una transacción, como `wrangler` corre cada archivo de migración.
 *
 * - V1: con `defer_foreign_keys` encendido y sin apagarlo. Se esperaba que fallara al confirmar.
 * - W1: apagándolo antes de terminar (el «arreglo» habitual).
 * - W2: como W1, pero la copia pierde una fila padre: una violación real.
 * - W3: W1 con la guarda de huérfanas.
 * - W4: W2 con la guarda.
 *
 * Vive en `packages/d1` porque es lo que la plataforma sabe de D1, y lo comparten el CORE, las
 * celdas y la Tienda.
 */
import type { BaseD1 } from './index.ts';

export type Caso = 'V1' | 'W1' | 'W2' | 'W3' | 'W4';

export const GUARDA = [
  'CREATE TABLE _guarda_fk (huerfanas INTEGER NOT NULL CHECK (huerfanas = 0))',
  'INSERT INTO _guarda_fk (huerfanas) SELECT COUNT(*) FROM pragma_foreign_key_check',
  'DROP TABLE _guarda_fk',
];

/** Prepara la padre `p_<caso>` con 3 filas y la hija `h_<caso>` con una fila por cada padre. */
export async function preparar(db: BaseD1, caso: Caso): Promise<void> {
  const [p, h] = [`p_${caso}`, `h_${caso}`];
  await db.batch(
    [
      `DROP TABLE IF EXISTS ${h}`,
      `DROP TABLE IF EXISTS ${p}`,
      `CREATE TABLE ${p} (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL)`,
      `CREATE TABLE ${h} (id INTEGER PRIMARY KEY, padre INTEGER NOT NULL REFERENCES ${p} (id))`,
      `INSERT INTO ${p} (id, nombre) VALUES (1, 'uno'), (2, 'dos'), (3, 'tres')`,
      `INSERT INTO ${h} (id, padre) VALUES (10, 1), (20, 2), (30, 3)`,
    ].map((s) => db.prepare(s)),
  );
}

/** Las sentencias de la reconstrucción de cada caso. */
export function reconstruccion(caso: Caso): string[] {
  const p = `p_${caso}`;
  const pierde = caso === 'W2' || caso === 'W4';
  const apaga = caso !== 'V1';
  const conGuarda = caso === 'W3' || caso === 'W4';
  return [
    'PRAGMA defer_foreign_keys = on',
    // La tabla nueva gana una columna con valor por defecto: el cambio que obliga a rehacerla.
    `CREATE TABLE ${p}_nueva (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, producto TEXT NOT NULL DEFAULT 'agro')`,
    `INSERT INTO ${p}_nueva (id, nombre) SELECT id, nombre FROM ${p}${pierde ? ' WHERE id <> 3' : ''}`,
    `DROP TABLE ${p}`,
    `ALTER TABLE ${p}_nueva RENAME TO ${p}`,
    ...(apaga ? ['PRAGMA defer_foreign_keys = off'] : []),
    ...(conGuarda ? GUARDA : []),
  ];
}

export interface Resultado {
  caso: Caso;
  /** El lote confirmó. */
  confirmo: boolean;
  /** El mensaje de error, si no confirmó. */
  error?: string;
  /** Filas que `foreign_key_check` reporta después, sobre la hija del caso. */
  huerfanas: number;
  /** Filas de la padre después (3 si no cambió o si la copia fue completa). */
  filasPadre: number;
  /** La padre tiene la columna nueva: la reconstrucción quedó aplicada. */
  aplicada: boolean;
}

/** Borra las tablas de un caso, la hija primero: cada caso deja la base como la encontró. */
export async function limpiar(db: BaseD1, caso: Caso): Promise<void> {
  await db.batch(
    [`DROP TABLE IF EXISTS h_${caso}`, `DROP TABLE IF EXISTS p_${caso}`].map((s) => db.prepare(s)),
  );
}

/**
 * Corre un caso. Ojo: la guarda revisa TODA la base, así que una huérfana que dejó otro caso (o
 * una vieja en producción) la hace fallar. Por eso cada caso se limpia al final, salvo que se pida
 * lo contrario para probar justamente eso.
 */
export async function correr(
  db: BaseD1,
  caso: Caso,
  { conservar = false }: { conservar?: boolean } = {},
): Promise<Resultado> {
  await preparar(db, caso);
  let confirmo = true;
  let error: string | undefined;
  try {
    await db.batch(reconstruccion(caso).map((s) => db.prepare(s)));
  } catch (e) {
    confirmo = false;
    error = e instanceof Error ? e.message : String(e);
  }
  const huerfanas = await db
    .prepare(`SELECT COUNT(*) AS n FROM pragma_foreign_key_check WHERE "table" = 'h_${caso}'`)
    .first<{ n: number }>();
  const filas = await db.prepare(`SELECT COUNT(*) AS n FROM p_${caso}`).first<{ n: number }>();
  const columnas = await db
    .prepare(`SELECT COUNT(*) AS n FROM pragma_table_info('p_${caso}') WHERE name = 'producto'`)
    .first<{ n: number }>();
  if (!conservar) await limpiar(db, caso);
  return {
    caso,
    confirmo,
    ...(error === undefined ? {} : { error }),
    huerfanas: huerfanas?.n ?? -1,
    filasPadre: filas?.n ?? -1,
    aplicada: (columnas?.n ?? 0) > 0,
  };
}
