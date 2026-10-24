/**
 * Costo de la mano de obra por nave y periodo (HU-E7.2), en el navegador (ADR-5) con agro-calc.
 *
 * Cada labor vigente cuesta, por persona, `horas / 8 × jornal`, con el jornal que regía el día de
 * la labor: el de la persona o, si no tiene, el general de la finca. Cambiar un valor no toca lo
 * pasado (CA1). Sin ningún valor que rija, el costo de esa persona no se conoce: se cuenta para
 * decirlo, nunca se suma como 0 (P1). No liquida nómina ni recargos (CA3).
 *
 * Las cuentas viven en `@ed1/agro-schema` (HU-E0.12), las mismas del asistente de la finca.
 */
import {
  type ManoDeObraDeArea,
  type ManoDeObraDeAreaYCiclo,
  manoDeObraPorArea as manoDeObraPorAreaDe,
  manoDeObraPorAreaYCiclo as manoDeObraPorAreaYCicloDe,
  type Periodo,
} from '@ed1/agro-schema';
import { datosDeLaFinca } from './datos-de-la-finca.ts';
import type { CuadernoDb } from './db.ts';

export type { ManoDeObraDeArea, ManoDeObraDeAreaYCiclo, Periodo };

/** Por área, sumando sus ciclos. */
export async function manoDeObraPorArea(
  db: CuadernoDb,
  fincaId: string,
  periodo: Periodo,
): Promise<ManoDeObraDeArea[]> {
  return manoDeObraPorAreaDe(await datosDeLaFinca(db, fincaId, ['labor']), periodo);
}

/** Por área y ciclo (HU-E7.3). */
export async function manoDeObraPorAreaYCiclo(
  db: CuadernoDb,
  fincaId: string,
  periodo: Periodo,
): Promise<ManoDeObraDeAreaYCiclo[]> {
  return manoDeObraPorAreaYCicloDe(await datosDeLaFinca(db, fincaId, ['labor']), periodo);
}
