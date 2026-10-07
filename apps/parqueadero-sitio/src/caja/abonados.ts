/**
 * Los abonados por placa (HU-Q3.11): quién está cubierto por su mensualidad en un instante. Las
 * fechas `desde` y `hasta` son días de Bogotá y los dos cuentan: un abono hasta el 31 cubre hasta
 * las 23:59 del 31. En M0 la caja solo los reconoce; el cobro de la mensualidad es de M2.
 */
import type { Abonado } from '@ed1/parqueadero-schema';

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

/**
 * El `hasta` de un mes de abono: el día anterior al mismo día del mes siguiente (`2026-10-07` →
 * `2026-11-06`). Si ese día no existe, el último del mes siguiente (`2026-01-31` → `2026-02-28`).
 */
export function unMesDesde(desde: string): string {
  const [a = 0, m = 1, d = 1] = desde.split('-').map(Number);
  const diasDelSiguiente = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  const fin = d > diasDelSiguiente ? Date.UTC(a, m, diasDelSiguiente) : Date.UTC(a, m, d) - DIA_MS;
  return new Date(fin).toISOString().slice(0, 10);
}

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
