/**
 * Un shard que cuenta los parámetros de cada consulta. D1 admite hasta 100 por consulta y la base
 * local no lo imita (P17): una lectura con `IN (…)` de 2.000 ids pasa aquí y falla en Cloudflare.
 */
import type { BaseD1, SentenciaD1 } from '@ed1/d1';

export const TOPE_DE_PARAMETROS_D1 = 100;

export function contandoParametros(db: BaseD1): {
  db: BaseD1;
  mas: () => number;
  reiniciar: () => void;
} {
  let mas = 0;
  const internas = new WeakMap<SentenciaD1, SentenciaD1>();
  const envolver = (s: SentenciaD1): SentenciaD1 => {
    const e: SentenciaD1 = {
      bind: (...v: unknown[]) => {
        mas = Math.max(mas, v.length);
        return envolver(s.bind(...v));
      },
      first: () => s.first(),
      all: () => s.all(),
      run: () => s.run(),
    };
    internas.set(e, s);
    return e;
  };
  return {
    db: {
      prepare: (sql) => envolver(db.prepare(sql)),
      batch: (ss) => db.batch(ss.map((x) => internas.get(x) ?? x)),
    },
    mas: () => mas,
    reiniciar: () => {
      mas = 0;
    },
  };
}
