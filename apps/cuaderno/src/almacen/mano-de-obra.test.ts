/**
 * Mano de obra por nave y periodo (HU-E7.2) sobre fake-indexeddb, con las dos fincas de prueba.
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas } from './finca.ts';
import { guardarLabor } from './labores.ts';
import { manoDeObraPorArea } from './mano-de-obra.ts';
import { crearPersona, definirJornal, definirJornalGeneral } from './personas.ts';

/** Mediodía en Bogotá de ese día. */
const el = (fecha: string) => () => new Date(`${fecha}T17:00:00Z`);

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_n, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      [
        { tipo: 'nave', nombre: 'Nave 1', area_m2: 500, capacidad_plantas: null },
        { tipo: 'nave', nombre: 'Nave 2', area_m2: 500, capacidad_plantas: null },
      ],
    );
    const [n1, n2] = areas;
    if (!n1 || !n2) throw new Error('faltan áreas');
    const ana = await crearPersona(db, finca.id, { nombre: 'Persona Ensayo Uno', rol: 'operario' });
    const beto = await crearPersona(db, finca.id, {
      nombre: 'Persona Ensayo Dos',
      rol: 'operario',
    });
    const labor = (areaId: string, personaIds: string[], horas: number, fecha: string) =>
      guardarLabor(
        db,
        finca.id,
        { areaId, labor: 'Deshoje', personaIds, horasPorPersona: horas },
        { ahora: el(fecha) },
      );
    return { db, finca, n1, n2, ana, beto, labor };
  }

  it('CA1 y CA2: jornal propio o el general, el que regía ese día; un cambio no toca lo pasado', async () => {
    const { db, finca, n1, n2, ana, beto, labor } = await preparar();
    await definirJornal(db, ana.id, 64_000, '2026-01-01');
    await definirJornalGeneral(db, finca.id, 60_000, '2026-09-01');
    await labor(n1.id, [ana.id, beto.id], 8, '2026-09-10'); // 64.000 + 60.000
    await labor(n2.id, [ana.id], 4, '2026-09-11'); // 32.000
    // Sube el jornal de la persona: lo de septiembre no cambia.
    await definirJornal(db, ana.id, 72_000, '2026-10-01');
    await labor(n2.id, [ana.id], 4, '2026-10-02'); // 36.000
    const todo = await manoDeObraPorArea(db, finca.id, { desde: null, hasta: null });
    expect(todo.map((r) => [r.areaId, r.horas, r.costo, r.sinValor]).sort()).toEqual(
      [
        [n1.id, 16, 124_000, 0],
        [n2.id, 8, 68_000, 0],
      ].sort(),
    );
    const septiembre = await manoDeObraPorArea(db, finca.id, {
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
    expect(septiembre.find((r) => r.areaId === n2.id)?.costo).toBe(32_000);
  });

  it('sin un valor que rigiera ese día, no suma 0: lo cuenta para decirlo', async () => {
    const { db, finca, n1, beto, labor } = await preparar();
    await definirJornalGeneral(db, finca.id, 60_000, '2026-09-01');
    await labor(n1.id, [beto.id], 8, '2026-08-20'); // antes del valor general
    const [fila] = await manoDeObraPorArea(db, finca.id, { desde: null, hasta: null });
    expect(fila).toMatchObject({ horas: 8, costo: 0, sinValor: 1 });
  });
});
