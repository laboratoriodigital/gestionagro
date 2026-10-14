/**
 * Los periodos y el prorrateo de una mensualidad (HU-Q8.4 CA1). Puros, con fechas de Bogotá
 * (`2026-10-09`) y sin reloj: la caja y la celda calculan igual.
 *
 * - **Un mes, de fecha a fecha** (como siempre, y la opción por omisión): del día `desde` al día
 *   anterior del mes siguiente (`2026-10-07` → `2026-11-06`); si ese día no existe, al último del
 *   mes siguiente (`2026-01-31` → `2026-02-28`), con `unMesDesde`.
 * - **Un mes, del 1 al último día** (HU-Q13.4, `periodo: 'calendario'`, pedido del dueño del
 *   14 oct 2026): una mensualidad contratada a mitad de mes cobra esos días en proporción, y los
 *   meses siguientes, enteros.
 * - **Una quincena** son 15 días, los dos extremos incluidos.
 * - **El prorrateo** de un periodo empezado cobra los días que cubre sobre los del periodo entero,
 *   redondeado hacia abajo a la centena: como el redondeo de la tarifa, nunca cobra de más. Con
 *   `habiles` (HU-Q13.3) cuenta solo los lunes a viernes que no son festivo en Colombia, arriba y
 *   abajo; sin hábiles en el periodo entero, cuenta los días calendario.
 */
import { esHabil, RANGO } from '@ed1/calendario';
import type { DiasDeMensualidad, PeriodoDeMensualidad, PlanDeAbono } from '@ed1/parqueadero-schema';

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

/**
 * El último día que cubre un pago del plan que empieza en `desde`: 15 días en la quincena; en el
 * mes, el día anterior del mes siguiente, o el fin de su mes con `periodo: 'calendario'`.
 */
export const finDelPeriodo = (
  plan: PlanDeAbono,
  desde: string,
  periodo: PeriodoDeMensualidad = 'fecha',
): string =>
  plan === 'quincena'
    ? fecha(ms(desde) + 14 * DIA_MS)
    : periodo === 'calendario'
      ? finDeMes(desde)
      : unMesDesde(desde);

/** El último día del mes de `f`: `2026-10-20` → `2026-10-31`. */
export function finDeMes(f: string): string {
  const [a = 0, m = 1] = f.split('-').map(Number);
  return fecha(Date.UTC(a, m, 0));
}

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

/** Los días que cuenta un tramo: todos, o los hábiles (sin hábiles en el entero, todos). */
function contar(desde: string, hasta: string, entero: [string, string], cuenta: DiasDeMensualidad) {
  const habiles = cuenta === 'habiles' && habilesEntre(entero[0], entero[1]) > 0;
  return habiles
    ? { dias: habilesEntre(desde, hasta), completo: habilesEntre(entero[0], entero[1]), habiles }
    : { dias: diasEntre(desde, hasta), completo: diasEntre(entero[0], entero[1]), habiles };
}

const parte = (valor: number, dias: number, completo: number) =>
  dias >= completo ? valor : Math.floor((valor * dias) / completo / 100) * 100;

/** Un tramo del prorrateo, con lo que la caja necesita para explicarlo (HU-Q13.5). */
export interface TramoDeProrrateo {
  readonly desde: string;
  readonly hasta: string;
  /** Los días que cubre: calendario, o hábiles si `habiles`. */
  readonly dias: number;
  /** Los días del periodo entero con que se compara. */
  readonly completo: number;
  readonly habiles: boolean;
  /** Cubre el periodo entero: vale el valor del plan. */
  readonly entero: boolean;
  readonly valor: number;
}

/**
 * Los tramos de cubrir de `desde` a `hasta` con un plan de `valor`, cada uno hacia abajo a la
 * centena; los días son calendario, o hábiles con `cuenta` (HU-Q13.3).
 * - De fecha a fecha (por omisión) y en la quincena: un tramo, entero si cubre el periodo completo o
 *   más; si no, la parte de sus días sobre los del periodo que empieza en `desde`.
 * - Del 1 al último día (`periodo: 'calendario'`, HU-Q13.4): un tramo por mes calendario que toca,
 *   entero si lo cubre todo, y si no, la parte de sus días sobre los de ese mes.
 */
export function detalleDelProrrateo(
  valor: number,
  plan: PlanDeAbono,
  desde: string,
  hasta: string,
  cuenta: DiasDeMensualidad = 'calendario',
  periodo: PeriodoDeMensualidad = 'fecha',
): TramoDeProrrateo[] {
  const tramo = (d: string, h: string, entero: [string, string]): TramoDeProrrateo => {
    const c = contar(d, h, entero, cuenta);
    return {
      desde: d,
      hasta: h,
      ...c,
      entero: c.dias >= c.completo,
      valor: parte(valor, c.dias, c.completo),
    };
  };
  if (plan === 'quincena' || periodo === 'fecha') {
    return [tramo(desde, hasta, [desde, finDelPeriodo(plan, desde)])];
  }
  const tramos: TramoDeProrrateo[] = [];
  for (let d = desde; d <= hasta; d = diaSiguiente(finDeMes(d))) {
    const mes: [string, string] = [`${d.slice(0, 8)}01`, finDeMes(d)];
    tramos.push(tramo(d, hasta < mes[1] ? hasta : mes[1], mes));
  }
  return tramos;
}

/** Lo que vale cubrir de `desde` a `hasta`: la suma de sus tramos (`detalleDelProrrateo`). */
export function prorrateo(
  valor: number,
  plan: PlanDeAbono,
  desde: string,
  hasta: string,
  cuenta: DiasDeMensualidad = 'calendario',
  periodo: PeriodoDeMensualidad = 'fecha',
): number {
  return detalleDelProrrateo(valor, plan, desde, hasta, cuenta, periodo).reduce(
    (a, t) => a + t.valor,
    0,
  );
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
