/**
 * Disponibilidad para la Tienda (HU-E6.5): el CSV sale de los lotes y sus despachos, sobre
 * fake-indexeddb y con las dos fincas de prueba (P4).
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { guardarCosecha } from './cosecha.ts';
import { abrirCuaderno } from './db.ts';
import { registrarDespacho } from './despachos.ts';
import { celda, disponibilidadCsv, filasDeDisponibilidad } from './disponibilidad.ts';
import { crearFincaConAreas } from './finca.ts';
import { armarLote, type Lote, leerLotes } from './lotes.ts';

const HOY = () => new Date('2027-03-27T15:00:00Z');
const AYER = () => new Date('2027-03-26T15:00:00Z');

/** Lee el CSV como lo haría una hoja: sin BOM, por filas y por comas (sin comillas en estas). */
const filas = (csv: string) =>
  csv
    .replace(/^﻿/, '')
    .trimEnd()
    .split('\r\n')
    .map((f) => f.split(','));

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      f.areas.slice(0, 2).map((x) => ({
        tipo: x.tipo,
        nombre: x.nombre,
        area_m2: x.area_m2,
        capacidad_plantas: null,
      })),
    );
    const [a1, a2] = areas;
    if (!a1 || !a2) throw new Error('faltan áreas');
    const cosecha = (areaId: string, cantidad: number, categoria: string, ahora = HOY) =>
      guardarCosecha(
        db,
        finca.id,
        { areaId, cantidad, unidad: 'kg', categoria, descarte: null, personaIds: [] },
        { ahora },
      );
    return { db, finca, a1, a2, cosecha };
  }

  it('CA1: una fila por lote con saldo: cosechado menos despachado, con lote y fechas', async () => {
    const { db, finca, a1, a2, cosecha } = await preparar();
    const c1 = await cosecha(a1.id, 30, 'Primera', AYER);
    const c2 = await cosecha(a2.id, 12.5, 'Primera');
    const l1 = await armarLote(db, finca.id, [c1.id, c2.id], { ahora: HOY });
    const c3 = await cosecha(a1.id, 8, 'Segunda');
    const l2 = await armarLote(db, finca.id, [c3.id], { ahora: HOY });
    await registrarDespacho(
      db,
      finca.id,
      {
        cliente: { nombre: 'Cliente Ensayo', tipo: 'restaurante' },
        lineas: [
          { loteId: l1.id, cantidad: 10 },
          { loteId: l2.id, cantidad: 8 },
        ],
        precioUnitario: 3500,
        medioPago: 'transferencia',
      },
      { ahora: HOY },
    );
    const csv = disponibilidadCsv(await leerLotes(db, finca.id), f.finca.nombre);
    expect(csv.startsWith('﻿')).toBe(true);
    const [cabecera, ...resto] = filas(csv);
    expect(cabecera).toEqual([
      'producto',
      'categoria',
      'disponible',
      'unidad',
      'lote',
      'cosechado_desde',
      'cosechado_hasta',
      'finca',
    ]);
    // El segundo lote se despachó entero: no sale.
    expect(resto).toHaveLength(1);
    expect(resto[0]?.slice(1, 7)).toEqual([
      'Primera',
      '32.5',
      'kg',
      (l1.datos as { codigo: string }).codigo,
      '2027-03-26',
      '2027-03-27',
    ]);
    expect(resto[0]?.[7]).toBe(f.finca.nombre);
  });

  it('sin lotes con saldo, solo la cabecera', async () => {
    const { db, finca } = await preparar();
    expect(filas(disponibilidadCsv(await leerLotes(db, finca.id), f.finca.nombre))).toHaveLength(1);
  });
});

describe('celdas seguras para la hoja', () => {
  it.each([
    ['Tomate', 'Tomate'],
    ['Primera y Segunda', 'Primera y Segunda'],
    ['Finca, la de arriba', '"Finca, la de arriba"'],
    ['Lote "especial"', '"Lote ""especial"""'],
    ['=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
    ['+57 300', "'+57 300"],
    ['-5', "'-5"],
    ['@usuario', "'@usuario"],
  ])('%s → %s', (valor, esperado) => {
    expect(celda(valor)).toBe(esperado);
  });

  it('control negativo: un nombre de finca con fórmula no llega como fórmula al CSV', () => {
    const lote = {
      registro: { datos: { cultivo: 'Tomate' } },
      codigo: 'T-27MAR-1',
      unidad: 'kg',
      saldo: 4,
      cosechas: [{ fecha: '2027-03-27', categoria: 'Primera' }],
    } as unknown as Lote;
    const csv = disponibilidadCsv([lote], '=1+1');
    expect(csv).toContain(",'=1+1\r\n");
    expect(csv).not.toContain(',=1+1');
    expect(filasDeDisponibilidad([lote], 'Finca')[0]?.producto).toBe('Tomate');
  });

  it('un lote sin cultivo deja el producto vacío; no lo inventa (P1)', () => {
    const lote = {
      registro: { datos: { cultivo: null } },
      codigo: 'X-27MAR-1',
      unidad: 'kg',
      saldo: 0.125,
      cosechas: [{ fecha: '2027-03-27', categoria: 'Primera' }],
    } as unknown as Lote;
    const [fila] = filas(disponibilidadCsv([lote], 'Finca')).slice(1);
    expect(fila?.[0]).toBe('');
    expect(fila?.[2]).toBe('0.125');
  });
});
