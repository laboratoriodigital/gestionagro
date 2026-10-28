/**
 * El tablero de Inicio (HU-T14.2, TIENDA-3.0 §12.2): cómo voy hoy y este mes frente al mes
 * anterior a la misma altura, qué tengo pendiente y el margen de la contraentrega.
 *
 * - Las ventas salen de los pedidos, nunca de los eventos (CA2): un pedido vendido es uno que está
 *   confirmado, pagado, despachado o entregado; cancelado o devuelto no es venta.
 * - Los periodos son del calendario de Colombia y se restan con el calendario, no con días (CA3,
 *   patrón 8): el 31 de marzo se compara con el 29 de febrero entero, y lo dice (`anteriorCompleto`).
 *   Nada aquí lee la hora ni el huso del servidor: todo sale de `ahoraMs`.
 * - La comisión estimada de los cobros en línea llega con el cobro (M3).
 */
import { diasHabilesEntre, fechaEnBogota } from '@ed1/calendario';
import { netoDelRecaudo } from './bandeja.ts';
import type { Quien } from './catalogo.ts';
import { type CuadreDelTablero, ultimoCuadre } from './cuadre.ts';
import { listarSolicitudes } from './panel-solicitudes.ts';

/** Los estados que son venta: los que descuentan el inventario y no se deshicieron. */
export const ESTADOS_DE_VENTA = ['confirmado', 'pagado', 'despachado', 'entregado'] as const;
const DE_VENTA = ESTADOS_DE_VENTA.map((e) => `'${e}'`).join(', ');

/** La liquidación tarda de 24 a 72 horas hábiles (TIENDA §8.7): más de 3 días hábiles, atrasada. */
export const DIAS_HABILES_DE_LIQUIDACION = 3;

/** Recaudado hace más de 3 días hábiles de Colombia y sin liquidar: festivos y fines de semana no cuentan. */
export const liquidacionAtrasada = (recaudadoMs: number, ahoraMs: number) =>
  diasHabilesEntre(fechaEnBogota(recaudadoMs), fechaEnBogota(ahoraMs)) >
  DIAS_HABILES_DE_LIQUIDACION;

export interface Periodo {
  /** Instantes ISO, `[desde, hasta)`. */
  desde: string;
  hasta: string;
}

export interface Periodos {
  hoy: Periodo;
  mes: Periodo;
  anterior: Periodo;
  /** El día del mes anterior con el que se compara hoy (`AAAA-MM-DD`). */
  altura: string;
  /** Hoy no existe en el mes anterior (31 contra febrero): se compara con el mes entero. */
  anteriorCompleto: boolean;
}

const dosCifras = (n: number) => String(n).padStart(2, '0');
/** El primer instante del día `AAAA-MM-DD` en Colombia, que no cambia de hora (UTC−5). */
const inicioDelDia = (fecha: string) => Date.parse(`${fecha}T00:00:00-05:00`);
const iso = (ms: number) => new Date(ms).toISOString();
/** Los días del mes `mes` (1–12) de `anio`, con el calendario: el día 0 del mes siguiente. */
const diasDelMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/** Los tres periodos del tablero desde el instante de ahora. */
export function periodos(ahoraMs: number): Periodos {
  const hoy = fechaEnBogota(ahoraMs);
  const [anio, mes, dia] = hoy.split('-').map(Number) as [number, number, number];
  const [anioAnt, mesAnt] = mes === 1 ? [anio - 1, 12] : [anio, mes - 1];
  const inicioDeHoy = inicioDelDia(hoy);
  const inicioDelMes = inicioDelDia(`${anio}-${dosCifras(mes)}-01`);
  const hasta = iso(ahoraMs + 1);
  const ultimo = diasDelMes(anioAnt, mesAnt);
  const anteriorCompleto = dia > ultimo;
  const altura = `${anioAnt}-${dosCifras(mesAnt)}-${dosCifras(Math.min(dia, ultimo))}`;
  return {
    hoy: { desde: iso(inicioDeHoy), hasta },
    mes: { desde: iso(inicioDelMes), hasta },
    anterior: {
      desde: iso(inicioDelDia(`${anioAnt}-${dosCifras(mesAnt)}-01`)),
      // A la misma altura: el mismo día y la misma hora; si ese día no existe, el mes entero.
      hasta: anteriorCompleto
        ? iso(inicioDelMes)
        : iso(inicioDelDia(altura) + (ahoraMs - inicioDeHoy) + 1),
    },
    altura,
    anteriorCompleto,
  };
}

export interface Cifras {
  pedidos: number;
  vendidos: number;
  ventasCop: number;
  /** Lo vendido entre los pedidos vendidos; `null` sin ventas. */
  ticketCop: number | null;
  /** Vendidos de cada pedido que llegó, de 0 a 1; `null` sin pedidos. */
  tasaDeCierre: number | null;
}

export interface Tablero {
  periodos: Periodos;
  hoy: Cifras;
  mes: Cifras;
  anterior: Cifras;
  pendientes: {
    porConfirmar: number;
    porDespachar: number;
    recaudosAtrasados: number;
    solicitudesPorVencer: number;
    solicitudesVencidas: number;
    pagosSinExistencias: number;
    cobrosARevisar: number;
    agotados: number;
    /**
     * HU-P2.2: las que quedan en su mínimo o por debajo, sin estar agotadas. El mínimo es el de la
     * combinación (`umbral_bajo`) o, si no tiene, el de «Ajustes › Avisos» (`stockBajo`).
     */
    porAgotarse: number;
  };
  /**
   * HU-T14.6: la última semana cuadrada, la base frente a la medición; `null` si no hay. Las
   * ventas de arriba nunca salen de aquí (CA2).
   */
  cuadre: CuadreDelTablero | null;
  /** La contraentrega despachada este mes y ya cerrada (recaudada, devuelta o perdida). */
  contraentrega: {
    cerrados: number;
    devueltos: number;
    cobradoCop: number;
    costosCop: number;
    netoCop: number;
    /** Cerrados sin el flete de ida o, recaudados, sin la comisión: el margen es a lo sumo ese. */
    sinCostos: number;
    enCamino: number;
  };
}

export async function cifras(q: Quien, p: Periodo): Promise<Cifras> {
  const f = await q.db
    .prepare(
      `SELECT count(*) AS pedidos,
              coalesce(sum(estado IN (${DE_VENTA})), 0) AS vendidos,
              coalesce(sum(CASE WHEN estado IN (${DE_VENTA}) THEN total_cop ELSE 0 END), 0) AS ventas
         FROM pedido WHERE org_id = ? AND creado >= ? AND creado < ?`,
    )
    .bind(q.org, p.desde, p.hasta)
    .first<{ pedidos: number; vendidos: number; ventas: number }>();
  const pedidos = f?.pedidos ?? 0;
  const vendidos = f?.vendidos ?? 0;
  const ventasCop = f?.ventas ?? 0;
  return {
    pedidos,
    vendidos,
    ventasCop,
    ticketCop: vendidos ? Math.round(ventasCop / vendidos) : null,
    tasaDeCierre: pedidos ? vendidos / pedidos : null,
  };
}

/**
 * HU-P2.2: las que quedan en el mínimo de «Ajustes › Avisos» o por debajo, sin estar agotadas. Sin
 * mínimo no se cuenta nada; con él, el índice `variante_por_quedan` lee solo esas.
 */
async function porAgotarseEn(q: Quien): Promise<number> {
  const a = await q.db
    .prepare(
      "SELECT json_extract(datos, '$.stockBajo') AS minimo FROM ajuste WHERE org_id = ? AND seccion = 'avisos'",
    )
    .bind(q.org)
    .first<{ minimo: number | null }>();
  const minimo = Number(a?.minimo ?? 0);
  if (!Number.isInteger(minimo) || minimo < 1) return 0;
  return cuenta(
    q,
    `SELECT count(*) AS n FROM variante v INDEXED BY variante_por_quedan
         JOIN producto p ON p.org_id = ? AND p.id = v.producto_id
        WHERE v.org_id = ? AND v.activa = 1 AND v.stock IS NOT NULL AND p.borrado IS NULL
          AND v.stock - v.reservado BETWEEN 1 AND ?`,
    q.org,
    minimo,
  );
}

const cuenta = async (q: Quien, sql: string, ...mas: unknown[]) =>
  (
    await q.db
      .prepare(sql)
      .bind(q.org, ...mas)
      .first<{ n: number }>()
  )?.n ?? 0;

export async function tablero(q: Quien, ahoraMs: number): Promise<Tablero> {
  const p = periodos(ahoraMs);
  const [
    deHoy,
    delMes,
    delAnterior,
    porEstado,
    sinLiquidar,
    cobros,
    agotados,
    porAgotarse,
    solicitudes,
    cuadre,
    ce,
  ] = await Promise.all([
    cifras(q, p.hoy),
    cifras(q, p.mes),
    cifras(q, p.anterior),
    q.db
      .prepare(
        `SELECT estado, count(*) AS n FROM pedido
            WHERE org_id = ? AND estado IN ('pendiente', 'confirmado', 'pagado') GROUP BY estado`,
      )
      .bind(q.org)
      .all<{ estado: string; n: number }>(),
    q.db
      .prepare(
        `SELECT actualizado FROM contraentrega
            WHERE org_id = ? AND estado = 'recaudado' AND liquidado IS NULL LIMIT 1000`,
      )
      .bind(q.org)
      .all<{ actualizado: string }>(),
    cuenta(q, `SELECT count(*) AS n FROM cobro WHERE org_id = ? AND estado = 'revisar'`),
    cuenta(
      q,
      `SELECT count(*) AS n FROM variante v INDEXED BY variante_agotada
           JOIN producto p ON p.org_id = ? AND p.id = v.producto_id
          WHERE v.org_id = ? AND v.activa = 1 AND p.borrado IS NULL
            AND v.stock IS NOT NULL AND v.stock <= v.reservado`,
      q.org,
    ),
    porAgotarseEn(q),
    listarSolicitudes(q, ahoraMs),
    ultimoCuadre(q.db, q.org),
    q.db
      .prepare(
        `SELECT estado, monto_cop, comision_cop, flete_ida_cop, flete_vuelta_cop FROM contraentrega
            WHERE org_id = ? AND creado >= ? AND creado < ?`,
      )
      .bind(q.org, p.mes.desde, p.mes.hasta)
      .all<{
        estado: string;
        monto_cop: number;
        comision_cop: number | null;
        flete_ida_cop: number | null;
        flete_vuelta_cop: number | null;
      }>(),
  ]);
  const enEstado = (e: string) => porEstado.results.find((f) => f.estado === e)?.n ?? 0;
  const abiertas = solicitudes.solicitudes.filter((s) => s.alerta !== null);
  const cerrados = ce.results.filter((c) => c.estado !== 'por_recaudar');
  return {
    periodos: p,
    hoy: deHoy,
    mes: delMes,
    anterior: delAnterior,
    pendientes: {
      porConfirmar: enEstado('pendiente'),
      porDespachar: enEstado('confirmado') + enEstado('pagado'),
      recaudosAtrasados: sinLiquidar.results.filter((r) =>
        liquidacionAtrasada(Date.parse(r.actualizado), ahoraMs),
      ).length,
      solicitudesPorVencer: abiertas.filter((s) => s.alerta !== 'vencida').length,
      solicitudesVencidas: abiertas.filter((s) => s.alerta === 'vencida').length,
      pagosSinExistencias: solicitudes.reembolsos.length,
      cobrosARevisar: cobros,
      agotados,
      porAgotarse,
    },
    cuadre,
    contraentrega: {
      cerrados: cerrados.length,
      devueltos: cerrados.filter((c) => c.estado === 'devuelto' || c.estado === 'perdido').length,
      cobradoCop: cerrados
        .filter((c) => c.estado === 'recaudado')
        .reduce((s, c) => s + c.monto_cop, 0),
      costosCop: cerrados.reduce(
        (s, c) =>
          s +
          (c.estado === 'recaudado' ? (c.comision_cop ?? 0) : 0) +
          (c.flete_ida_cop ?? 0) +
          (c.flete_vuelta_cop ?? 0),
        0,
      ),
      netoCop: cerrados.reduce(
        (s, c) =>
          s +
          netoDelRecaudo({
            estado: c.estado,
            montoCop: c.monto_cop,
            comisionCop: c.comision_cop,
            fleteIdaCop: c.flete_ida_cop,
            fleteVueltaCop: c.flete_vuelta_cop,
          }),
        0,
      ),
      sinCostos: cerrados.filter(
        (c) => c.flete_ida_cop === null || (c.estado === 'recaudado' && c.comision_cop === null),
      ).length,
      enCamino: ce.results.length - cerrados.length,
    },
  };
}
