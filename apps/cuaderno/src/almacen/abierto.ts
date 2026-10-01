/**
 * La base local de la app, abierta una sola vez y compartida por todas las pantallas.
 * Las pruebas no la usan: abren la suya con `abrirCuaderno` y fake-indexeddb.
 */
import { abrirCuaderno, type CuadernoDb } from './db.ts';

let abierta: CuadernoDb | null = null;

export function cuaderno(): CuadernoDb {
  abierta ??= abrirCuaderno();
  return abierta;
}
