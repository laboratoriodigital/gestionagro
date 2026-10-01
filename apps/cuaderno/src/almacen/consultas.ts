/**
 * Consultas de registros para las pantallas del cuaderno. Todo se calcula en el teléfono
 * (ADR-5): la celda nunca ejecuta un reporte.
 */
import type { Registro } from '@gestionagro/agro-schema';
import type { CuadernoDb } from './db.ts';

/** Últimos registros de la finca de los tipos pedidos, del más reciente al más viejo. */
export async function ultimosRegistros(
  db: CuadernoDb,
  fincaId: string,
  tipos: readonly string[],
  limite = 10,
): Promise<Registro[]> {
  const registros = await db.registro
    .where('tipo')
    .anyOf([...tipos])
    .filter((r) => r.finca_id === fincaId)
    .toArray();
  // Mismo instante (un riego en varias naves): desempata el id, que es UUIDv7.
  return registros
    .sort((a, b) => b.instante_evento.localeCompare(a.instante_evento) || b.id.localeCompare(a.id))
    .slice(0, limite);
}

/** Ids de registros que siguen en la cola de salida: «solo en este teléfono» (HU-E3.14). */
export async function pendientesDeSubir(db: CuadernoDb): Promise<Set<string>> {
  // Para un registro, el id de su operación de salida es el id del registro.
  const ids = await db.outbox.filter((o) => o.entidad === 'registro').primaryKeys();
  return new Set(ids.map(String));
}
