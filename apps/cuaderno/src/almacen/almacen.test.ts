/**
 * Almacén local (HU-E3.2) sobre fake-indexeddb.
 *
 * Lo que fake-indexeddb NO imita (P17): la cuota de almacenamiento del navegador, el desalojo
 * de datos cuando el teléfono se queda sin espacio, `navigator.storage.persist()` real ni las
 * diferencias entre motores (Chrome Android frente a Safari iOS). Esas propiedades se prueban
 * en el teléfono (HU-E3.1, e2e) y se vigilan con el indicador «solo en este teléfono».
 */
import { ErrorDeRegistro } from '@gestionagro/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { SEMILLAS } from '../../../../tests/fixtures/semillas.ts';
import { abrirCuaderno } from './db.ts';
import { guardarRegistro } from './guardar.ts';
import { CLAVE_PERSISTENCIA, pedirPersistencia } from './persistencia.ts';

const nuevaDb = () => abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });

describe.each(SEMILLAS.map((s) => [s.finca.nombre, s] as const))(
  'guardar un registro — %s',
  (_nombre, semilla) => {
    const registro = semilla.registros[0];
    if (!registro) throw new Error('la semilla no trae registros');

    it('guarda el registro y su operación de salida juntos', async () => {
      const db = nuevaDb();
      await guardarRegistro(db, registro);
      expect(await db.registro.get(registro.id)).toEqual(registro);
      expect(await db.outbox.get(registro.id)).toMatchObject({ entidad: 'registro', op: 'crear' });
    });

    // CA1: si falla la operación de salida, el registro tampoco queda.
    it('si la operación de salida falla, no queda el registro', async () => {
      const db = nuevaDb();
      await db.outbox.add({
        id: registro.id,
        entidad: 'registro',
        entidad_id: registro.id,
        version: 1,
        op: 'crear',
        creado: 'antes',
      });
      await expect(guardarRegistro(db, registro)).rejects.toThrow();
      expect(await db.registro.count()).toBe(0);
    });

    it('si el registro falla, no queda la operación de salida', async () => {
      const db = nuevaDb();
      await db.registro.add(registro);
      await expect(guardarRegistro(db, registro)).rejects.toThrow();
      expect(await db.outbox.count()).toBe(0);
    });

    // CA2: vacío o ilegible no se guarda y el error nombra el campo.
    it('un campo de medida vacío no se guarda y el error lo nombra', async () => {
      const db = nuevaDb();
      const malo = {
        ...registro,
        datos: { ...(registro.datos as object), humedadRelativaPct: '' },
      };
      const error = await guardarRegistro(db, malo).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ErrorDeRegistro);
      expect((error as ErrorDeRegistro).campos.map((c) => c.campo)).toEqual([
        'datos.humedadRelativaPct',
      ]);
      expect(await db.registro.count()).toBe(0);
      expect(await db.outbox.count()).toBe(0);
    });
  },
);

describe('persistencia del almacenamiento (CA4)', () => {
  it.each([
    ['concedida', { persist: async (): Promise<boolean> => true }],
    ['negada', { persist: async (): Promise<boolean> => false }],
    [
      'no-disponible',
      {
        persist: async (): Promise<boolean> => {
          throw new Error('no soportado');
        },
      },
    ],
    ['no-disponible', undefined],
  ] as const)('guarda «%s»', async (esperado, storage) => {
    const db = nuevaDb();
    expect(await pedirPersistencia(db, storage)).toBe(esperado);
    expect((await db.meta.get(CLAVE_PERSISTENCIA))?.valor).toBe(esperado);
  });
});
