/**
 * Guardar un registro nunca espera a la red (ARQUITECTURA §5.3, regla 1).
 *
 * El registro y su operación de salida se escriben en **una** transacción: si falla una, no
 * queda ninguna. Un registro sin su operación nunca subiría; una operación sin registro subiría
 * algo que no existe. Varios registros a la vez (el mismo riego en tres naves) van en la misma
 * transacción: o quedan todos o ninguno (HU-E3.7, CA3).
 */
import { ErrorDeRegistro, type Registro, validarRegistro } from '@ed1/agro-schema';
import { conEscritura } from '../actividad.ts';
import type { CuadernoDb } from './db.ts';

export interface OpcionesDeGuardado {
  ahora?: () => Date;
  /**
   * Un registro sobre un ciclo cerrado se rechaza salvo confirmación explícita de quien registra
   * (HU-E3.4, CA3): por ejemplo, anotar tarde una labor que sí ocurrió antes del cierre.
   */
  confirmarCicloCerrado?: boolean;
}

/**
 * Valida todos y los guarda juntos. Lanza `ErrorDeRegistro` (con los campos) antes de tocar la
 * base si alguno no es válido, y el error de IndexedDB si la transacción falla.
 */
export async function guardarRegistros(
  db: CuadernoDb,
  entradas: readonly unknown[],
  { ahora = () => new Date(), confirmarCicloCerrado = false }: OpcionesDeGuardado = {},
): Promise<Registro[]> {
  const registros = entradas.map((e) => validarRegistro(e));
  // Cuenta como escritura en curso: una actualización no la interrumpe (HU-E3.1, CA2).
  await conEscritura(() =>
    db.transaction('rw', db.registro, db.outbox, db.ciclo, async () => {
      for (const registro of registros) {
        // Corregir un registro de un ciclo ya cerrado es arreglar su traza, no anotar algo nuevo.
        if (registro.ciclo_id && !confirmarCicloCerrado && !registro.anula_id) {
          const ciclo = await db.ciclo.get(registro.ciclo_id);
          if (ciclo?.estado === 'cerrado') {
            throw new ErrorDeRegistro([
              {
                campo: 'ciclo_id',
                motivo: `el ciclo de ${ciclo.cultivo} se cerró el ${ciclo.fecha_fin?.split('-').reverse().join('/')}; confirma si de verdad va en ese ciclo`,
              },
            ]);
          }
        }
        if (registro.anula_id) await exigirCorregible(db, registro);
        await db.registro.add(registro);
        await db.outbox.add({
          id: registro.id,
          entidad: 'registro',
          entidad_id: registro.id,
          version: 1,
          op: 'crear',
          creado: ahora().toISOString(),
        });
      }
    }),
  );
  return registros;
}

/**
 * Una corrección solo reemplaza a un registro vigente del mismo tipo y finca (HU-E3.12, CA2).
 * Corregir dos veces el mismo dejaría dos vigentes para un solo evento: se corrige el último.
 */
async function exigirCorregible(db: CuadernoDb, registro: Registro): Promise<void> {
  const original = registro.anula_id ? await db.registro.get(registro.anula_id) : undefined;
  const motivo = !original
    ? 'el registro que se corrige no existe en este teléfono'
    : original.finca_id !== registro.finca_id || original.tipo !== registro.tipo
      ? 'una corrección debe ser del mismo tipo y la misma finca'
      : (await db.registro.where('anula_id').equals(original.id).count()) > 0
        ? 'ese registro ya se corrigió; corrige la versión vigente'
        : null;
  if (motivo) throw new ErrorDeRegistro([{ campo: 'anula_id', motivo }]);
}

export async function guardarRegistro(
  db: CuadernoDb,
  entrada: unknown,
  opciones: OpcionesDeGuardado = {},
): Promise<Registro> {
  const [registro] = await guardarRegistros(db, [entrada], opciones);
  if (!registro) throw new Error('guardarRegistros no devolvió el registro');
  return registro;
}
