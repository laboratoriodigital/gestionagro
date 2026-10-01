/**
 * Registro de riego en sustrato (HU-E3.7).
 *
 * - El % de drenaje lo calcula `agro-calc` desde los volúmenes (CA1); sin drenaje medido, no hay %.
 * - Duración en minutos desde riego v2 (revisión del dueño, 1 oct 2026); los v1 no la tienen.
 * - CE y pH vacíos son «no medido», distinto de 0 (CA2, P1). Fuera de rango, el esquema lo rechaza.
 * - El mismo riego en varias áreas: un registro por área, cada uno con su ciclo activo, en una sola
 *   transacción (CA3).
 */
import { drenajePct } from '@gestionagro/agro-calc';
import type { Registro } from '@gestionagro/agro-schema';
import { cabeceraDeRegistro, type OpcionesDeRegistro } from './cabecera.ts';
import type { CuadernoDb } from './db.ts';
import { guardarRegistros } from './guardar.ts';

export type UnidadRiego = 'mL_gotero' | 'L_area';

export interface DatosRiego {
  unidad: UnidadRiego;
  volumenAplicado: number;
  /** Minutos que duró el riego; nulo = no se anotó (riego v2). */
  duracionMin: number | null;
  volumenDrenado: number | null;
  ceEntradaDsM: number | null;
  phEntrada: number | null;
  ceDrenajeDsM: number | null;
  phDrenaje: number | null;
}

export interface DatosRiegoGuardado extends DatosRiego {
  drenajePct: number | null;
}

export async function guardarRiego(
  db: CuadernoDb,
  fincaId: string,
  areaIds: readonly string[],
  datos: DatosRiego,
  { ahora = () => new Date(), corrige }: OpcionesDeRegistro = {},
): Promise<Registro[]> {
  // Una corrección reemplaza un registro de una sola área: la del corregido.
  const areas = corrige ? corrige.area_ids.slice(0, 1) : areaIds;
  if (areas.length === 0) throw new Error('El riego necesita al menos un área');
  // Lanza ErrorDeMedida con el campo si los volúmenes no cuadran (P1).
  const pct =
    datos.volumenDrenado === null ? null : drenajePct(datos.volumenAplicado, datos.volumenDrenado);
  const registros = [];
  for (const areaId of areas) {
    const cabecera = await cabeceraDeRegistro(db, {
      fincaId,
      areaId,
      tipo: 'riego',
      v: 2,
      personaIds: [],
      origen: 'manual',
      ahora,
      corrige,
    });
    registros.push({
      ...cabecera,
      datos: { ...datos, drenajePct: pct } satisfies DatosRiegoGuardado,
    });
  }
  return guardarRegistros(db, registros, { ahora });
}
