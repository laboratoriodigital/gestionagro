/**
 * Eliminar un área (revisión del dueño, 3 oct 2026): solo sin nada asociado, y como baja que viaja
 * a los demás teléfonos, no como borrado (P21). Sobre fake-indexeddb, con las dos fincas (P4).
 */
import { ErrorDeValidacion } from '@gestionagro/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { agregarCultivo, agregarVariedad, iniciarCiclo } from './ciclos.ts';
import { guardarClima } from './clima.ts';
import { abrirCuaderno } from './db.ts';
import {
  agregarArea,
  crearFincaConAreas,
  crearSubarea,
  eliminarArea,
  motivoParaNoEliminar,
} from './finca.ts';

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_n, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      [{ tipo: 'nave', nombre: 'Nave 1', area_m2: 500, capacidad_plantas: null }],
    );
    const nueva = await agregarArea(db, finca.id, {
      tipo: 'nave',
      nombre: 'Nave nueva',
      area_m2: 300,
      capacidad_plantas: null,
    });
    return { db, finca, nueva };
  }

  it('un área nueva sin nada asociado se elimina: queda inactiva y su cambio va a la cola', async () => {
    const { db, nueva } = await preparar();
    expect(await motivoParaNoEliminar(db, nueva.id)).toBeNull();
    const baja = await eliminarArea(db, nueva.id);
    expect(baja).toMatchObject({ id: nueva.id, activa: false, version: 2 });
    expect(await db.area.get(nueva.id)).toMatchObject({ activa: false });
    // No se borra: el cambio sube como cualquier otro y la versión anterior queda en el historial.
    expect(await db.outbox.filter((o) => o.id.startsWith(nueva.id)).count()).toBeGreaterThan(0);
    expect(await db.historial.where('entidad_id').equals(nueva.id).count()).toBe(1);
  });

  it.each([
    ['con un registro', 'tiene 1 registro'],
    ['con un ciclo', 'tiene un ciclo de cultivo'],
    ['con una cama', 'tiene 1 cama o surco'],
  ])('%s no se elimina y dice por qué', async (caso, motivo) => {
    const { db, finca, nueva } = await preparar();
    if (caso === 'con un registro') {
      await guardarClima(db, finca.id, nueva.id, {
        temperaturaC: 22,
        humedadRelativaPct: 70,
        temperaturaHojaC: null,
      });
    } else if (caso === 'con un ciclo') {
      const tomate = await agregarCultivo(db, finca.id, 'Tomate');
      await agregarVariedad(db, tomate.id, 'Ensayo');
      await iniciarCiclo(db, {
        fincaId: finca.id,
        areaId: nueva.id,
        cultivo: 'Tomate',
        variedad: 'Ensayo',
        fechaTrasplante: '2026-01-10',
        plantas: null,
      });
    } else {
      await crearSubarea(db, nueva.id, {
        tipo: 'cama',
        nombre: 'Cama 1',
        area_m2: 20,
        capacidad_plantas: null,
      });
    }
    expect(await motivoParaNoEliminar(db, nueva.id)).toContain(motivo);
    await expect(eliminarArea(db, nueva.id)).rejects.toBeInstanceOf(ErrorDeValidacion);
    expect(await db.area.get(nueva.id)).toMatchObject({ activa: true });
  });
});
