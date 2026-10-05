/**
 * Bodega y costo de los insumos aplicados (HU-E7.1) sobre fake-indexeddb, con las dos fincas de
 * prueba (P4).
 */
import { ErrorDeValidacion } from '@ed1/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import {
  cantidadSugerida,
  type DatosAplicacionGuardada,
  guardarAplicacion,
  repartirPorArea,
} from './aplicaciones.ts';
import { costoDeInsumosPorArea, estadoDeBodega, registrarMovimiento } from './bodega.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas } from './finca.ts';
import { crearInsumo } from './insumos.ts';
import { crearPersona } from './personas.ts';

const ETIQUETA = {
  tipo: 'fitosanitario',
  registro_ica: null,
  ingrediente_activo: null,
  unidad: 'mL',
  carencia_dias: 3,
  reentrada_horas: 4,
  permitido_ecologico: null,
} as const;
const en = (iso: string) => () => new Date(iso);

describe('la cantidad usada de una aplicación', () => {
  it('se sugiere por dosis × litros solo si la dosis va por litro en la unidad del insumo', () => {
    expect(cantidadSugerida(2, 'mL/L', 20, 'mL')).toBe(40);
    expect(cantidadSugerida(2, 'mL por litro', 20, 'mL')).toBe(40);
    expect(cantidadSugerida(1.5, 'g / L', 10, 'g')).toBe(15);
    expect(cantidadSugerida(2, 'cm³ por litro', 20, 'mL')).toBeNull(); // otra unidad: no adivina
    expect(cantidadSugerida(2, 'mL/L', null, 'mL')).toBeNull();
  });

  it('con varias áreas se reparte por sus m², y la suma es el total', () => {
    expect(repartirPorArea(100, [500, 300, 200])).toEqual([50, 30, 20]);
    const partes = repartirPorArea(10, [1, 1, 1]);
    expect(partes.reduce((a, b) => a + b, 0)).toBeCloseTo(10);
  });
});

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_n, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      [
        { tipo: 'nave', nombre: 'Nave 1', area_m2: 600, capacidad_plantas: null },
        { tipo: 'nave', nombre: 'Nave 2', area_m2: 400, capacidad_plantas: null },
      ],
    );
    const [n1, n2] = areas;
    if (!n1 || !n2) throw new Error('faltan áreas');
    const insumo = await crearInsumo(db, finca.id, {
      ...ETIQUETA,
      nombre_comercial: 'Producto Ensayo',
    });
    const persona = await crearPersona(db, finca.id, { nombre: 'Persona Ensayo', rol: 'operario' });
    const aplicar = (areaIds: string[], cantidadUsada: number | null, cuando: string) =>
      guardarAplicacion(
        db,
        finca.id,
        areaIds,
        {
          insumoId: insumo.id,
          dosis: 2,
          dosisUnidad: 'mL/L',
          volumenMezclaL: 20,
          equipo: null,
          personaIds: [persona.id],
          cantidadUsada,
        },
        { ahora: en(cuando) },
      );
    return { db, finca, n1, n2, insumo, aplicar };
  }

  it('CA1 y CA2: la compra entra, la aplicación sale, y el costo es el promedio ponderado', async () => {
    const { db, finca, n1, n2, insumo, aplicar } = await preparar();
    await registrarMovimiento(
      db,
      finca.id,
      { insumoId: insumo.id, clase: 'compra', cantidad: 1000, precioTotal: 80_000, nota: '' },
      { ahora: en('2026-10-01T12:00:00Z') },
    );
    await registrarMovimiento(
      db,
      finca.id,
      { insumoId: insumo.id, clase: 'compra', cantidad: 1000, precioTotal: 100_000, nota: '' },
      { ahora: en('2026-10-02T12:00:00Z') },
    );
    // 100 mL en las dos naves: 60 a la de 600 m² y 40 a la de 400 m².
    const registros = await aplicar([n1.id, n2.id], 100, '2026-10-03T12:00:00Z');
    expect(registros.map((r) => (r.datos as DatosAplicacionGuardada).cantidadUsada)).toEqual([
      60, 40,
    ]);
    expect(registros[0]?.v).toBe(2);
    const [existencia] = await estadoDeBodega(db, finca.id);
    expect(existencia).toMatchObject({
      insumo: 'Producto Ensayo',
      unidad: 'mL',
      existencia: 1900,
      costoUnitario: 90,
      valor: 171_000,
      quedoNegativa: false,
      sinCantidad: 0,
    });
    const costos = await costoDeInsumosPorArea(db, finca.id);
    expect(costos.map((c) => [c.areaId, c.costo, c.sinCosto]).sort()).toEqual(
      [
        [n1.id, 5400, 0],
        [n2.id, 3600, 0],
      ].sort(),
    );
  });

  it('CA3: gastar más de lo que hay avisa sin bloquear el registro de campo', async () => {
    const { db, finca, n1, aplicar } = await preparar();
    await aplicar([n1.id], 50, '2026-10-03T12:00:00Z');
    const [existencia] = await estadoDeBodega(db, finca.id);
    expect(existencia).toMatchObject({
      existencia: -50,
      quedoNegativa: true,
      costoUnitario: null,
      valor: null,
    });
    const [costo] = await costoDeInsumosPorArea(db, finca.id);
    expect(costo).toMatchObject({ aplicaciones: 1, sinCosto: 1, costo: 0 });
  });

  it('una aplicación sin cantidad no descuenta y se cuenta para decirlo', async () => {
    const { db, finca, n1, insumo, aplicar } = await preparar();
    await registrarMovimiento(db, finca.id, {
      insumoId: insumo.id,
      clase: 'compra',
      cantidad: 500,
      precioTotal: null,
      nota: '',
    });
    await aplicar([n1.id], null, '2026-10-03T12:00:00Z');
    const [existencia] = await estadoDeBodega(db, finca.id);
    expect(existencia).toMatchObject({ existencia: 500, sinCantidad: 1, costoUnitario: null });
  });

  it('un ajuste por conteo y los motivos de lo que no se puede guardar', async () => {
    const { db, finca, insumo } = await preparar();
    await registrarMovimiento(db, finca.id, {
      insumoId: insumo.id,
      clase: 'compra',
      cantidad: 100,
      precioTotal: 5000,
      nota: '',
    });
    await registrarMovimiento(db, finca.id, {
      insumoId: insumo.id,
      clase: 'ajuste',
      cantidad: -10,
      precioTotal: null,
      nota: 'conteo',
    });
    expect((await estadoDeBodega(db, finca.id))[0]?.existencia).toBe(90);
    const e = await registrarMovimiento(db, finca.id, {
      insumoId: insumo.id,
      clase: 'compra',
      cantidad: -5,
      precioTotal: 0,
      nota: '',
    }).catch((x: unknown) => x);
    expect(e instanceof ErrorDeValidacion ? e.campos.map((c) => c.motivo) : e).toEqual([
      'una compra suma: escribe la cantidad sin signo',
      'el precio va en pesos enteros, mayor que 0',
    ]);
  });
});
