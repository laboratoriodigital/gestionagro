/**
 * La base local de la app, abierta una sola vez y compartida por todas las pantallas: la de la
 * finca activa (HU-E4.7). Cambiar de finca recarga la app, así que nunca hay dos abiertas.
 * Las pruebas no la usan: abren la suya con `abrirCuaderno` y fake-indexeddb.
 */
import { abrirCuaderno, type CuadernoDb } from './db.ts';
import { baseActiva } from './fincas-locales.ts';

let abierta: CuadernoDb | null = null;

export function cuaderno(): CuadernoDb {
  abierta ??= abrirCuaderno({ nombre: baseActiva() });
  return abierta;
}
