/**
 * Los periodos y el prorrateo de una mensualidad (HU-Q8.4 CA1). Puros, con fechas de Bogotá
 * (`2026-10-09`) y sin reloj: la caja y la celda calculan igual.
 *
 * - **Un mes** va del día `desde` al día anterior del mes siguiente (`2026-10-07` → `2026-11-06`);
 *   si ese día no existe, al último del mes siguiente (`2026-01-31` → `2026-02-28`).
 * - **Una quincena** son 15 días, los dos extremos incluidos.
 * - **El prorrateo** de un periodo empezado cobra los días que cubre sobre los del periodo entero,
 *   redondeado hacia abajo a la centena: como el redondeo de la tarifa, nunca cobra de más. Con
 *   `habiles` (HU-Q13.3) cuenta solo los lunes a viernes que no son festivo en Colombia, arriba y
 *   abajo; sin hábiles en el periodo entero, cuenta los días calendario.
 */
import { esHabil, RANGO } from '@ed1/calendario';
import type { DiasDeMensualidad, PlanDeAbono } from '@ed1/parqueadero-schema';

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
/** Los lunes a viernes que no son festivo de `desde` a `hasta`, los dos incluidos (HU-Q13.3). */
export function habilesEntre(desde: string, hasta: string): number {
  let n = 0;
  for (let t = ms(desde); t <= ms(hasta); t += DIA_MS) {
    const f = fecha(t);
    const anio = Number(f.slice(0, 4));
    const conocido = anio >= RANGO.desde && anio <= RANGO.hasta;
    const semana = new Date(t).getUTCDay();
    if (conocido ? esHabil(f) : semana !== 0 && semana !== 6) n++;
  }
  return n;
}

export function prorrateo(
  valor: number,
  plan: PlanDeAbono,
  desde: string,
  hasta: string,
  cuenta: DiasDeMensualidad = 'calendario',
): number {
  const fin = finDelPeriodo(plan, desde);
  const habiles = cuenta === 'habiles' && habilesEntre(desde, fin) > 0;
  const completo = habiles ? habilesEntre(desde, fin) : diasEntre(desde, fin);
  const dias = habiles ? habilesEntre(desde, hasta) : diasEntre(desde, hasta);
  if (dias >= completo) return valor;
  return Math.floor((valor * dias) / completo / 100) * 100;
}

/** Un periodo de una liquidación de mensualidades (HU-Q11.6), con lo que hace falta para explicarlo. */
export interface PeriodoLiquidado {
  readonly desde: string;
  readonly hasta: string;
  /** Los días que cubre, los dos extremos incluidos. */
  readonly dias: number;
  /** Los días del mes completo que empieza en `desde`: el divisor del prorrateo. */
  readonly diasDelMes: number;
  /** El valor del mes por los días que cubre, sin redondear (hacia abajo al peso). */
  readonly exacto: number;
  /** Lo que se cobra: el mes entero, o `exacto` hacia abajo a la centena. */
  readonly valor: number;
}

export interface LiquidacionDeMensualidad {
  readonly periodos: readonly PeriodoLiquidado[];
  readonly total: number;
}

/** Lo que falta para liquidar, con el nombre que lee el parqueadero (P1, P15). */
export class MensualidadIncompleta extends Error {
  readonly faltan: readonly string[];
  constructor(faltan: readonly string[]) {
    super(`Falta ${faltan.join(', ')}`);
    this.name = 'MensualidadIncompleta';
    this.faltan = faltan;
  }
}

/** Hasta 24 meses por liquidación: más que eso no es una mensualidad. */
export const MESES_MAXIMOS = 24;
const VALOR_MAXIMO = 100_000_000;

const esFecha = (f: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(ms(f)) && fecha(ms(f)) === f;

/**
 * Cuánto cobrar por una mensualidad desde `desde` (HU-Q11.6): con `hastaFinDeMes`, primero los
 * días que quedan del mes, prorrateados como en la caja, y después `meses` meses completos; sin
 * él, `meses` meses completos desde `desde`. Un valor ilegible o en cero no da un total: lanza
 * `MensualidadIncompleta` con lo que falta (CA3).
 */
export function liquidarMensualidad(
  valor: number,
  desde: string,
  o: { readonly meses: number; readonly hastaFinDeMes: boolean },
): LiquidacionDeMensualidad {
  const faltan: string[] = [];
  if (!Number.isSafeInteger(valor) || valor < 1 || valor > VALOR_MAXIMO) {
    faltan.push('el valor del mes');
  }
  if (!esFecha(desde)) faltan.push('la fecha de inicio');
  const minimo = o.hastaFinDeMes ? 0 : 1;
  if (!Number.isSafeInteger(o.meses) || o.meses < minimo || o.meses > MESES_MAXIMOS) {
    faltan.push('cuántos meses');
  }
  if (faltan.length > 0) throw new MensualidadIncompleta(faltan);

  const periodo = (d: string, h: string): PeriodoLiquidado => {
    const diasDelMes = diasEntre(d, unMesDesde(d));
    const dias = diasEntre(d, h);
    return {
      desde: d,
      hasta: h,
      dias,
      diasDelMes,
      exacto: dias >= diasDelMes ? valor : Math.floor((valor * dias) / diasDelMes),
      valor: prorrateo(valor, 'mes', d, h),
    };
  };
  const periodos: PeriodoLiquidado[] = [];
  let inicio = desde;
  if (o.hastaFinDeMes) {
    periodos.push(periodo(inicio, finDeMes(inicio)));
    inicio = diaSiguiente(finDeMes(inicio));
  }
  for (let i = 0; i < o.meses; i++) {
    const h = unMesDesde(inicio);
    periodos.push(periodo(inicio, h));
    inicio = diaSiguiente(h);
  }
  return { periodos, total: periodos.reduce((a, p) => a + p.valor, 0) };
}
