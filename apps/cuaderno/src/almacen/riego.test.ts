/**
 * Registro de riego (HU-E3.7) sobre fake-indexeddb, con las dos fincas de prueba (P4).
 */
import { ErrorDeMedida } from '@gestionagro/agro-calc';
import { ErrorDeRegistro } from '@gestionagro/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { agregarCultivo, agregarVariedad, iniciarCiclo } from './ciclos.ts';
import { pendientesDeSubir, ultimosRegistros } from './consultas.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas } from './finca.ts';
import { type DatosRiego, type DatosRiegoGuardado, guardarRiego } from './riego.ts';

const HOY = new Date('2027-01-15T15:00:00Z');
const ahora = () => HOY;

const base: DatosRiego = {
  unidad: 'mL_gotero',
  volumenAplicado: 500,
  duracionMin: 12,
  volumenDrenado: 150,
  ceEntradaDsM: null,
  phEntrada: null,
  ceDrenajeDsM: null,
  phDrenaje: null,
};

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
    return { db, finca, areas };
  }

  it('CA1: guarda los volúmenes y el % de drenaje calculado', async () => {
    const { db, finca, areas } = await preparar();
    const [r] = await guardarRiego(db, finca.id, [areas[0]?.id ?? ''], base, { ahora });
    expect(r?.datos as DatosRiegoGuardado).toMatchObject({
      volumenAplicado: 500,
      volumenDrenado: 150,
      drenajePct: 30,
      duracionMin: 12,
    });
    expect(r?.v).toBe(2);
  });

  it('CA2: sin drenaje ni CE ni pH medidos, quedan como no medidos, no como 0', async () => {
    const { db, finca, areas } = await preparar();
    const [r] = await guardarRiego(
      db,
      finca.id,
      [areas[0]?.id ?? ''],
      { ...base, volumenDrenado: null },
      { ahora },
    );
    expect(r?.datos as DatosRiegoGuardado).toMatchObject({
      volumenDrenado: null,
      drenajePct: null,
      ceEntradaDsM: null,
      phEntrada: null,
    });
  });

  it.each([
    ['CE de entrada en 12', { ceEntradaDsM: 12 }, 'datos.ceEntradaDsM'],
    ['pH de drenaje en 2', { phDrenaje: 2 }, 'datos.phDrenaje'],
  ])('CA2: %s no se guarda y nombra el campo', async (_caso, cambio, campo) => {
    const { db, finca, areas } = await preparar();
    const error = await guardarRiego(
      db,
      finca.id,
      [areas[0]?.id ?? ''],
      { ...base, ...cambio },
      { ahora },
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDeRegistro);
    expect((error as ErrorDeRegistro).campos.map((c) => c.campo)).toEqual([campo]);
    expect(await db.registro.count()).toBe(0);
  });

  it('un drenaje mayor que lo aplicado no se guarda (P1)', async () => {
    const { db, finca, areas } = await preparar();
    const error = await guardarRiego(db, finca.id, [areas[0]?.id ?? ''], {
      ...base,
      volumenDrenado: 600,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDeMedida);
    expect((error as ErrorDeMedida).campo).toBe('volumenDrenado');
  });

  it('CA3: el mismo riego en todas las áreas, un registro por área con su ciclo activo', async () => {
    const { db, finca, areas } = await preparar();
    const primera = areas[0];
    if (!primera) throw new Error('sin áreas');
    const cultivo = await agregarCultivo(db, finca.id, f.cultivo.nombre, { ahora });
    await agregarVariedad(db, cultivo.id, f.cultivo.variedad, { ahora });
    const ciclo = await iniciarCiclo(
      db,
      {
        fincaId: finca.id,
        areaId: primera.id,
        cultivo: f.cultivo.nombre,
        variedad: f.cultivo.variedad,
        fechaTrasplante: '2026-10-15',
        plantas: null,
      },
      { ahora },
    );
    const guardados = await guardarRiego(
      db,
      finca.id,
      areas.map((a) => a.id),
      base,
      { ahora },
    );
    expect(guardados).toHaveLength(areas.length);
    expect(guardados.map((r) => r.area_ids[0])).toEqual(areas.map((a) => a.id));
    expect(guardados.find((r) => r.area_ids[0] === primera.id)?.ciclo_id).toBe(ciclo.id);
    expect(
      guardados.filter((r) => r.area_ids[0] !== primera.id).every((r) => r.ciclo_id === null),
    ).toBe(true);
    const pendientes = await pendientesDeSubir(db);
    expect(guardados.every((r) => pendientes.has(r.id))).toBe(true);
    expect(await ultimosRegistros(db, finca.id, ['riego'], 50)).toHaveLength(areas.length);
  });

  it('CA3: si IndexedDB falla con un área, no queda ninguno', async () => {
    const { db, finca, areas } = await preparar();
    let vistos = 0;
    db.registro.hook('creating', () => {
      vistos++;
      if (vistos === 2) throw new Error('falla de escritura simulada');
    });
    await expect(
      guardarRiego(
        db,
        finca.id,
        areas.map((a) => a.id),
        base,
        { ahora },
      ),
    ).rejects.toThrow();
    expect(await db.registro.count()).toBe(0);
    expect(await db.outbox.filter((o) => o.entidad === 'registro').count()).toBe(0);
  });
});
