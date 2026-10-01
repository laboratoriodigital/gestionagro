/**
 * Lo único que el CORE usa de una base D1 de Workers. Interfaces propias en vez de
 * `@cloudflare/workers-types`, que choca con los tipos del DOM del resto del monorepo.
 * En las pruebas, la base es un D1 local de verdad (`getPlatformProxy` de wrangler).
 */

export interface ResultadoD1<T = Record<string, unknown>> {
  results: T[];
  meta: { changes?: number; rows_written?: number };
}

export interface SentenciaD1 {
  bind(...valores: unknown[]): SentenciaD1;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<ResultadoD1<T>>;
  run(): Promise<ResultadoD1>;
}

export interface BaseD1 {
  prepare(sql: string): SentenciaD1;
  /** Todas las sentencias en una transacción: o quedan todas o ninguna. */
  batch(sentencias: SentenciaD1[]): Promise<ResultadoD1[]>;
}
