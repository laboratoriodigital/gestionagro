/**
 * Almacenamiento persistente (ARQUITECTURA §5.3, regla 6; §13, riesgo «el navegador borra
 * IndexedDB»). Se pide `navigator.storage.persist()` y se guarda la respuesta, para que la app
 * recuerde exportar si el navegador no la concedió.
 */
import type { CuadernoDb } from './db.ts';

export type EstadoPersistencia = 'concedida' | 'negada' | 'no-disponible';

export const CLAVE_PERSISTENCIA = 'persistencia';

export async function pedirPersistencia(
  db: CuadernoDb,
  storage: Pick<StorageManager, 'persist'> | undefined,
  ahora: () => Date = () => new Date(),
): Promise<EstadoPersistencia> {
  let estado: EstadoPersistencia;
  if (!storage || typeof storage.persist !== 'function') {
    estado = 'no-disponible';
  } else {
    try {
      estado = (await storage.persist()) ? 'concedida' : 'negada';
    } catch {
      // Algunos navegadores lanzan en vez de responder: se registra como no disponible, visible.
      estado = 'no-disponible';
    }
  }
  await db.meta.put({
    clave: CLAVE_PERSISTENCIA,
    valor: estado,
    actualizado: ahora().toISOString(),
  });
  return estado;
}
