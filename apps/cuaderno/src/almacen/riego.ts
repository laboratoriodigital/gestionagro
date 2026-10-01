/**
 * Registro de riego en sustrato (HU-E3.7).
 *
 * - El % de drenaje lo calcula `agro-calc` desde los volúmenes (CA1); sin drenaje medido, no hay %.
 * - CE y pH vacíos son «no medido», distinto de 0 (CA2, P1). Fuera de rango, el esquema lo rechaza.
 * - El mismo riego en varias áreas: un registro por área, cada uno con su ciclo activo, en una sola
 *   transacción (CA3).
 */
import { drenajePct } from '@gestionagro/agro-calc';
import { fechaAgronomica, type Registro, uuidv7 } from '@gestionagro/agro-schema';
import { cicloActivoDe } from './ciclos.ts';
import type { CuadernoDb } from './db.ts';
import { idDispositivo } from './dispositivo.ts';
import { guardarRegistros } from './guardar.ts';

export type UnidadRiego = 'mL_gotero' | 'L_area';

export interface DatosRiego {
  unidad: UnidadRiego;
  volumenAplicado: number;
  volumenDrenado: number | null;
  ceEntradaDsM: number | null;
  phEntrada: number | null;
  ceDrenajeDsM: number | null;
  phDrenaje: number | null;
}

export interface DatosRiegoGuardado extends DatosRiego {
  drenajePct: number | null;
}

interface Opciones {
  ahora?: () => Date;
}

export async function guardarRiego(
  db: CuadernoDb,
  fincaId: string,
  areaIds: readonly string[],
  datos: DatosRiego,
  { ahora = () => new Date() }: Opciones = {},
): Promise<Registro[]> {
  if (areaIds.length === 0) throw new Error('El riego necesita al menos un área');
  const momento = ahora();
  // Lanza ErrorDeMedida con el campo si los volúmenes no cuadran (P1).
  const pct =
    datos.volumenDrenado === null ? null : drenajePct(datos.volumenAplicado, datos.volumenDrenado);
  const dispositivo = await idDispositivo(db, ahora);
  const registros = [];
  for (const areaId of areaIds) {
    const ciclo = await cicloActivoDe(db, areaId);
    registros.push({
      // Mismo milisegundo para todos; el azar del UUIDv7 los distingue.
      id: uuidv7(() => momento.getTime()),
      org_id: null,
      finca_id: fincaId,
      area_ids: [areaId],
      ciclo_id: ciclo?.id ?? null,
      tipo: 'riego',
      v: 1,
      fecha_agronomica: fechaAgronomica(momento.getTime()),
      instante_evento: momento.toISOString(),
      autor_usuario_id: null,
      persona_ids: [],
      dispositivo_id: dispositivo,
      origen: 'manual',
      anula_id: null,
      datos: { ...datos, drenajePct: pct } satisfies DatosRiegoGuardado,
    });
  }
  return guardarRegistros(db, registros, { ahora });
}
