/**
 * Ids de la plataforma (PLATAFORMA §6.1). Los usan el CORE y todos los productos, así que no
 * dependen de ninguno (R2). Hasta la 0.3.0 vivían en el paquete del agro (`@ed1/agro-schema`),
 * que los sigue reexportando para que nada de lo que ya los importa se rompa.
 *
 * El reloj y el azar se reciben como parámetros para que las pruebas los muevan: el reloj es
 * una entrada que nadie declara, y aquí se declara (P8).
 */
import { z } from 'zod';

export type Reloj = () => number;
export type Aleatorio = (bytes: number) => Uint8Array;

const relojDelSistema: Reloj = () => Date.now();
const aleatorioDelSistema: Aleatorio = (bytes) => crypto.getRandomValues(new Uint8Array(bytes));

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
export function instanteDeUuidv7(uuid: string): number {
  return Number.parseInt(uuid.replace(/-/g, '').slice(0, 12), 16);
}

/**
 * Esquema de un id: un UUIDv7. El mensaje va escrito aquí, así no depende del idioma que cada
 * producto configure en zod.
 */
export const id = z.uuid({ version: 'v7', error: 'debe ser un UUIDv7' });
