/**
 * Rendimiento por ciclo y área (HU-E6.6) sobre fake-indexeddb, con las dos fincas de prueba (P4).
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { agregarCultivo, agregarVariedad, iniciarCiclo } from './ciclos.ts';
import { guardarCosecha } from './cosecha.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas } from './finca.ts';
import { rendimientoDeLaFinca } from './rendimiento.ts';

const HOY = () => new Date('2027-03-27T15:00:00Z');

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_n, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      [
        { tipo: 'nave', nombre: 'Nave 1', area_m2: 500, capacidad_plantas: null },
        { tipo: 'nave', nombre: 'Nave 2', area_m2: 400, capacidad_plantas: null },
        { tipo: 'nave', nombre: 'Nave 3', area_m2: 300, capacidad_plantas: null },
      ],
    );
    const cultivo = await agregarCultivo(db, finca.id, f.cultivo.nombre, { ahora: HOY });
    await agregarVariedad(db, cultivo.id, f.cultivo.variedad, { ahora: HOY });
    const [n1, n2, n3] = areas;
    if (!n1 || !n2 || !n3) throw new Error('faltan áreas');
    const ciclo = (areaId: string, plantas: number | null) =>
      iniciarCiclo(
        db,
        {
          fincaId: finca.id,
          areaId,
          cultivo: f.cultivo.nombre,
          variedad: f.cultivo.variedad,
          fechaTrasplante: '2026-12-01',
          plantas,
        },
        { ahora: HOY },
      );
    const cosechar = (areaId: string, cantidad: number, descarte: number | null) =>
      guardarCosecha(
        db,
        finca.id,
        { areaId, cantidad, unidad: 'kg', categoria: 'Primera', descarte, personaIds: [] },
        { ahora: HOY },
      );
    return { db, finca, n1, n2, n3, ciclo, cosechar };
  }

  it('CA1 y CA2: compara naves del mismo cultivo por m² y por planta, la mejor primero', async () => {
    const { db, finca, n1, n2, n3, ciclo, cosechar } = await preparar();
    await ciclo(n1.id, 1000);
    await ciclo(n2.id, null);
    await cosechar(n1.id, 600, 100); // 500 comercial / 500 m² = 1 por m²; 0,5 por planta
    await cosechar(n1.id, 500, 0); // + 500 → 1.000 / 500 = 2
    await cosechar(n2.id, 1200, 0); // 1.200 / 400 = 3, sin plantas
    await cosechar(n3.id, 90, 0); // sin ciclo
    const grupos = await rendimientoDeLaFinca(db, finca.id);
    expect(grupos.map((g) => g.cultivo)).toEqual([f.cultivo.nombre, 'Sin ciclo']);
    const [cultivo, sinCiclo] = grupos;
    expect(
      cultivo?.filas.map((r) => [r.areas, r.cosechas, r.resultado.porM2, r.resultado.porPlanta]),
    ).toEqual([
      ['Nave 2', 1, 3, null],
      ['Nave 1', 2, 2, 1],
    ]);
    expect(cultivo?.filas[1]?.resultado.descartePct).toBeCloseTo((100 / 1100) * 100);
    expect(sinCiclo?.filas.map((r) => [r.areas, r.resultado.porM2, r.ciclo])).toEqual([
      ['Nave 3', 0.3, null],
    ]);
  });

  it('sin cosechas no hay filas', async () => {
    const { db, finca } = await preparar();
    expect(await rendimientoDeLaFinca(db, finca.id)).toEqual([]);
  });
});
