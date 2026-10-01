/**
 * Finca y áreas (HU-E3.3) sobre fake-indexeddb, con las dos fincas de prueba (P4).
 * Lo que fake-indexeddb no imita: ver almacen.test.ts.
 */
import { type Area, ErrorDeValidacion } from '@gestionagro/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { abrirCuaderno } from './db.ts';
import {
  agregarArea,
  crearFincaConAreas,
  crearSubarea,
  editarArea,
  historialDe,
  leerFinca,
} from './finca.ts';

const nuevaDb = () => abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });

const campos = (e: unknown) =>
  e instanceof ErrorDeValidacion ? e.campos.map((c) => c.campo) : ['(no es ErrorDeValidacion)'];

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  const datosFinca = {
    nombre: f.finca.nombre,
    municipio: f.finca.municipio,
    regimen: f.finca.regimen,
  };
  const datosAreas = f.areas.map((a) => ({
    tipo: a.tipo,
    nombre: a.nombre,
    area_m2: a.area_m2,
    capacidad_plantas: a.plantas,
  }));

  it('crea la finca con todas sus áreas y encola cada una', async () => {
    const db = nuevaDb();
    await crearFincaConAreas(db, datosFinca, datosAreas);
    const leida = await leerFinca(db);
    expect(leida?.finca).toMatchObject(datosFinca);
    expect(leida?.areas.map((a) => a.nombre)).toEqual(f.areas.map((a) => a.nombre));
    expect(await db.outbox.count()).toBe(1 + f.areas.length);
  });

  it('si un área es inválida no queda nada: ni la finca ni las otras áreas', async () => {
    const db = nuevaDb();
    const malas = [
      ...datosAreas,
      { ...datosAreas[0], nombre: 'Rota', area_m2: Number.NaN } as (typeof datosAreas)[number],
    ];
    const error = await crearFincaConAreas(db, datosFinca, malas).catch((e: unknown) => e);
    expect(campos(error)).toEqual(['area_m2']);
    expect(await db.finca.count()).toBe(0);
    expect(await db.area.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it('si IndexedDB falla al escribir las áreas, tampoco queda la finca (transacción)', async () => {
    const db = nuevaDb();
    // La validación previa pasa; la falla ocurre dentro de la escritura.
    db.area.hook('creating', () => {
      throw new Error('falla de escritura simulada');
    });
    await expect(crearFincaConAreas(db, datosFinca, datosAreas)).rejects.toThrow();
    expect(await db.finca.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it('editar un área crea una versión nueva y guarda la anterior en el historial', async () => {
    const db = nuevaDb();
    const { areas } = await crearFincaConAreas(db, datosFinca, datosAreas);
    const original = areas[0] as Area;
    const editada = await editarArea(db, original.id, { area_m2: original.area_m2 + 10 });
    expect(editada.version).toBe(2);
    expect((await db.area.get(original.id))?.area_m2).toBe(original.area_m2 + 10);
    const historial = await historialDe(db, original.id);
    expect(historial).toHaveLength(1);
    expect(historial[0]).toMatchObject({ version: 1, datos: { area_m2: original.area_m2 } });
    expect(await db.outbox.get(`${original.id}@v2`)).toMatchObject({
      op: 'actualizar',
      version: 2,
    });
  });

  it('una edición inválida no toca el área ni el historial', async () => {
    const db = nuevaDb();
    const { areas } = await crearFincaConAreas(db, datosFinca, datosAreas);
    const original = areas[0] as Area;
    const error = await editarArea(db, original.id, { nombre: '   ' }).catch((e: unknown) => e);
    expect(campos(error)).toEqual(['nombre']);
    expect(await db.area.get(original.id)).toEqual(original);
    expect(await historialDe(db, original.id)).toEqual([]);
  });

  it('una subárea (cama) cuelga de un área principal', async () => {
    const db = nuevaDb();
    const { areas } = await crearFincaConAreas(db, datosFinca, datosAreas);
    const padre = areas[0] as Area;
    const cama = await crearSubarea(db, padre.id, {
      tipo: 'cama',
      nombre: 'Cama 1',
      area_m2: 30,
      capacidad_plantas: null,
    });
    expect(cama).toMatchObject({ padre_id: padre.id, finca_id: padre.finca_id, tipo: 'cama' });
  });
});

describe('reglas de la configuración (HU-E3.3)', () => {
  const finca = {
    nombre: 'Finca Ensayo Uno',
    municipio: 'Municipio Ensayo A',
    regimen: 'ecologico' as const,
  };
  const nave = { tipo: 'nave' as const, nombre: 'Nave 1', area_m2: 500, capacidad_plantas: null };

  it.each([
    ['nombre vacío', { ...finca, nombre: '' }, 'nombre'],
    ['municipio vacío', { ...finca, municipio: '  ' }, 'municipio'],
  ])('%s no se guarda y nombra el campo (CA2)', async (_caso, datos, campo) => {
    const db = nuevaDb();
    expect(campos(await crearFincaConAreas(db, datos, [nave]).catch((e: unknown) => e))).toEqual([
      campo,
    ]);
  });

  it('sin áreas no se guarda', async () => {
    expect(campos(await crearFincaConAreas(nuevaDb(), finca, []).catch((e: unknown) => e))).toEqual(
      ['areas'],
    );
  });

  it('una cama no puede ser área principal, y una nave no puede ser subárea', async () => {
    const db = nuevaDb();
    const cama = { ...nave, tipo: 'cama' as const };
    expect(campos(await crearFincaConAreas(db, finca, [cama]).catch((e: unknown) => e))).toEqual([
      'areas.0.tipo',
    ]);
    const { areas } = await crearFincaConAreas(db, finca, [nave]);
    expect(
      campos(await crearSubarea(db, (areas[0] as Area).id, nave).catch((e: unknown) => e)),
    ).toEqual(['tipo']);
  });

  it('una subárea de una subárea no se permite', async () => {
    const db = nuevaDb();
    const { areas } = await crearFincaConAreas(db, finca, [nave]);
    const cama = await crearSubarea(db, (areas[0] as Area).id, {
      ...nave,
      tipo: 'cama',
      nombre: 'Cama 1',
    });
    const error = await crearSubarea(db, cama.id, {
      ...nave,
      tipo: 'surco',
      nombre: 'Surco 1',
    }).catch((e: unknown) => e);
    expect(campos(error)).toEqual(['padre_id']);
  });
});

describe('agregar áreas después del registro inicial (revisión del dueño)', () => {
  const finca = {
    nombre: 'Finca Ensayo Dos',
    municipio: 'Municipio Ensayo B',
    regimen: 'convencional' as const,
  };

  it('agrega un área de otro tipo y la encola', async () => {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca: creada } = await crearFincaConAreas(db, finca, [
      { tipo: 'bloque', nombre: 'Bloque A', area_m2: 2000, capacidad_plantas: null },
    ]);
    const lote = await agregarArea(db, creada.id, {
      tipo: 'lote',
      nombre: 'Lote 1',
      area_m2: 5000,
      capacidad_plantas: null,
    });
    expect(lote).toMatchObject({ finca_id: creada.id, padre_id: null, tipo: 'lote', version: 1 });
    expect((await leerFinca(db))?.areas.map((a) => a.nombre)).toEqual(['Bloque A', 'Lote 1']);
    expect(await db.outbox.get(`${lote.id}@v1`)).toMatchObject({ op: 'crear' });
  });

  it('una cama no se agrega como área principal', async () => {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca: creada } = await crearFincaConAreas(db, finca, [
      { tipo: 'bloque', nombre: 'Bloque A', area_m2: 2000, capacidad_plantas: null },
    ]);
    const error = await agregarArea(db, creada.id, {
      tipo: 'cama',
      nombre: 'Cama',
      area_m2: 20,
      capacidad_plantas: null,
    }).catch((e: unknown) => e);
    expect(campos(error)).toEqual(['tipo']);
  });
});
