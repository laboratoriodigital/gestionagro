/**
 * Los abonados por placa (HU-Q3.11): quién está cubierto por su mensualidad en un instante. Las
 * fechas `desde` y `hasta` son días de Bogotá y los dos cuentan: un abono hasta el 31 cubre hasta
 * las 23:59 del 31. Desde HU-Q8.4 la caja cobra cada periodo y lo suma a la vigencia (`conPagos`).
 */
import type { Abonado, DiasDeMensualidad, PlanDeAbono } from '@ed1/parqueadero-schema';
import { diaSiguiente, finDelPeriodo, finDeMes, prorrateo } from '@ed1/parqueadero-tarifas';

const DIA_MS = 24 * 60 * 60 * 1000;
const BOGOTA_MS = -5 * 60 * 60 * 1000;

/** Las 00:00 de Bogotá de un día `2026-10-31`, en milisegundos Unix. */
export function inicioDelDia(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number);
  return Date.UTC(a ?? 0, (m ?? 1) - 1, d ?? 1) - BOGOTA_MS;
}

/** Hasta cuándo cubre un abono: el final de su día `hasta`. */
export const venceEl = (a: Pick<Abonado, 'hasta'>): number => inicioDelDia(a.hasta) + DIA_MS;

/** `31/10/2026`, como lo lee el cajero. */
export const fechaDelAbono = (fecha: string): string => fecha.split('-').reverse().join('/');

/** El `hasta` de un mes de abono: vive con el prorrateo en `@ed1/parqueadero-tarifas` (HU-Q8.4). */
export { unMesDesde } from '@ed1/parqueadero-tarifas';

export interface AbonoDeLaPlaca {
  /** El abono activo que cubre el instante; nulo si no hay. */
  readonly vigente: Abonado | null;
  /** Sin vigente, el último que venció, para decirlo; nulo si nunca tuvo. */
  readonly vencido: Abonado | null;
}

/** El abono de una placa en un instante. Uno desactivado no cuenta, ni vigente ni vencido. */
export function abonoDeLaPlaca(
  abonados: readonly Abonado[],
  placa: string,
  instante: number,
): AbonoDeLaPlaca {
  const suyos = abonados.filter((a) => a.activo && a.placa === placa);
  const vigente =
    suyos
      .filter((a) => inicioDelDia(a.desde) <= instante && instante < venceEl(a))
      .sort((x, y) => venceEl(y) - venceEl(x))[0] ?? null;
  if (vigente) return { vigente, vencido: null };
  const vencido =
    suyos.filter((a) => venceEl(a) <= instante).sort((x, y) => venceEl(y) - venceEl(x))[0] ?? null;
  return { vigente: null, vencido };
}

/** Lo que un pago de mensualidad cubre (`pago_abonado`, HU-Q8.4). */
export interface PagoDelAbono {
  readonly abonado_id: string;
  readonly desde: string;
  readonly hasta: string;
}

/**
 * La vigencia de cada abonado con sus pagos (HU-Q8.4): un pago que empieza a más tardar el día
 * siguiente al último cubierto alarga el periodo; uno que empieza después de un hueco abre uno
 * nuevo, y queda el más reciente. Los pagos anulados no llegan aquí. El catálogo no se toca: el
 * cajero cobra sin el PIN que pide cambiar un abonado.
 */
export function conPagos(abonados: readonly Abonado[], pagos: readonly PagoDelAbono[]): Abonado[] {
  return abonados.map((a) => {
    const suyos = pagos
      .filter((p) => p.abonado_id === a.id)
      .sort((x, y) => x.desde.localeCompare(y.desde) || x.hasta.localeCompare(y.hasta));
    let { desde, hasta } = a;
    for (const p of suyos) {
      if (p.desde <= diaSiguiente(hasta)) {
        if (p.hasta > hasta) hasta = p.hasta;
      } else {
        desde = p.desde;
        hasta = p.hasta;
      }
    }
    return desde === a.desde && hasta === a.hasta ? a : { ...a, desde, hasta };
  });
}

/** El plan de un abonado: los de antes de HU-Q8.4 son de un mes. */
export const planDe = (a: Pick<Abonado, 'plan'>): PlanDeAbono => a.plan ?? 'mes';

/**
 * El periodo que se cobra hoy (CA1): el que sigue al vigente, o desde hoy si venció. `primero`
 * cobra el periodo con que se agregó el abonado, con su prorrateo si es más corto que el plan;
 * `hastaFinDeMes` corta el siguiente el último día de su mes, también con prorrateo.
 */
export function periodoPorCobrar(
  a: Abonado,
  hoy: string,
  o: {
    readonly primero?: boolean;
    readonly hastaFinDeMes?: boolean;
    /** Los días que cuenta el prorrateo: los de la sede (HU-Q13.3). */
    readonly cuenta?: DiasDeMensualidad;
  } = {},
): { readonly desde: string; readonly hasta: string; readonly valor: number } {
  const plan = planDe(a);
  const cuenta = o.cuenta ?? 'calendario';
  if (o.primero) {
    return {
      desde: a.desde,
      hasta: a.hasta,
      valor: prorrateo(a.valor, plan, a.desde, a.hasta, cuenta),
    };
  }
  const desde = a.hasta >= hoy ? diaSiguiente(a.hasta) : hoy;
  const hasta = o.hastaFinDeMes ? finDeMes(desde) : finDelPeriodo(plan, desde);
  return { desde, hasta, valor: prorrateo(a.valor, plan, desde, hasta, cuenta) };
}

/**
 * Las mensualidades activas que vencen de hoy a `dias` días, la primera arriba (CA2). El cajero
 * las recuerda en persona: la caja no guarda el WhatsApp del abonado (dueño, 9 oct 2026).
 */
export function vencenPronto(abonados: readonly Abonado[], hoy: string, dias = 5): Abonado[] {
  const limite = new Date(Date.parse(`${hoy}T00:00:00Z`) + dias * DIA_MS)
    .toISOString()
    .slice(0, 10);
  return abonados
    .filter((a) => a.activo && a.hasta >= hoy && a.hasta <= limite)
    .sort((x, y) => x.hasta.localeCompare(y.hasta) || x.placa.localeCompare(y.placa));
}
