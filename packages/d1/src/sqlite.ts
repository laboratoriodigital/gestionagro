/**
 * Una base D1 en proceso, sobre `node:sqlite` (HU-C11.7). Es el mismo motor que D1 (SQLite), sin
 * el viaje al proxy de workerd: el spike del 5 oct 2026 midió 12 a 14 ms por sentencia en el D1 de
 * `getPlatformProxy` y 5 ms por sentencia en lote, contra microsegundos aquí. Las pruebas de lógica
 * lo usan por defecto; las que prueban D1 mismo (la receta, la matriz de producto) piden workerd, y
 * el CI de `main` corre toda la batería en workerd (`D1_INSTRUMENTO=workerd`), así una diferencia
 * entre los dos aparece al fusionar y no en producción (P17).
 *
 * Lo que imita de D1, porque el código lo usa:
 * - claves foráneas siempre activas;
 * - `batch` atómico: todo o nada, y `meta.changes` de cada sentencia;
 * - `bind` con booleanos como 1/0, y `undefined` rechazado como lo rechaza D1;
 * - los errores con el prefijo `D1_ERROR: `, y el mensaje de SQLite después.
 *
 * Lo que NO imita (P17): los límites de D1 (consultas por invocación, filas escritas por día,
 * tamaño), `meta.rows_written` (D1 cuenta también los índices; aquí es igual a `changes`), la
 * latencia y las réplicas, y el mensaje exacto con que workerd reinicia una base que confirmó una
 * violación de clave foránea («Durable Object was reset…»): aquí sale el de SQLite.
 */
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { BaseD1, ResultadoD1, SentenciaD1 } from './index.ts';

type Valor = null | number | bigint | string | Uint8Array;

function convertir(valor: unknown): Valor {
  if (valor === undefined) {
    throw new Error("D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'");
  }
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  if (valor === null || typeof valor === 'number' || typeof valor === 'string') return valor;
  if (typeof valor === 'bigint' || valor instanceof Uint8Array) return valor;
  if (valor instanceof ArrayBuffer) return new Uint8Array(valor);
  throw new Error(
    `D1_TYPE_ERROR: Type '${typeof valor}' not supported for value '${String(valor)}'`,
  );
}

const comoD1 = (e: unknown): Error =>
  new Error(`D1_ERROR: ${e instanceof Error ? e.message : String(e)}`);

/** Lee filas: un SELECT, un PRAGMA, un WITH, o una escritura con RETURNING. */
const devuelveFilas = (sql: string) =>
  /^\s*(SELECT|WITH|PRAGMA|VALUES)\b/i.test(sql) || /\bRETURNING\b/i.test(sql);

/** Las filas de node:sqlite no tienen prototipo; D1 entrega objetos comunes. */
const plano = (fila: object | undefined) => (fila ? { ...fila } : undefined);

class Sentencia implements SentenciaD1 {
  private readonly base: DatabaseSync;
  readonly sql: string;
  private readonly valores: unknown[];

  constructor(base: DatabaseSync, sql: string, valores: unknown[] = []) {
    this.base = base;
    this.sql = sql;
    this.valores = valores;
  }

  bind(...valores: unknown[]): SentenciaD1 {
    return new Sentencia(this.base, this.sql, valores);
  }

  private preparada(): { s: StatementSync; v: Valor[] } {
    try {
      return { s: this.base.prepare(this.sql), v: this.valores.map(convertir) };
    } catch (e) {
      throw e instanceof Error && e.message.startsWith('D1_TYPE_ERROR') ? e : comoD1(e);
    }
  }

  /** Corre la sentencia y la devuelve como la devolvería D1 (también dentro de un lote). */
  ejecutar(): ResultadoD1 {
    const { s, v } = this.preparada();
    try {
      if (devuelveFilas(this.sql)) {
        const results = s.all(...v).map((f) => plano(f) as Record<string, unknown>);
        const changes = /^\s*(SELECT|WITH|PRAGMA|VALUES)\b/i.test(this.sql) ? 0 : results.length;
        return { results, meta: { changes, rows_written: changes } };
      }
      const r = s.run(...v);
      const changes = Number(r.changes);
      return { results: [], meta: { changes, rows_written: changes } };
    } catch (e) {
      throw comoD1(e);
    }
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const { s, v } = this.preparada();
    try {
      return (plano(s.get(...v) as object | undefined) as T | undefined) ?? null;
    } catch (e) {
      throw comoD1(e);
    }
  }

  async all<T = Record<string, unknown>>(): Promise<ResultadoD1<T>> {
    return this.ejecutar() as ResultadoD1<T>;
  }

  async run(): Promise<ResultadoD1> {
    return this.ejecutar();
  }
}

/** Una base vacía en memoria, con las claves foráneas encendidas como en D1. */
export function baseEnMemoria(): { db: BaseD1; cerrar: () => Promise<void> } {
  const base = new DatabaseSync(':memory:');
  base.exec('PRAGMA foreign_keys = ON');
  const db: BaseD1 = {
    prepare: (sql) => new Sentencia(base, sql),
    async batch(sentencias) {
      base.exec('BEGIN');
      try {
        const resultados = sentencias.map((s) => {
          if (!(s instanceof Sentencia)) throw new Error('D1_ERROR: sentencia de otra base');
          return s.ejecutar();
        });
        base.exec('COMMIT');
        return resultados;
      } catch (e) {
        // Un COMMIT que falla (una clave foránea diferida) deja la transacción abierta.
        if (base.isTransaction) base.exec('ROLLBACK');
        throw e instanceof Error && e.message.startsWith('D1_') ? e : comoD1(e);
      }
    },
  };
  return { db, cerrar: async () => base.close() };
}
