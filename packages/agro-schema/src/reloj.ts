/**
 * Fechas (ARQUITECTURA §5.6 y §5.7, P8). Los ids (UUIDv7) viven en `@ed1/ids`, que es neutro
 * (R2): se reexportan aquí para que nada de lo que ya los importa de este paquete se rompa.
 */

export { type Aleatorio, instanteDeUuidv7, type Reloj, uuidv7 } from '@ed1/ids';

/** Huso de la finca cero; cada finca podrá declarar el suyo cuando haga falta. */
export const ZONA_POR_DEFECTO = 'America/Bogota';

/**
 * Fecha agronómica `YYYY-MM-DD`: el día **local de la finca** en que pasó algo. Carencias,
 * reportes y días desde el trasplante se cuentan con ella, nunca con la fecha UTC (P8).
 */
export function fechaAgronomica(instanteMs: number, zona: string = ZONA_POR_DEFECTO): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instanteMs));
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

const MS_POR_DIA = 86_400_000;

/**
 * Días entre dos fechas agronómicas `AAAA-MM-DD` (P8). Se cuentan en el calendario, sin horas
 * ni husos: del 31/12 al 1/1 hay 1 día, en cualquier huso del teléfono.
 */
export function diasEntre(desde: string, hasta: string): number {
  const ms = (f: string) => {
    const [a, m, d] = f.split('-').map(Number);
    if (!a || !m || !d) throw new RangeError(`Fecha agronómica inválida: «${f}»`);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((ms(hasta) - ms(desde)) / MS_POR_DIA);
}

/** La fecha agronómica `n` días después de `fecha` (P8): en el calendario, sin horas ni husos. */
export function sumarDias(fecha: string, n: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  if (!a || !m || !d) throw new RangeError(`Fecha agronómica inválida: «${fecha}»`);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Colombia: UTC−5 todo el año (sin horario de verano desde 1993). */
const DESFASE_COLOMBIA = '-05:00';

/**
 * El instante (ms Unix) de una fecha `AAAA-MM-DD` y una hora `HH:MM` escritas en hora de Colombia,
 * con cualquier huso del teléfono (P8). Null si no son una fecha y una hora reales.
 */
export function instanteEnColombia(fecha: string, hora: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null;
  const ms = Date.parse(`${fecha}T${hora}:00${DESFASE_COLOMBIA}`);
  // Date.parse acepta el 31/02 y lo corre: se compara de vuelta para rechazarlo.
  return Number.isNaN(ms) || fechaAgronomica(ms) !== fecha ? null : ms;
}
