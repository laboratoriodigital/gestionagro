/**
 * HU-T17.4: restaurar una tienda desde su respaldo (`tienda-respaldo/2`, HU-T17.3), y el simulacro
 * que lo prueba antes de guardar datos de terceros (TIENDA-3.0 §15.4, punto 4).
 *
 * - **Une lo que falta, nunca reemplaza el presente (CA2).** Cada fila entra con `ON CONFLICT DO
 *   NOTHING`: si ya está (por su llave o por cualquier otra regla de unicidad), se queda como está.
 *   Un pedido nuevo después del respaldo, o un producto que se cambió, siguen como están.
 * - **Las columnas que llevan los triggers entran en cero.** `producto.combinaciones` y
 *   `variante.reservado` las suman los triggers al entrar cada combinación activa y cada apartado
 *   activo: copiadas del respaldo se contarían dos veces.
 * - **En orden** (`TABLAS_DEL_RESPALDO`): lo que otra fila nombra entra antes. Al final, los
 *   consecutivos de la tienda quedan por encima del mayor número de pedido y de radicado, para que
 *   el siguiente no choque con uno restaurado.
 * - **Por lotes** de `SENTENCIAS_POR_LOTE`, cada uno atómico. Una restauración que se corta se
 *   vuelve a correr: lo que ya entró no se repite.
 * - Las llaves de las credenciales no viajan en el respaldo: después de restaurar, el comercio
 *   pega otra vez las suyas de Bold (HU-T11.2). Los sobres se abren con la KEK de siempre, que
 *   tampoco viaja.
 *
 * Lo corre el operador: `scripts/tienda/restaurar.ts` arma el mismo SQL para `wrangler d1 execute`,
 * y el simulacro está en `docs/runbooks/tienda-restaurar.md`.
 */
import type { BaseD1 } from '@ed1/d1';
import {
  type Fila,
  type Filas,
  type Respaldo,
  TABLAS_DEL_RESPALDO,
  type TablaDelRespaldo,
  type Valor,
} from './respaldos.ts';

export const SENTENCIAS_POR_LOTE = 40;

/** Las columnas que llevan los triggers: entran en cero y los triggers las cuentan. */
const DERIVADAS: Partial<Record<TablaDelRespaldo, readonly string[]>> = {
  producto: ['combinaciones'],
  variante: ['reservado'],
};

export interface SentenciaDeRestauracion {
  tabla: TablaDelRespaldo | null;
  sql: string;
  params: (string | number | null | Uint8Array)[];
}

const IDENTIFICADOR = /^[a-z_][a-z0-9_]*$/;

const deBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const valorParaLaBase = (v: Valor): string | number | null | Uint8Array =>
  v !== null && typeof v === 'object' ? deBase64(v.b64) : v;

export class RespaldoQueNoSirve extends Error {}

/** Revisa que el respaldo sea de esta versión y de una sola tienda. Lanza si no (P1). */
export function revisarRespaldo(r: unknown): Respaldo {
  const x = r as Partial<Respaldo> | null;
  if (x?.formato !== 'tienda-respaldo/2' || typeof x.org !== 'string' || !x.filas) {
    throw new RespaldoQueNoSirve(
      'no es un respaldo tienda-respaldo/2: los de la versión 1 no se pueden restaurar sin perder los pedidos (bitácora tienda3 32)',
    );
  }
  for (const [tabla] of TABLAS_DEL_RESPALDO) {
    const filas = x.filas[tabla];
    if (!Array.isArray(filas)) throw new RespaldoQueNoSirve(`le falta la tabla ${tabla}`);
    for (const f of filas) {
      if (f['org_id'] !== x.org) {
        throw new RespaldoQueNoSirve(`la tabla ${tabla} trae una fila de otra tienda`);
      }
      for (const columna of Object.keys(f)) {
        if (!IDENTIFICADOR.test(columna)) {
          throw new RespaldoQueNoSirve(`la tabla ${tabla} trae una columna que no es: ${columna}`);
        }
      }
    }
  }
  return x as Respaldo;
}

/** Las sentencias de la restauración, en orden: cada fila con `ON CONFLICT DO NOTHING`. */
export function sentenciasDeRestauracion(r: Respaldo): SentenciaDeRestauracion[] {
  const s: SentenciaDeRestauracion[] = [];
  for (const [tabla] of TABLAS_DEL_RESPALDO) {
    const enCero = new Set(DERIVADAS[tabla] ?? []);
    for (const f of r.filas[tabla] as Fila[]) {
      const columnas = Object.keys(f);
      s.push({
        tabla,
        sql: `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${columnas.map(() => '?').join(', ')}) ON CONFLICT DO NOTHING`,
        params: columnas.map((c) => (enCero.has(c) ? 0 : valorParaLaBase(f[c] ?? null))),
      });
    }
  }
  // Los consecutivos, por encima de lo restaurado.
  s.push({
    tabla: null,
    sql: `UPDATE tienda SET
       ultimo_numero = max(ultimo_numero, COALESCE((SELECT max(numero) FROM pedido WHERE org_id = ?), 1000)),
       ultima_solicitud = max(ultima_solicitud, COALESCE((SELECT max(radicado) FROM solicitud WHERE org_id = ?), 0))
     WHERE org_id = ?`,
    params: [r.org, r.org, r.org],
  });
  return s;
}

export interface Restauracion {
  /** Por tabla: cuántas filas trae el respaldo y cuántas entraron porque faltaban. */
  tablas: Record<TablaDelRespaldo, { enElRespaldo: number; entraron: number }>;
}

const contar = async (db: BaseD1, tabla: TablaDelRespaldo, org: string) =>
  (
    await db
      .prepare(
        `SELECT count(*) AS n FROM ${tabla} WHERE org_id = ?${tabla === 'llave' ? " AND proposito <> 'credenciales'" : ''}`,
      )
      .bind(org)
      .first<{ n: number }>()
  )?.n ?? 0;

/** Restaura en la base, por lotes, y dice por tabla cuántas filas entraron. */
export async function restaurar(db: BaseD1, respaldo: unknown): Promise<Restauracion> {
  const r = revisarRespaldo(respaldo);
  const antes = new Map<TablaDelRespaldo, number>();
  for (const [tabla] of TABLAS_DEL_RESPALDO) antes.set(tabla, await contar(db, tabla, r.org));
  const sentencias = sentenciasDeRestauracion(r);
  for (let i = 0; i < sentencias.length; i += SENTENCIAS_POR_LOTE) {
    await db.batch(
      sentencias.slice(i, i + SENTENCIAS_POR_LOTE).map((x) => db.prepare(x.sql).bind(...x.params)),
    );
  }
  const tablas = {} as Restauracion['tablas'];
  for (const [tabla] of TABLAS_DEL_RESPALDO) {
    tablas[tabla] = {
      enElRespaldo: (r.filas as Filas)[tabla].length,
      entraron: (await contar(db, tabla, r.org)) - (antes.get(tabla) ?? 0),
    };
  }
  return { tablas };
}

/** Un valor como literal de SQL, para el archivo de `wrangler d1 execute`. */
function literal(v: string | number | null | Uint8Array): string {
  if (v === null) return 'NULL';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new RespaldoQueNoSirve(`un número que no es: ${v}`);
    return String(v);
  }
  if (v instanceof Uint8Array) {
    return `X'${[...v].map((b) => b.toString(16).padStart(2, '0')).join('')}'`;
  }
  return `'${v.replaceAll("'", "''")}'`;
}

/** El SQL de la restauración, con los valores en su sitio: para `wrangler d1 execute --file`. */
export function sqlDeRestauracion(respaldo: unknown): string {
  const r = revisarRespaldo(respaldo);
  return `${sentenciasDeRestauracion(r)
    .map((x) => {
      let i = 0;
      return `${x.sql.replace(/\?/g, () => literal(x.params[i++] ?? null))};`;
    })
    .join('\n')}\n`;
}
