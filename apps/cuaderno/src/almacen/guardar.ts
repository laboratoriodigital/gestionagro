/**
 * Guardar un registro nunca espera a la red (ARQUITECTURA §5.3, regla 1).
 *
 * El registro y su operación de salida se escriben en **una** transacción: si falla una, no
 * queda ninguna. Un registro sin su operación nunca subiría; una operación sin registro subiría
 * algo que no existe.
 */
import { type Registro, validarRegistro } from '@gestionagro/agro-schema';
import { conEscritura } from '../actividad.ts';
import type { CuadernoDb } from './db.ts';

/**
 * Valida y guarda. Lanza `ErrorDeRegistro` (con los campos) antes de tocar la base si el
 * registro no es válido, y el error de IndexedDB si la transacción falla.
 */
export async function guardarRegistro(
  db: CuadernoDb,
  entrada: unknown,
  ahora: () => Date = () => new Date(),
): Promise<Registro> {
  const registro = validarRegistro(entrada);
  // Cuenta como escritura en curso: una actualización no la interrumpe (HU-E3.1, CA2).
  await conEscritura(() =>
    db.transaction('rw', db.registro, db.outbox, async () => {
      await db.registro.add(registro);
      await db.outbox.add({
        id: registro.id,
        entidad: 'registro',
        op: 'crear',
        creado: ahora().toISOString(),
      });
    }),
  );
  return registro;
}
