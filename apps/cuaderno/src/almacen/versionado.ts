/**
 * Actualizar un catálogo sin pisarlo (ADR-4): la versión anterior va a `historial`, la nueva sube
 * su número y se encola «actualizar». Una sola copia de este procedimiento para áreas, ciclos y
 * cultivos (P2).
 */
import { ErrorDeValidacion, uuidv7, validarCatalogo, type ZodType } from '@gestionagro/agro-schema';
import { Dexie } from 'dexie';

import type { CuadernoDb, Entidad, OperacionSalida, VersionAnterior } from './db.ts';

type Catalogo = Exclude<Entidad, 'registro'>;

/** Lo único que necesita de una tabla de Dexie: leer y reemplazar por id. */
export interface TablaVersionada<T> {
  get(id: string): PromiseLike<T | undefined>;
  put(item: T): PromiseLike<unknown>;
}

export const operacion = (
  entidad: Entidad,
  entidadId: string,
  version: number,
  op: OperacionSalida['op'],
  creado: string,
): OperacionSalida => ({
  id: `${entidadId}@v${version}`,
  entidad,
  entidad_id: entidadId,
  version,
  op,
  creado,
});

/**
 * Dentro de una transacción que ya incluye `tabla`, `historial` y `outbox`: lee el actual,
 * aplica `cambiar`, valida el resultado y escribe las tres cosas.
 */
export async function actualizarVersionado<
  T extends { id: string; version: number; actualizado: string },
>(
  db: CuadernoDb,
  tabla: TablaVersionada<T>,
  entidad: Catalogo,
  nombre: string,
  esquema: ZodType<T>,
  id: string,
  cambiar: (actual: T) => Partial<T>,
  instante: string,
): Promise<T> {
  // Sin transacción, una falla a la mitad dejaría el historial sin el cambio o al revés (P21).
  if (!Dexie.currentTransaction)
    throw new Error('actualizarVersionado debe correr dentro de una transacción');
  const actual = await tabla.get(id);
  if (!actual)
    throw new ErrorDeValidacion(nombre, [
      { campo: 'id', motivo: `${nombre.toLowerCase()} no existe` },
    ]);
  const nuevo = validarCatalogo(nombre, esquema, {
    ...actual,
    ...cambiar(actual),
    version: actual.version + 1,
    actualizado: instante,
  });
  const anterior: VersionAnterior = {
    id: uuidv7(),
    entidad,
    entidad_id: id,
    version: actual.version,
    datos: actual,
    reemplazada: instante,
  };
  await db.historial.add(anterior);
  await tabla.put(nuevo);
  await db.outbox.add(operacion(entidad, id, nuevo.version, 'actualizar', instante));
  return nuevo;
}
