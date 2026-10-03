/**
 * El logo de la finca para la etiqueta QR (revisión del dueño, 3 oct 2026): se guarda, se lee y
 * se quita en el teléfono; solo imágenes, y livianas.
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { abrirCuaderno } from './db.ts';
import { guardarLogo, leerLogo, quitarLogo } from './marca.ts';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('logo de la finca', () => {
  it('se guarda, se lee y se quita', async () => {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    expect(await leerLogo(db)).toBeNull();
    await guardarLogo(db, PNG);
    expect(await leerLogo(db)).toBe(PNG);
    await quitarLogo(db);
    expect(await leerLogo(db)).toBeNull();
  });

  it('solo una imagen, y liviana', async () => {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    await expect(guardarLogo(db, 'data:text/html;base64,PGgxPg==')).rejects.toThrow(/PNG, JPG/);
    await expect(guardarLogo(db, `data:image/png;base64,${'A'.repeat(300_000)}`)).rejects.toThrow(
      /pesa demasiado/,
    );
    expect(await leerLogo(db)).toBeNull();
  });
});
