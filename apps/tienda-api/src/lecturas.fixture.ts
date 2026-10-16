/**
 * Un shard que suma las filas que lee D1 (`meta.rows_read`). El plan gratuito da 5 millones al día
 * para toda la cuenta, y una sola consulta de la tienda llena llegó a leer 24 millones (bitácora
 * tienda3 26). Solo el D1 de workerd las cuenta: la base en proceso de `node:sqlite` no.
 */
import type { BaseD1, SentenciaD1 } from '@ed1/d1';

type ConMeta = { meta?: { rows_read?: number } };

export interface Lectura {
  filas: number;
  /** La consulta que más leyó, recortada, para que el mensaje de una prueba diga cuál fue. */
  peor: { filas: number; sql: string };
}

export function contandoFilas(db: BaseD1): { db: BaseD1; leer: () => Lectura } {
  let filas = 0;
  let peor = { filas: 0, sql: '' };
  const nota = (sql: string, r: unknown) => {
    const n = Number((r as ConMeta | undefined)?.meta?.rows_read ?? 0);
    filas += n;
    if (n > peor.filas) peor = { filas: n, sql: sql.replace(/\s+/g, ' ').slice(0, 200) };
  };
  const internas = new WeakMap<SentenciaD1, [SentenciaD1, string]>();
  const envolver = (s: SentenciaD1, sql: string): SentenciaD1 => {
    const e: SentenciaD1 = {
      bind: (...v: unknown[]) => envolver(s.bind(...v), sql),
      // `first` no trae `meta`: se lee con `all`, que sí la trae.
      first: async <T>() => {
        const r = await s.all<T>();
        nota(sql, r);
        return r.results[0] ?? null;
      },
      all: async <T>() => {
        const r = await s.all<T>();
        nota(sql, r);
        return r;
      },
      run: async () => {
        const r = await s.run();
        nota(sql, r);
        return r;
      },
    };
    internas.set(e, [s, sql]);
    return e;
  };
  return {
    db: {
      prepare: (sql) => envolver(db.prepare(sql), sql),
      batch: async (ss) => {
        const rs = await db.batch(ss.map((x) => internas.get(x)?.[0] ?? x));
        rs.forEach((r, i) => {
          const s = ss[i];
          nota(`[lote] ${(s && internas.get(s)?.[1]) ?? '?'}`, r);
        });
        return rs;
      },
    },
    leer: () => {
      const r = { filas, peor };
      filas = 0;
      peor = { filas: 0, sql: '' };
      return r;
    },
  };
}
