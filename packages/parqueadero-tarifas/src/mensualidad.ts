/**
 * Los periodos y el prorrateo de una mensualidad (HU-Q8.4 CA1). Puros, con fechas de Bogotá
 * (`2026-10-09`) y sin reloj: la caja y la celda calculan igual.
 *
 * - **Un mes** va del día `desde` al día anterior del mes siguiente (`2026-10-07` → `2026-11-06`);
 *   si ese día no existe, al último del mes siguiente (`2026-01-31` → `2026-02-28`).
 * - **Una quincena** son 15 días, los dos extremos incluidos.
 * - **El prorrateo** de un periodo empezado cobra los días que cubre sobre los del periodo entero,
 *   redondeado hacia abajo a la centena: como el redondeo de la tarifa, nunca cobra de más.
 */
import type { PlanDeAbono } from '@ed1/parqueadero-schema';

const DIA_MS = 86_400_000;
const ms = (f: string) => Date.parse(`${f}T00:00:00Z`);
const fecha = (t: number) => new Date(t).toISOString().slice(0, 10);

/** El día siguiente: `2026-10-31` → `2026-11-01`. */
export const diaSiguiente = (f: string): string => fecha(ms(f) + DIA_MS);

/** Los días de `desde` a `hasta`, los dos incluidos. */
export const diasEntre = (desde: string, hasta: string): number =>
  Math.round((ms(hasta) - ms(desde)) / DIA_MS) + 1;

/** El `hasta` de un mes desde `desde`. */
export function unMesDesde(desde: string): string {
  const [a = 0, m = 1, d = 1] = desde.split('-').map(Number);
  const diasDelSiguiente = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  const fin = d > diasDelSiguiente ? Date.UTC(a, m, diasDelSiguiente) : Date.UTC(a, m, d) - DIA_MS;
  return fecha(fin);
}

/** El último día que cubre un pago del plan que empieza en `desde`. */
export const finDelPeriodo = (plan: PlanDeAbono, desde: string): string =>
  plan === 'quincena' ? fecha(ms(desde) + 14 * DIA_MS) : unMesDesde(desde);

/** El último día del mes de `f`: `2026-10-20` → `2026-10-31`. */
export function finDeMes(f: string): string {
  const [a = 0, m = 1] = f.split('-').map(Number);
  return fecha(Date.UTC(a, m, 0));
}

/**
 * Lo que vale cubrir de `desde` a `hasta` con un plan de `valor`: entero si es el periodo completo
 * o más, y si no, la parte de sus días, hacia abajo a la centena.
 */
export function prorrateo(valor: number, plan: PlanDeAbono, desde: string, hasta: string): number {
  const completo = diasEntre(desde, finDelPeriodo(plan, desde));
  const dias = diasEntre(desde, hasta);
  if (dias >= completo) return valor;
  return Math.floor((valor * dias) / completo / 100) * 100;
}
