/**
 * Rendimiento por ciclo y área (HU-E6.6), en el navegador (ADR-5) con `rendimiento` de agro-calc.
 *
 * - Una fila por ciclo y unidad de cosecha: lo cosechado en el ciclo, sobre el área de sus naves
 *   (m²) y sobre sus plantas. Sin plantas anotadas, «por planta» no se calcula (P1).
 * - Las cosechas sin ciclo van aparte, por área, sin «por planta».
 * - Agrupadas por cultivo, para comparar naves del mismo cultivo (CA2). Solo cosechas vigentes:
 *   una corregida cuenta una vez.
 *
 * La cuenta vive en `@ed1/agro-schema` (HU-E0.12), la misma del asistente de la finca.
 */
import {
  type FilaDeRendimiento,
  type GrupoDeRendimiento,
  rendimientoDeLaFinca as rendimientoDe,
} from '@ed1/agro-schema';
import { datosDeLaFinca } from './datos-de-la-finca.ts';
import type { CuadernoDb } from './db.ts';

export type { FilaDeRendimiento, GrupoDeRendimiento };

export async function rendimientoDeLaFinca(
  db: CuadernoDb,
  fincaId: string,
): Promise<GrupoDeRendimiento[]> {
  return rendimientoDe(await datosDeLaFinca(db, fincaId, ['cosecha']));
}
