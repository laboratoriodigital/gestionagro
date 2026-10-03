/**
 * Calendario de carencias (HU-E9.1) sobre fake-indexeddb, con las dos fincas de prueba (P4), y
 * las pruebas de reloj del CA3: dos husos del teléfono, fin de mes y 29 de febrero (P8).
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { guardarAplicacion } from './aplicaciones.ts';
import { calendarioDeCarencias, DIAS_DEL_CALENDARIO, distintasDeSuNave } from './calendario.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas, crearSubarea } from './finca.ts';
import { crearInsumo } from './insumos.ts';
import { crearPersona } from './personas.ts';

const ETIQUETA = {
  tipo: 'fitosanitario',
  registro_ica: 'REG-ENSAYO-0099',
  ingrediente_activo: 'Sustancia de ensayo',
  unidad: 'mL',
  permitido_ecologico: null,
} as const;

const HUSOS = ['America/Bogota', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'] as const;

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      [
        { tipo: 'nave', nombre: 'Nave 1', area_m2: 500, capacidad_plantas: null },
        { tipo: 'nave', nombre: 'Nave 2', area_m2: 500, capacidad_plantas: null },
        { tipo: 'nave', nombre: 'Nave 3', area_m2: 500, capacidad_plantas: null },
      ],
    );
    const [n1, n2, n3] = areas;
    if (!n1 || !n2 || !n3) throw new Error('faltan áreas');
    const cama = await crearSubarea(db, n1.id, {
      tipo: 'cama',
      nombre: 'Cama 2',
      area_m2: 50,
      capacidad_plantas: null,
    });
    const p = f.personas[0];
    if (!p) throw new Error('sin personas');
    const persona = await crearPersona(db, finca.id, { nombre: p.nombre, rol: p.rol });
    const insumo = (nombre: string, carencia: number | null, reentrada: number | null) =>
      crearInsumo(db, finca.id, {
        ...ETIQUETA,
        nombre_comercial: nombre,
        carencia_dias: carencia,
        reentrada_horas: reentrada,
      });
    const aplicar = async (
      areaIds: string[],
      insumoId: string,
      instante: string,
    ): Promise<void> => {
      await guardarAplicacion(
        db,
        finca.id,
        areaIds,
        {
          insumoId,
          dosis: 2,
          dosisUnidad: 'cm³ por litro',
          volumenMezclaL: 20,
          equipo: 'Bomba de espalda',
          personaIds: [persona.id],
        },
        { ahora: () => new Date(instante) },
      );
    };
    const calendario = async (instante: string) =>
      calendarioDeCarencias(db, finca.id, [n1, n2, n3, cama], new Date(instante));
    return { n1, n2, n3, cama, insumo, aplicar, calendario };
  }

  it('CA1: hoy cada nave en verde, rojo con fecha y hora de fin, o gris si la carencia no se sabe', async () => {
    const { n1, n2, insumo, aplicar, calendario } = await preparar();
    const tres = await insumo('Producto Tres Días', 3, 4);
    const sinEtiqueta = await insumo('Producto Sin Etiqueta', null, 4);
    // 10/12 a las 9:30 en Bogotá.
    await aplicar([n1.id], tres.id, '2026-12-10T14:30:00Z');
    await aplicar([n2.id], sinEtiqueta.id, '2026-12-10T14:30:00Z');
    const filas = await calendario('2026-12-10T15:00:00Z');
    expect(filas.map((x) => [x.nombre, x.hoy.color])).toEqual([
      ['Nave 1', 'rojo'],
      ['Nave 1 › Cama 2', 'rojo'], // hereda lo aplicado en su nave
      ['Nave 2', 'gris'],
      ['Nave 3', 'verde'],
    ]);
    expect(filas[0]?.hoy).toMatchObject({
      carencia: 'No cosechar hasta el 13/12 (Producto Tres Días)',
      reentrada: 'Reentrada desde 10/12/2026 13:30 (Producto Tres Días)',
    });
    expect(filas[0]?.dias[0]?.entrarDesde).toBe('13:30');
    expect(filas[3]?.hoy).toEqual({ color: 'verde', carencia: null, reentrada: null });
  });

  it('una cama igual a su nave no se repite; una distinta sí (revisión del dueño, 3 oct 2026)', async () => {
    const { n1, cama, insumo, aplicar, calendario } = await preparar();
    const tres = await insumo('Producto Tres Días', 3, 4);
    await aplicar([n1.id], tres.id, '2026-12-10T14:30:00Z');
    const igual = distintasDeSuNave(await calendario('2026-12-10T15:00:00Z'));
    expect(igual.map((x) => x.nombre)).not.toContain('Nave 1 › Cama 2');
    // Algo aplicado solo en la cama la distingue de su nave.
    const uno = await insumo('Producto Siete Días', 7, 4);
    await aplicar([cama.id], uno.id, '2026-12-10T14:40:00Z');
    const distinta = distintasDeSuNave(await calendario('2026-12-10T15:00:00Z'));
    expect(distinta.map((x) => x.nombre)).toContain('Nave 1 › Cama 2');
  });

  it('CA2: 14 días hacia adelante; el día en que termina la carencia ya es verde', async () => {
    const { n1, insumo, aplicar, calendario } = await preparar();
    const tres = await insumo('Producto Tres Días', 3, 4);
    await aplicar([n1.id], tres.id, '2026-12-10T14:30:00Z');
    const [fila] = await calendario('2026-12-10T15:00:00Z');
    expect(fila?.dias).toHaveLength(DIAS_DEL_CALENDARIO);
    expect(fila?.dias.slice(0, 5).map((d) => [d.fecha, d.color])).toEqual([
      ['2026-12-10', 'rojo'],
      ['2026-12-11', 'rojo'],
      ['2026-12-12', 'rojo'],
      ['2026-12-13', 'verde'],
      ['2026-12-14', 'verde'],
    ]);
    expect(fila?.dias.at(-1)?.fecha).toBe('2026-12-23');
  });

  it('control negativo: lo desconocido nunca sale en verde, ni dentro de 14 días (P1)', async () => {
    const { n2, insumo, aplicar, calendario } = await preparar();
    const sinReentrada = await insumo('Producto Sin Reentrada', 3, null);
    await aplicar([n2.id], sinReentrada.id, '2026-12-10T14:30:00Z');
    const filas = await calendario('2026-12-10T15:00:00Z');
    const nave2 = filas.find((x) => x.area.id === n2.id);
    expect(nave2?.dias.every((d) => d.color === 'gris')).toBe(true);
  });

  describe('CA3: reloj (P8)', () => {
    const tzOriginal = process.env['TZ'];
    afterEach(() => {
      if (tzOriginal === undefined) delete process.env['TZ'];
      else process.env['TZ'] = tzOriginal;
    });

    it.each(HUSOS)('fin de mes con el teléfono en %s', async (zona) => {
      process.env['TZ'] = zona;
      const { n1, insumo, aplicar, calendario } = await preparar();
      const tres = await insumo('Producto Tres Días', 3, 4);
      // 30/10 a las 21:00 en Bogotá: ya es 31/10 en UTC y en Kiritimati.
      await aplicar([n1.id], tres.id, '2026-10-31T02:00:00Z');
      const [fila] = await calendario('2026-10-31T02:30:00Z');
      expect(fila?.dias.slice(0, 4).map((d) => [d.fecha, d.color, d.entrarDesde])).toEqual([
        ['2026-10-30', 'rojo', null],
        ['2026-10-31', 'rojo', '01:00'], // la reentrada de 4 h termina a la 1:00 del 31
        ['2026-11-01', 'rojo', null],
        ['2026-11-02', 'verde', null],
      ]);
      expect(fila?.hoy.carencia).toBe('No cosechar hasta el 02/11 (Producto Tres Días)');
    });

    it.each(HUSOS)('29 de febrero con el teléfono en %s', async (zona) => {
      process.env['TZ'] = zona;
      const { n1, insumo, aplicar, calendario } = await preparar();
      const uno = await insumo('Producto Un Día', 1, 12);
      // 28/02/2028 a las 15:00 en Bogotá: la reentrada termina el 29 a las 3:00.
      await aplicar([n1.id], uno.id, '2028-02-28T20:00:00Z');
      const [fila] = await calendario('2028-02-28T21:00:00Z');
      expect(fila?.dias.slice(0, 3).map((d) => [d.fecha, d.color, d.entrarDesde])).toEqual([
        ['2028-02-28', 'rojo', null],
        ['2028-02-29', 'rojo', '03:00'],
        ['2028-03-01', 'verde', null],
      ]);
      expect(fila?.hoy.carencia).toBe('No cosechar hasta el 29/02 (Producto Un Día)');
    });

    it('a las 23:30 del 31/12 en Bogotá, hoy sigue siendo el 31 aunque en UTC sea 1/1', async () => {
      const { n3, calendario } = await preparar();
      const filas = await calendario('2027-01-01T04:30:00Z');
      const nave3 = filas.find((x) => x.area.id === n3.id);
      expect(nave3?.dias[0]?.fecha).toBe('2026-12-31');
      expect(nave3?.dias[1]?.fecha).toBe('2027-01-01');
    });
  });
});
