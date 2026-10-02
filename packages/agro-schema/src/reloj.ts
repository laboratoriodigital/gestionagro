/**
 * Ids y fechas (ARQUITECTURA §5.6 y §5.7, P8).
 *
 * El reloj y el azar se reciben como parámetros para que las pruebas los muevan: el reloj es
 * una entrada que nadie declara, y aquí se declara.
 */

export type Reloj = () => number;
export type Aleatorio = (bytes: number) => Uint8Array;

const relojDelSistema: Reloj = () => Date.now();
const aleatorioDelSistema: Aleatorio = (bytes) => crypto.getRandomValues(new Uint8Array(bytes));

/** Huso de la finca cero; cada finca podrá declarar el suyo cuando haga falta. */
export const ZONA_POR_DEFECTO = 'America/Bogota';

/**
 * UUID versión 7 (RFC 9562): 48 bits de milisegundos Unix y 74 bits al azar. Se genera en el
 * teléfono; reintentar un envío con el mismo id es inofensivo (ARQUITECTURA §5.6).
 */
export function uuidv7(
  reloj: Reloj = relojDelSistema,
  aleatorio: Aleatorio = aleatorioDelSistema,
): string {
  const ms = reloj();
  if (!Number.isSafeInteger(ms) || ms < 0 || ms >= 2 ** 48) {
    throw new RangeError(`Reloj inválido para UUIDv7: ${ms}`);
  }
  const b = aleatorio(16);
  if (b.length !== 16) throw new RangeError('La fuente de azar debe dar 16 bytes');
  let t = ms;
  for (let i = 5; i >= 0; i--) {
    b[i] = t % 256;
    t = Math.floor(t / 256);
  }
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x70; // versión 7
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80; // variante RFC
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Milisegundos Unix guardados en un UUIDv7. */
export function instanteDeUuidv7(id: string): number {
  return Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16);
}

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
