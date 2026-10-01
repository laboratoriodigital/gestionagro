/**
 * Registro de clima (HU-E3.8) sobre fake-indexeddb, con las dos fincas de prueba (P4).
 */
import { ErrorDeMedida } from '@gestionagro/agro-calc';
import casos from '@gestionagro/agro-calc/casos/dpv.json' with { type: 'json' };
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { agregarCultivo, agregarVariedad, iniciarCiclo } from './ciclos.ts';
import { guardarClima, pendientesDeSubir, recalcularDpv, ultimosClimas } from './clima.ts';
import { abrirCuaderno } from './db.ts';
import { idDispositivo } from './dispositivo.ts';
import { crearFincaConAreas } from './finca.ts';

const HOY = new Date('2027-01-15T15:00:00Z');
const ahora = () => HOY;

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
        capacidad_plantas: a.plantas,
      })),
    );
    const area = areas[0];
    if (!area) throw new Error('sin áreas');
    return { db, finca, area };
  }

  it('CA1: guarda T, HR, hoja y el DPV calculado con la fórmula única, y se puede recalcular', async () => {
    const { db, finca, area } = await preparar();
    for (const c of casos.aire) {
      const r = await guardarClima(
        db,
        finca.id,
        area.id,
        {
          temperaturaC: c.temperaturaC,
          humedadRelativaPct: c.humedadRelativaPct,
          temperaturaHojaC: null,
        },
        { ahora },
      );
      const datos = r.datos as { dpvKPa: number };
      expect(Math.abs(datos.dpvKPa - c.dpvKPa)).toBeLessThanOrEqual(
        casos.tolerancia_kPa / 2 + 1e-9,
      );
      expect(recalcularDpv(r)).toBe(datos.dpvKPa);
    }
  });

  it('va al ciclo activo del área, a la fecha agronómica de hoy y queda en la cola de salida', async () => {
    const { db, finca, area } = await preparar();
    const cultivo = await agregarCultivo(db, finca.id, f.cultivo.nombre, { ahora });
    await agregarVariedad(db, cultivo.id, f.cultivo.variedad, { ahora });
    const ciclo = await iniciarCiclo(
      db,
      {
        fincaId: finca.id,
        areaId: area.id,
        cultivo: f.cultivo.nombre,
        variedad: f.cultivo.variedad,
        fechaTrasplante: '2026-10-15',
        plantas: null,
      },
      { ahora },
    );
    const r = await guardarClima(
      db,
      finca.id,
      area.id,
      { temperaturaC: 24, humedadRelativaPct: 70, temperaturaHojaC: 23 },
      { ahora },
    );
    expect(r).toMatchObject({
      ciclo_id: ciclo.id,
      area_ids: [area.id],
      fecha_agronomica: '2027-01-15',
      origen: 'manual',
    });
    expect((await pendientesDeSubir(db)).has(r.id)).toBe(true);
    expect((await ultimosClimas(db, finca.id)).map((x) => x.id)).toEqual([r.id]);
  });

  it('una medida fuera de rango no se guarda y nombra el campo (P1)', async () => {
    const { db, finca, area } = await preparar();
    const error = await guardarClima(db, finca.id, area.id, {
      temperaturaC: 24,
      humedadRelativaPct: 120,
      temperaturaHojaC: null,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDeMedida);
    expect((error as ErrorDeMedida).campo).toBe('humedadRelativaPct');
    expect(await db.registro.count()).toBe(0);
  });
});

describe('id del teléfono', () => {
  it('se genera una vez y no cambia', async () => {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const primero = await idDispositivo(db);
    expect(await idDispositivo(db)).toBe(primero);
  });
});
