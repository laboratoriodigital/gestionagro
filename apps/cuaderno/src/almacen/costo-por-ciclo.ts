/**
 * Costo por kilo y margen por ciclo (HU-E7.3), en el navegador (ADR-5) con `costoUnitario` de
 * agro-calc. Una fila por ciclo (sus naves) y, aparte, por área para lo que no tiene ciclo.
 *
 * - **Costo:** insumos aplicados (HU-E7.1) y mano de obra (HU-E7.2) del ciclo, en toda su vida.
 * - **Por unidad:** sobre lo vendible (cosechado − descarte), en la unidad de la cosecha. Si el
 *   ciclo cosechó en varias unidades (kg y cajas), no se puede repartir el costo entre ellas: no
 *   se calcula y se dice (P1).
 * - **Ingresos:** cada línea de despacho vale cantidad × precio, y se reparte entre los ciclos de
 *   las cosechas de su lote según cuánto puso cada una. Un despacho sin precio no suma 0: deja el
 *   margen incompleto.
 *
 * La cuenta vive en `@ed1/agro-schema` (HU-E0.12), la misma del asistente de la finca.
 */
import {
  type CostoDeCiclo,
  costoPorCiclo as costoPorCicloDe,
  TIPOS_DEL_COSTO,
} from '@ed1/agro-schema';
import { datosDeLaFinca } from './datos-de-la-finca.ts';
import type { CuadernoDb } from './db.ts';

export type { CostoDeCiclo };

export async function costoPorCiclo(db: CuadernoDb, fincaId: string): Promise<CostoDeCiclo[]> {
  return costoPorCicloDe(await datosDeLaFinca(db, fincaId, TIPOS_DEL_COSTO));
}
