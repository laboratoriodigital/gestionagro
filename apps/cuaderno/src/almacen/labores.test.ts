/**
 * Labores (HU-E3.9) sobre fake-indexeddb, con las dos fincas de prueba (P4).
 */
import { ErrorDeRegistro, ErrorDeValidacion } from '@ed1/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas } from './finca.ts';
import { guardarLabor, horasDelDia, laboresRecientes, leerTiposLabor } from './labores.ts';
import { crearPersona } from './personas.ts';

const HOY = new Date('2027-01-15T15:00:00Z');
const ahora = () => HOY;
const campos = (e: unknown) =>
  e instanceof ErrorDeValidacion ? e.campos.map((c) => c.campo) : [`(otro: ${String(e)})`];

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      f.areas.map((a) => ({
        tipo: a.tipo,
        nombre: a.nombre,
        area_m2: a.area_m2,
        capacidad_plantas: null,
      })),
    );
    const personas = [];
    for (const p of f.personas)
      personas.push(await crearPersona(db, finca.id, { nombre: p.nombre, rol: p.rol }));
    const area = areas[0];
    if (!area) throw new Error('sin áreas');
    return { db, finca, area, ids: personas.map((p) => p.id) };
  }

  it('CA1 y CA2: guarda la labor con varias personas en modo tablero, y la labor entra al catálogo', async () => {
    const { db, finca, area, ids } = await preparar();
    const r = await guardarLabor(
      db,
      finca.id,
      { areaId: area.id, labor: 'Deshoje', personaIds: ids, horasPorPersona: 1.5 },
      { ahora },
    );
    expect(r).toMatchObject({
      tipo: 'labor',
      origen: 'tablero',
      persona_ids: ids,
      area_ids: [area.id],
    });
    expect(r.datos).toMatchObject({ labor: 'Deshoje', horasPorPersona: 1.5 });
    await guardarLabor(
      db,
      finca.id,
      { areaId: area.id, labor: ' deshoje ', personaIds: ids, horasPorPersona: 1 },
      { ahora },
    );
    expect((await leerTiposLabor(db, finca.id)).map((t) => t.nombre)).toEqual(['Deshoje']);
  });

  it('CA3: medias horas sí, 1,3 no', async () => {
    const { db, finca, area, ids } = await preparar();
    const error = await guardarLabor(
      db,
      finca.id,
      { areaId: area.id, labor: 'Poda', personaIds: ids, horasPorPersona: 1.3 },
      { ahora },
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDeRegistro);
    expect(campos(error)).toEqual(['datos.horasPorPersona']);
  });

  it('CA3: más de 12 h de una persona en el día avisa y pide confirmar; confirmado, guarda', async () => {
    const { db, finca, area, ids } = await preparar();
    const una = [ids[0] ?? ''];
    await guardarLabor(
      db,
      finca.id,
      { areaId: area.id, labor: 'Tutorado', personaIds: una, horasPorPersona: 8 },
      { ahora },
    );
    const error = await guardarLabor(
      db,
      finca.id,
      { areaId: area.id, labor: 'Poda', personaIds: una, horasPorPersona: 5 },
      { ahora },
    ).catch((e: unknown) => e);
    expect(campos(error)).toEqual(['horasPorPersona']);
    expect(String((error as Error).message)).toContain('sumaría 13 horas hoy');
    await guardarLabor(
      db,
      finca.id,
      {
        areaId: area.id,
        labor: 'Poda',
        personaIds: una,
        horasPorPersona: 5,
        confirmarMasDe12: true,
      },
      { ahora },
    );
    expect(await horasDelDia(db, finca.id, una[0] ?? '', '2027-01-15')).toBe(13);
  });

  it('sin personas o sin labor no se guarda', async () => {
    const { db, finca, area } = await preparar();
    expect(
      campos(
        await guardarLabor(db, finca.id, {
          areaId: area.id,
          labor: 'Poda',
          personaIds: [],
          horasPorPersona: 1,
        }).catch((e: unknown) => e),
      ),
    ).toEqual(['persona_ids']);
  });

  it('CA4: las 3 labores más recientes, sin repetir y de la más nueva a la más vieja', async () => {
    const { db, finca, area, ids } = await preparar();
    const una = [ids[0] ?? ''];
    let minuto = 0;
    const en = () => new Date(HOY.getTime() + minuto++ * 60_000);
    for (const labor of ['Tutorado', 'Poda', 'Deshoje', 'Limpieza', 'Deshoje']) {
      await guardarLabor(
        db,
        finca.id,
        { areaId: area.id, labor, personaIds: una, horasPorPersona: 0.5 },
        { ahora: en },
      );
    }
    expect(await laboresRecientes(db, finca.id)).toEqual(['Deshoje', 'Limpieza', 'Poda']);
  });
});
