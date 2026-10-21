/**
 * Los eventos que cuadran con los pedidos (HU-T14.6, TIENDA §11.6; estudio §8.1 [C3]).
 *
 * Cada semana, en el turno de cada tienda, se comparan los pedidos y pagos de la base con lo que
 * contó la medición propia de la vitrina (HU-T14.1, Analytics Engine) en los mismos 7 días de
 * Colombia, los anteriores a hoy. La diferencia se ve en los dos sentidos:
 *
 * - más pedidos que eventos: compradores sin JavaScript, con bloqueadores, o que cerraron antes de
 *   que saliera el lote;
 * - más eventos que pedidos: intentos que no terminaron (un pago en línea que se abrió y no se
 *   registró, un pedido que la API rechazó).
 *
 * Las ventas del tablero salen siempre de los pedidos, nunca de aquí (CA2).
 */
import type { BaseD1 } from '@ed1/d1';
import { EVENTOS_DE_LA_TIENDA } from '@ed1/tienda-horno';

const API = 'https://api.cloudflare.com/client/v4';
const DIA_MS = 24 * 60 * 60 * 1000;
const BOGOTA_MS = 5 * 60 * 60 * 1000;
const ORG = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Los canales de la vitrina: los pedidos que puede contar su medición. */
export const CANALES_DE_LA_VITRINA = ['whatsapp', 'en_linea'] as const;
/** Todos los estados del pedido, para leerlos por su índice (`pedido_por_estado`). */
const ESTADOS = [
  'pendiente',
  'por_pagar',
  'confirmado',
  'pagado',
  'despachado',
  'entregado',
  'cancelado',
  'devuelto',
];
const PAGOS_APROBADOS = ['aprobado', 'aprobado_sin_existencias'];

export interface Ventana {
  /** El primer día, `AAAA-MM-DD` de Colombia: la llave de la semana. */
  semana: string;
  /** Instantes ISO, `[desde, hasta)`. */
  desde: string;
  hasta: string;
}

/** Los 7 días de Colombia anteriores al día de `instante`. */
export function ventanaDeLaSemana(instante: number): Ventana {
  const hoy = Math.floor((instante - BOGOTA_MS) / DIA_MS) * DIA_MS + BOGOTA_MS;
  const desde = hoy - 7 * DIA_MS;
  return {
    semana: new Date(desde - BOGOTA_MS).toISOString().slice(0, 10),
    desde: new Date(desde).toISOString(),
    hasta: new Date(hoy).toISOString(),
  };
}

export interface Conteo {
  pedidos: number;
  pagos: number;
}

const columna = (evento: (typeof EVENTOS_DE_LA_TIENDA)[number]) =>
  `double${EVENTOS_DE_LA_TIENDA.indexOf(evento) + 1}`;
/** `2026-10-20T05:00:00.000Z` → `2026-10-20 05:00:00`, como lo lee Analytics Engine. */
const sql = (iso: string) => iso.slice(0, 19).replace('T', ' ');

/**
 * Lo que contó la medición de esas tiendas en la ventana: los pedidos que se empezaron
 * (`iniciar_pedido`) y los pagos confirmados (`pago_confirmado`), con el muestreo de Analytics Engine.
 */
export async function eventosDeLaSemana(
  m: { token: string; cuenta: string; dataset: string; fetch: typeof fetch },
  orgs: readonly string[],
  v: Ventana,
): Promise<Map<string, Conteo>> {
  const validas = orgs.filter((o) => ORG.test(o));
  if (validas.length === 0) return new Map();
  if (!/^[a-z0-9_]+$/.test(m.dataset)) throw new Error(`dataset inválido «${m.dataset}»`);
  const consulta = `SELECT index1 AS org, SUM(_sample_interval * ${columna('iniciar_pedido')}) AS pedidos, SUM(_sample_interval * ${columna('pago_confirmado')}) AS pagos FROM ${m.dataset} WHERE index1 IN (${validas.map((o) => `'${o}'`).join(', ')}) AND timestamp >= toDateTime('${sql(v.desde)}') AND timestamp < toDateTime('${sql(v.hasta)}') GROUP BY org`;
  const r = await m.fetch(`${API}/accounts/${m.cuenta}/analytics_engine/sql`, {
    method: 'POST',
    headers: { authorization: `Bearer ${m.token}` },
    body: consulta,
  });
  const cuerpo = (await r.json().catch(() => null)) as { data?: Record<string, unknown>[] } | null;
  if (r.status !== 200 || !Array.isArray(cuerpo?.data))
    throw new Error(`Analytics Engine respondió ${r.status}`);
  return new Map(
    cuerpo.data.map((f) => [
      String(f['org']),
      {
        pedidos: Math.round(Number(f['pedidos'] ?? 0)),
        pagos: Math.round(Number(f['pagos'] ?? 0)),
      },
    ]),
  );
}

/** Lo que dice la base de esa tienda en la ventana: sus pedidos de la vitrina y sus pagos aprobados. */
export async function deLaBase(db: BaseD1, org: string, v: Ventana): Promise<Conteo> {
  const lista = (xs: readonly string[]) => xs.map((x) => `'${x}'`).join(', ');
  const [pedidos, pagos] = await Promise.all([
    db
      .prepare(
        `SELECT count(*) AS n FROM pedido INDEXED BY pedido_por_estado
          WHERE org_id = ? AND estado IN (${lista(ESTADOS)}) AND creado >= ? AND creado < ?
            AND canal IN (${lista(CANALES_DE_LA_VITRINA)})`,
      )
      .bind(org, v.desde, v.hasta)
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT count(*) AS n FROM cobro WHERE org_id = ? AND estado IN (${lista(PAGOS_APROBADOS)})
            AND actualizado >= ? AND actualizado < ?`,
      )
      .bind(org, v.desde, v.hasta)
      .first<{ n: number }>(),
  ]);
  return { pedidos: pedidos?.n ?? 0, pagos: pagos?.n ?? 0 };
}

/** Guarda el cuadre de la semana; si ya estaba, lo reemplaza. */
export async function guardarCuadre(
  db: BaseD1,
  org: string,
  v: Ventana,
  base: Conteo,
  eventos: Conteo,
  instante: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO cuadre_de_eventos (org_id, semana, pedidos_base, pedidos_eventos, pagos_base, pagos_eventos, calculado)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (org_id, semana) DO UPDATE SET pedidos_base = excluded.pedidos_base,
         pedidos_eventos = excluded.pedidos_eventos, pagos_base = excluded.pagos_base,
         pagos_eventos = excluded.pagos_eventos, calculado = excluded.calculado`,
    )
    .bind(org, v.semana, base.pedidos, eventos.pedidos, base.pagos, eventos.pagos, instante)
    .run();
}

export interface CuadreDelTablero {
  semana: string;
  pedidos: { base: number; eventos: number };
  pagos: { base: number; eventos: number };
  calculado: string;
}

/** El último cuadre de la tienda, para el tablero; `null` si todavía no hay. */
export async function ultimoCuadre(db: BaseD1, org: string): Promise<CuadreDelTablero | null> {
  const f = await db
    .prepare(
      'SELECT semana, pedidos_base, pedidos_eventos, pagos_base, pagos_eventos, calculado FROM cuadre_de_eventos WHERE org_id = ? ORDER BY semana DESC LIMIT 1',
    )
    .bind(org)
    .first<{
      semana: string;
      pedidos_base: number;
      pedidos_eventos: number;
      pagos_base: number;
      pagos_eventos: number;
      calculado: string;
    }>();
  return f
    ? {
        semana: f.semana,
        pedidos: { base: f.pedidos_base, eventos: f.pedidos_eventos },
        pagos: { base: f.pagos_base, eventos: f.pagos_eventos },
        calculado: f.calculado,
      }
    : null;
}

export interface Medicion {
  token: string;
  cuenta: string;
  dataset: string;
  fetch: typeof fetch;
}

/**
 * Cuadra la semana de esas tiendas de un shard: una consulta a Analytics Engine y dos lecturas de
 * la base por tienda. Lo usan la tarea semanal y el flujo `cuadrar-tienda` (staging no tiene cron).
 */
export async function cuadrarTiendas(
  db: BaseD1,
  orgs: readonly string[],
  m: Medicion,
  instante: number,
): Promise<{ org: string; base: Conteo; eventos: Conteo }[]> {
  if (orgs.length === 0) return [];
  const v = ventanaDeLaSemana(instante);
  const eventos = await eventosDeLaSemana(m, orgs, v);
  const hechos: { org: string; base: Conteo; eventos: Conteo }[] = [];
  for (const org of orgs) {
    const base = await deLaBase(db, org, v);
    const medidos = eventos.get(org) ?? { pedidos: 0, pagos: 0 };
    await guardarCuadre(db, org, v, base, medidos, new Date(instante).toISOString());
    hechos.push({ org, base, eventos: medidos });
  }
  return hechos;
}
