/**
 * Lo que el panel guarda en el teléfono (HU-T8.1 CA1 y CA2), en una IndexedDB de mentira: la sesión
 * sobrevive a cerrar el panel, y un borrador también.
 */
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { almacenIndexedDb } from './almacen.ts';

describe('almacenIndexedDb', () => {
  it('guarda, lee y borra; lo guardado sigue ahí al abrir otra vez', async () => {
    const fabrica = new IDBFactory();
    const a = almacenIndexedDb(fabrica);
    expect(await a.leer('sesion')).toBeNull();
    await a.guardar('sesion', { acceso: 'x' });
    await a.guardar('borrador:producto', { nombre: 'Camisa' });
    // Otra pestaña, o el panel abierto mañana: otra conexión a la misma base.
    const b = almacenIndexedDb(fabrica);
    expect(await b.leer('sesion')).toEqual({ acceso: 'x' });
    await b.borrar('sesion');
    expect(await a.leer('sesion')).toBeNull();
    expect(await a.leer('borrador:producto')).toEqual({ nombre: 'Camisa' });
  });
});
