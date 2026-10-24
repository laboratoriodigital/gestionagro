/**
 * Los datos de la finca leídos de la base del teléfono, para las cuentas compartidas de
 * `@ed1/agro-schema` (HU-E0.12): la bodega, la mano de obra, el costo por kilo y el rendimiento
 * son las mismas en el cuaderno y en el asistente de la finca (P2).
 */
import type { DatosDeLaFinca } from '@ed1/agro-schema';
import { anulados } from './consultas.ts';
import type { CuadernoDb } from './db.ts';

/** Lee de la finca los catálogos y los registros de los tipos pedidos, también los anulados. */
export async function datosDeLaFinca(
  db: CuadernoDb,
  fincaId: string,
  tipos: readonly string[],
): Promise<DatosDeLaFinca> {
  const [areas, ciclos, insumos, valoresJornal, registros, fuera] = await Promise.all([
    db.area.where('finca_id').equals(fincaId).toArray(),
    db.ciclo.where('finca_id').equals(fincaId).toArray(),
    db.insumo.where('finca_id').equals(fincaId).toArray(),
    // Pocas filas por finca: sin índice por finca_id (db.ts), se filtra.
    db.valor_jornal.filter((v) => v.finca_id === fincaId).toArray(),
    db.registro
      .where('tipo')
      .anyOf([...tipos])
      .filter((r) => r.finca_id === fincaId)
      .toArray(),
    anulados(db),
  ]);
  return { areas, ciclos, insumos, valoresJornal, registros, anulados: fuera };
}
