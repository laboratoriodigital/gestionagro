/**
 * Cuándo sincronizar además de al abrir, al volver la señal y cada 15 min (revisión del dueño en
 * staging, 1 oct 2026): un registro nuevo se quedaba en el teléfono hasta recargar la página, y
 * el otro teléfono no lo veía hasta su siguiente vuelta de 15 min (bitácora agro 22).
 *
 * - **Después de guardar:** a los 3 s de la última escritura, para juntar en un solo viaje lo que
 *   se anota seguido. Solo si hay algo en la cola.
 * - **Al volver a la app:** cuando el cuaderno vuelve a verse, como máximo cada 30 s, para traer lo
 *   del equipo.
 * - Nunca sin señal, nunca mientras corre otra sincronización y nunca antes de la espera que pidió
 *   la nube (429, 503): esa espera manda (HU-E5.2, CA5).
 */

export const DEMORA_TRAS_GUARDAR_MS = 3_000;
export const ENTRE_REVISIONES_AL_VOLVER_MS = 30_000;

export interface Situacion {
  ahora: number;
  enLinea: boolean;
  corriendo: boolean;
  /** Hasta cuándo pidió esperar la nube (ms Unix); 0 si no pidió. */
  esperarHasta: number;
  /** Cuándo terminó la última sincronización (ms Unix); 0 si nunca. */
  ultima: number;
  /** Operaciones en la cola de salida. */
  pendientes: number;
}

export function debeSincronizar(motivo: 'guardado' | 'visible', s: Situacion): boolean {
  if (!s.enLinea || s.corriendo || s.ahora < s.esperarHasta) return false;
  if (motivo === 'guardado') return s.pendientes > 0;
  return s.ahora - s.ultima >= ENTRE_REVISIONES_AL_VOLVER_MS;
}
