/**
 * La cola de salida de la caja (HU-Q7.5 CA1, PARQUEADERO §5.2 y §5.3 regla 1): cada registro y
 * cada versión de un catálogo entra a `outbox` en la **misma** transacción en que se escribe. Si
 * la transacción falla, no queda ni el dato ni su operación; si se escribe, ya está en la cola.
 *
 * Solo con la caja vinculada a la nube (`nube` en `meta`): una caja sin cuenta, como las de
 * `v0.2.x`, sigue igual y no llena una cola que nadie va a enviar (P10). Lo que registró antes de
 * entrar lo sube «reclamar» (HU-Q7.6), no la cola.
 */
import type { Catalogo, Registro } from '@ed1/parqueadero-schema';
import type { BaseDeLaCaja, OperacionSalida } from './datos.ts';

/** Las tablas que una transacción que escribe necesita además de las suyas. */
export const tablasDeLaCola = (db: BaseDeLaCaja) => [db.outbox, db.meta];

/** El id con que viaja una operación: el del registro, o `<id>@v<versión>` de un catálogo. */
export const idDeOperacion = (entidad: string, entidadId: string, version: number) =>
  entidad === 'registro' ? entidadId : `${entidadId}@v${version}`;

/**
 * Pone en la cola lo que esta transacción acaba de escribir. Se llama **dentro** de la transacción
 * (con `tablasDeLaCola` en su alcance); fuera de una, Dexie abriría otra y dejaría de ser atómico.
 */
export async function encolar(
  db: BaseDeLaCaja,
  escritos: readonly (Registro | Catalogo)[],
  ahora: number,
): Promise<void> {
  if (escritos.length === 0 || !(await db.meta.get('nube'))) return;
  const ops = escritos.map((x, i): OperacionSalida => {
    const entidad = 'entidad' in x ? x.entidad : 'registro';
    const version = 'entidad' in x ? x.version : 1;
    // `creado` ordena la salida: dos escritos del mismo instante salen en el orden en que se hicieron.
    return {
      id: idDeOperacion(entidad, x.id, version),
      entidad,
      entidad_id: x.id,
      version,
      creado: ahora + i / 1000,
    };
  });
  await db.outbox.bulkPut(ops);
}
