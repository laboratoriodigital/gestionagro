/**
 * Costo por kilo y margen por ciclo (HU-E7.3) sobre fake-indexeddb, con las dos fincas de prueba
 * (P4): insumos, jornales, cosechas, un lote y sus despachos, como los anota la finca.
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { guardarAplicacion } from './aplicaciones.ts';
import { registrarMovimiento } from './bodega.ts';
import { agregarCultivo, agregarVariedad, iniciarCiclo } from './ciclos.ts';
import { guardarCosecha } from './cosecha.ts';
import { costoPorCiclo } from './costo-por-ciclo.ts';
import { abrirCuaderno } from './db.ts';
import { registrarDespacho } from './despachos.ts';
import { crearFincaConAreas } from './finca.ts';
import { crearInsumo } from './insumos.ts';
import { guardarLabor } from './labores.ts';
import { armarLote } from './lotes.ts';
import { crearPersona, definirJornalGeneral } from './personas.ts';

const en = (iso: string) => () => new Date(iso);

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
    const inicio = { ahora: en('2026-09-01T12:00:00Z') };
    const tomate = await agregarCultivo(db, finca.id, 'Tomate', inicio);
    await agregarVariedad(db, tomate.id, 'Chonto', inicio);
    await iniciarCiclo(
      db,
      {
        fincaId: finca.id,
        areaId: n1.id,
        cultivo: 'Tomate',
        variedad: 'Chonto',
        fechaTrasplante: '2026-09-01',
        plantas: null,
      },
      { ahora: en('2026-09-01T12:00:00Z') },
    );
    const insumo = await crearInsumo(db, finca.id, {
      tipo: 'fitosanitario',
      registro_ica: null,
      ingrediente_activo: null,
      unidad: 'mL',
      carencia_dias: 3,
      reentrada_horas: 4,
      permitido_ecologico: null,
      nombre_comercial: 'Producto Ensayo',
    });
    const persona = await crearPersona(db, finca.id, { nombre: 'Persona Ensayo', rol: 'operario' });
    await registrarMovimiento(
      db,
      finca.id,
      { insumoId: insumo.id, clase: 'compra', cantidad: 1000, precioTotal: 100_000, nota: '' },
      { ahora: en('2026-09-02T12:00:00Z') },
    );
    await definirJornalGeneral(db, finca.id, 64_000, '2026-09-01');
    const aplicar = (areaId: string, cantidadUsada: number | null) =>
      guardarAplicacion(
        db,
        finca.id,
        [areaId],
        {
          insumoId: insumo.id,
          dosis: 2,
          dosisUnidad: 'mL/L',
          volumenMezclaL: 20,
          equipo: null,
          personaIds: [persona.id],
          cantidadUsada,
        },
        { ahora: en('2026-09-03T12:00:00Z') },
      );
    const labor = (areaId: string, horas: number) =>
      guardarLabor(
        db,
        finca.id,
        { areaId, labor: 'Deshoje', personaIds: [persona.id], horasPorPersona: horas },
        { ahora: en('2026-09-10T17:00:00Z') },
      );
    const cosechar = (areaId: string, cantidad: number, descarte: number | null, unidad = 'kg') =>
      guardarCosecha(
        db,
        finca.id,
        { areaId, cantidad, unidad, categoria: 'Primera', descarte, personaIds: [] },
        { ahora: en('2026-10-01T15:00:00Z') },
      );
    const despachar = async (loteId: string, cantidad: number, precio: number | null) => {
      await registrarDespacho(
        db,
        finca.id,
        {
          cliente: { nombre: 'Cliente Ensayo', tipo: 'restaurante' },
          lineas: [{ loteId, cantidad }],
          precioUnitario: precio,
          medioPago: 'transferencia',
        },
        { ahora: en('2026-10-02T15:00:00Z') },
      );
    };
    return { db, finca, n1, n2, aplicar, labor, cosechar, despachar };
  }

  it('CA1 y CA2: costo por kilo vendible y margen del ciclo, con insumos, jornales y ventas', async () => {
    const { db, finca, n1, aplicar, labor, cosechar, despachar } = await preparar();
    await aplicar(n1.id, 100); // 100 mL a $100 = $10.000
    await labor(n1.id, 8); // un jornal: $64.000
    const c1 = await cosechar(n1.id, 100, 20); // 80 vendibles
    const c2 = await cosechar(n1.id, 20, null); // 20 vendibles
    const lote = await armarLote(db, finca.id, [c1.id, c2.id], {
      ahora: en('2026-10-01T16:00:00Z'),
    });
    await despachar(lote.id, 50, 3000); // $150.000
    const [fila] = await costoPorCiclo(db, finca.id);
    expect(fila).toMatchObject({
      areas: 'Nave 1',
      ciclo: { cultivo: 'Tomate', variedad: 'Chonto' },
      unidad: 'kg',
      vendible: 100,
      insumos: 10_000,
      manoDeObra: 64_000,
      ingresos: 150_000,
      ventas: 1,
      resultado: {
        costo: 74_000,
        costoCompleto: true,
        porUnidad: 740,
        margen: 76_000,
        margenCompleto: true,
      },
    });
  });

  it('lo desconocido no suma 0: aplicación sin cantidad, despacho sin precio y varias unidades (P1)', async () => {
    const { db, finca, n1, n2, aplicar, labor, cosechar, despachar } = await preparar();
    await aplicar(n1.id, null);
    await labor(n1.id, 4); // $32.000
    const c = await cosechar(n1.id, 40, null);
    const lote = await armarLote(db, finca.id, [c.id], { ahora: en('2026-10-01T16:00:00Z') });
    await despachar(lote.id, 10, null);
    // La nave 2 no tiene ciclo y cosecha en dos unidades.
    await labor(n2.id, 8);
    await cosechar(n2.id, 10, null);
    await cosechar(n2.id, 3, null, 'cajas');
    const filas = await costoPorCiclo(db, finca.id);
    const nave1 = filas.find((x) => x.areas === 'Nave 1');
    const nave2 = filas.find((x) => x.areas === 'Nave 2');
    expect(nave1).toMatchObject({
      insumosSinCosto: 1,
      ventas: 1,
      ventasSinPrecio: 1,
      ingresos: 0,
      resultado: {
        costo: 32_000,
        costoCompleto: false,
        porUnidad: 800,
        margen: -32_000,
        margenCompleto: false,
      },
    });
    expect(nave2).toMatchObject({
      ciclo: null,
      variasUnidades: true,
      unidad: null,
      resultado: { costo: 64_000, porUnidad: null, margen: null },
    });
  });
});
