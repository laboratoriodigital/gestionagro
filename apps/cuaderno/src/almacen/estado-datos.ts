/**
 * Dónde está cada dato (HU-E3.14, ARQUITECTURA §5.3 regla 4). Tres estados:
 * - «solo en este teléfono»: el registro sigue en la cola de salida;
 * - «enviado»: la celda lo confirmó (llega con la sincronización, HU-E5.2);
 * - «rechazado»: la celda lo puso en cuarentena con un motivo (HU-E5.2). Nunca se descarta (P1).
 *
 * Hoy no hay sincronización: todo registro está «solo en este teléfono».
 */
import type { CuadernoDb } from './db.ts';
import { CLAVE_PERSISTENCIA } from './persistencia.ts';

export type EstadoDeRegistro = 'solo-aqui' | 'enviado' | 'rechazado';

export interface ResumenDeDatos {
  /** Registros que todavía no salieron del teléfono. */
  soloAqui: number;
  /** Cambios de catálogo (fincas, áreas, insumos…) que tampoco han salido. */
  cambiosSoloAqui: number;
  /** El navegador no concedió almacenamiento permanente: puede borrar los datos si falta espacio. */
  almacenamientoEnRiesgo: boolean;
}

export async function resumenDeDatos(db: CuadernoDb): Promise<ResumenDeDatos> {
  const ops = await db.outbox.toArray();
  const persistencia = await db.meta.get(CLAVE_PERSISTENCIA);
  return {
    soloAqui: ops.filter((o) => o.entidad === 'registro').length,
    cambiosSoloAqui: ops.filter((o) => o.entidad !== 'registro').length,
    almacenamientoEnRiesgo: persistencia !== undefined && persistencia.valor !== 'concedida',
  };
}

/** Texto corto para la cabecera. Singular y plural en español, sin «registro(s)». */
export function textoIndicador(r: Pick<ResumenDeDatos, 'soloAqui'>): string {
  if (r.soloAqui === 0) return 'Sin registros pendientes';
  return r.soloAqui === 1
    ? '1 registro solo en este teléfono'
    : `${r.soloAqui} registros solo en este teléfono`;
}
