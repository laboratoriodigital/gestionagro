/**
 * Rendimiento por operario (HU-E7.4) sobre fake-indexeddb, con las dos fincas de prueba (P4).
 */
import { ErrorDeValidacion } from '@gestionagro/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { guardarCosecha } from './cosecha.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas } from './finca.ts';
import { guardarLabor } from './labores.ts';
import { periodoDe } from './periodos.ts';
import { crearPersona } from './personas.ts';
import { rendimientoDelEquipo } from './rendimiento-operario.ts';

const el = (fecha: string) => () => new Date(`${fecha}T17:00:00Z`);
const TODO = { desde: null, hasta: null };

describe('periodos de los reportes (P8)', () => {
  it.each([
    ['mes', '2026-10-02', { desde: '2026-10-01', hasta: '2026-10-02' }],
    ['mes-pasado', '2026-10-02', { desde: '2026-09-01', hasta: '2026-09-30' }],
    ['mes-pasado', '2027-01-15', { desde: '2026-12-01', hasta: '2026-12-31' }],
    ['mes-pasado', '2028-03-10', { desde: '2028-02-01', hasta: '2028-02-29' }],
    ['todo', '2026-10-02', { desde: null, hasta: null }],
  ] as const)('%s desde %s', (clave, hoy, esperado) => {
    expect(periodoDe(clave, hoy)).toEqual(esperado);
  });
});

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_n, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      [{ tipo: 'nave', nombre: 'Nave 1', area_m2: 500, capacidad_plantas: null }],
    );
    const [nave] = areas;
    if (!nave) throw new Error('falta el área');
    const ana = await crearPersona(db, finca.id, { nombre: 'Persona Ensayo Uno', rol: 'operario' });
    const beto = await crearPersona(db, finca.id, {
      nombre: 'Persona Ensayo Dos',
      rol: 'operario',
    });
    const cosechar = (
      personaIds: string[],
      cantidad: number,
      horasPorPersona: number | null,
      fecha: string,
    ) =>
      guardarCosecha(
        db,
        finca.id,
        {
          areaId: nave.id,
          cantidad,
          unidad: 'kg',
          categoria: 'Primera',
          descarte: null,
          personaIds,
          horasPorPersona,
        },
        { ahora: el(fecha) },
      );
    return { db, finca, nave, ana, beto, cosechar };
  }

  it('CA1: kg por hora de cada persona en el periodo, con las horas de cosecha anotadas', async () => {
    const { db, finca, nave, ana, beto, cosechar } = await preparar();
    await cosechar([ana.id], 60, 4, '2026-09-10');
    await cosechar([ana.id, beto.id], 100, 4, '2026-09-11'); // 50 kg cada uno
    await cosechar([beto.id], 30, 2, '2026-10-01'); // otro mes
    await guardarLabor(
      db,
      finca.id,
      { areaId: nave.id, labor: 'Deshoje', personaIds: [beto.id], horasPorPersona: 3 },
      { ahora: el('2026-09-12') },
    );
    const septiembre = await rendimientoDelEquipo(db, finca.id, {
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
    expect(
      septiembre.personas.map((p) => [
        p.nombre,
        p.cosecha.map((c) => [c.unidad, c.cantidad, c.horas, c.porHora]),
        p.horasLabor,
      ]),
    ).toEqual([
      ['Persona Ensayo Dos', [['kg', 50, 4, 12.5]], 3],
      ['Persona Ensayo Uno', [['kg', 110, 8, 13.75]], 0],
    ]);
    const todo = await rendimientoDelEquipo(db, finca.id, TODO);
    expect(todo.personas.find((p) => p.personaId === beto.id)?.cosecha[0]?.porHora).toBe(13.33);
  });

  it('CA3: las cosechas sin horas o sin quién cosechó no entran y se cuentan (P1)', async () => {
    const { db, finca, ana, cosechar } = await preparar();
    await cosechar([ana.id], 60, 4, '2026-09-10');
    await cosechar([ana.id], 500, null, '2026-09-11');
    await cosechar([], 40, null, '2026-09-12');
    const r = await rendimientoDelEquipo(db, finca.id, TODO);
    expect(r).toMatchObject({ cosechasSinHoras: 1, cosechasSinPersona: 1 });
    expect(r.personas[0]?.cosecha[0]).toMatchObject({ cantidad: 60, porHora: 15, sinHoras: 1 });
  });

  it('las horas sin quién cosechó no se guardan: no serían de nadie', async () => {
    const { cosechar } = await preparar();
    await expect(cosechar([], 40, 3, '2026-09-12')).rejects.toBeInstanceOf(ErrorDeValidacion);
  });
});
