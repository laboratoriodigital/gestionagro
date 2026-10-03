/**
 * Disponibilidad para la Tienda (HU-E6.5): el CSV sale de los lotes y sus despachos, sobre
 * fake-indexeddb y con las dos fincas de prueba (P4).
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { agregarCultivo, agregarVariedad, iniciarCiclo } from './ciclos.ts';
import { guardarCosecha } from './cosecha.ts';
import { abrirCuaderno } from './db.ts';
import { registrarDespacho } from './despachos.ts';
import {
  celda,
  disponibilidadCsv,
  filasDeDisponibilidad,
  idDeProducto,
  lotesSinCultivo,
} from './disponibilidad.ts';
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
    // La cosecha toma el cultivo del ciclo de su área: sin ciclo, el lote no tiene producto.
    const cultivo = await agregarCultivo(db, finca.id, f.cultivo.nombre, { ahora: AYER });
    await agregarVariedad(db, cultivo.id, f.cultivo.variedad, { ahora: AYER });
    for (const a of [a1, a2]) {
      await iniciarCiclo(
        db,
        {
          fincaId: finca.id,
          areaId: a.id,
          cultivo: f.cultivo.nombre,
          variedad: f.cultivo.variedad,
          fechaTrasplante: '2026-12-01',
          plantas: null,
        },
        { ahora: AYER },
      );
    }
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
    // Las columnas de la pestaña «Catálogo» de la Tienda, en su orden visible.
    expect(cabecera).toEqual([
      'ID',
      'Nombre',
      'Categoría',
      'Formato',
      'Precio',
      'Precio antes',
      'Stock',
      'Umbral bajo',
      'Variantes',
      'Imágenes',
      'Descripción',
      'Destacado',
      'Activo',
      'Referencia',
    ]);
    // El segundo lote se despachó entero: no sale. Del primero quedan 32,5 kg: 32 unidades de 1 kg.
    expect(resto).toHaveLength(1);
    const [fila] = filasDeDisponibilidad(await leerLotes(db, finca.id), f.finca.nombre);
    const cultivo = f.cultivo.nombre;
    expect(fila).toMatchObject({
      Categoría: cultivo,
      Nombre: `${cultivo} (Primera)`,
      Formato: '1 kg',
      Precio: '',
      Stock: '32',
      Descripción: `Cosechado en ${f.finca.nombre} entre el 26/03/2027 y el 27/03/2027.`,
      Destacado: 'No',
      Activo: 'Sí',
      Referencia: (l1.datos as { codigo: string }).codigo,
    });
    expect(fila?.ID).toMatch(/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/); // la regla de la Tienda
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

  const lote = (
    cultivo: string | null,
    saldo: number,
    codigo = 'T-27MAR-1',
    categoria = 'Primera',
  ) =>
    ({
      registro: { datos: { cultivo } },
      codigo,
      unidad: 'kg',
      saldo,
      cosechas: [{ fecha: '2027-03-27', categoria }],
    }) as unknown as Lote;

  it('control negativo: un producto con fórmula no llega como fórmula al CSV', () => {
    const csv = disponibilidadCsv([lote('=1+1', 4)], 'Finca');
    expect(csv).toContain(",'=1+1,");
    expect(csv).not.toContain(',=1+1,');
  });

  it('suma los lotes del mismo cultivo y categoría; separa las categorías', () => {
    const productos = filasDeDisponibilidad(
      [
        lote('Tomate', 4.5),
        lote('Tomate', 3, 'T-28MAR-1'),
        lote('Tomate', 2, 'T-28MAR-2', 'Segunda'),
      ],
      'Finca',
    );
    expect(productos.map((p) => [p.ID, p.Stock, p.Referencia])).toEqual([
      ['tomate-primera', '7', 'T-27MAR-1 T-28MAR-1'],
      ['tomate-segunda', '2', 'T-28MAR-2'],
    ]);
  });

  it('el ID sigue la regla de la Tienda: sin tildes, minúsculas y guiones', () => {
    expect(idDeProducto('Pimentón Rojo', 'Primera y Segunda')).toBe(
      'pimenton-rojo-primera-y-segunda',
    );
    expect(idDeProducto('Ají  dulce!', 'Extra')).toBe('aji-dulce-extra');
  });

  it('muchos lotes: la referencia cabe en 60 letras y dice cuántos más', () => {
    const muchos = Array.from({ length: 12 }, (_x, i) => lote('Tomate', 1, `T-${10 + i}MAR-1`));
    const [fila] = filasDeDisponibilidad(muchos, 'Finca');
    expect(fila?.Referencia.length).toBeLessThanOrEqual(60);
    expect(fila?.Referencia).toMatch(/ y \d+ más$/);
    expect(fila?.Stock).toBe('12');
  });

  it('un lote sin cultivo no sale y se cuenta aparte; menos de una unidad tampoco (P1)', () => {
    const lotes = [lote(null, 5), lote('Tomate', 0.125)];
    expect(filasDeDisponibilidad(lotes, 'Finca')).toEqual([]);
    expect(lotesSinCultivo(lotes)).toBe(1);
  });
});
