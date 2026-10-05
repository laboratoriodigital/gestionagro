/**
 * Id de este teléfono (ARQUITECTURA §5.7, `dispositivo_id`). Se genera una vez y se guarda en la
 * base local: así cada registro dice de qué teléfono salió, y la sincronización (E5) y la
 * revocación de un teléfono perdido (HU-E4.6) lo usan. No identifica a la persona.
 */
import { uuidv7 } from '@ed1/agro-schema';
import type { CuadernoDb } from './db.ts';

export const CLAVE_DISPOSITIVO = 'dispositivo_id';

export async function idDispositivo(
  db: CuadernoDb,
  ahora: () => Date = () => new Date(),
): Promise<string> {
  return db.transaction('rw', db.meta, async () => {
    const guardado = await db.meta.get(CLAVE_DISPOSITIVO);
    if (typeof guardado?.valor === 'string') return guardado.valor;
    const nuevo = uuidv7();
    await db.meta.put({
      clave: CLAVE_DISPOSITIVO,
      valor: nuevo,
      actualizado: ahora().toISOString(),
    });
    return nuevo;
  });
}
