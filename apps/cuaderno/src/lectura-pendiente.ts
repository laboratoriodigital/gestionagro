/**
 * Lectura que llega de la calculadora cuando el cuaderno aún no tiene finca (HU-E2.7). Se guarda
 * en el teléfono para no perderla mientras se configura la finca, y el formulario de clima la
 * recoge después. Vence a las 2 horas: el registro se fecha al guardarse, y una lectura de ayer
 * fechada hoy sería un dato falso (P1).
 */

export interface Lectura {
  t?: string;
  hr?: string;
  th?: string;
}

const CLAVE = 'gestionagro.lectura-pendiente';
export const VIGENCIA_MS = 2 * 3_600_000;

/** Lo que se usa de `localStorage`; las pruebas pasan uno en memoria. */
type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const local = (): Almacen => globalThis.localStorage;

export function guardarLecturaPendiente(
  lectura: Lectura,
  ahora: number = Date.now(),
  almacen: () => Almacen = local,
): void {
  try {
    almacen().setItem(CLAVE, JSON.stringify({ ...lectura, guardada: ahora }));
  } catch {
    // Sin almacenamiento local la lectura se pierde; quien la tomó la vuelve a escribir.
  }
}

/** Devuelve la lectura pendiente si sigue vigente y la borra: se usa una sola vez. */
export function tomarLecturaPendiente(
  ahora: number = Date.now(),
  almacen: () => Almacen = local,
): Lectura | null {
  try {
    const texto = almacen().getItem(CLAVE);
    if (!texto) return null;
    almacen().removeItem(CLAVE);
    const { guardada, t, hr, th } = JSON.parse(texto) as Lectura & { guardada?: number };
    if (typeof guardada !== 'number' || ahora - guardada > VIGENCIA_MS || ahora < guardada) {
      return null;
    }
    const valida = (x: unknown) => (typeof x === 'string' ? x.slice(0, 12) : undefined);
    const lectura: Lectura = {};
    for (const [clave, valor] of [
      ['t', valida(t)],
      ['hr', valida(hr)],
      ['th', valida(th)],
    ] as const) {
      if (valor !== undefined) lectura[clave] = valor;
    }
    return lectura;
  } catch {
    return null;
  }
}
