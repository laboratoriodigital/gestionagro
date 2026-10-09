import type { Registro } from '@ed1/parqueadero-schema';
import { ENTRADA_ENSAYO, SEDE_ENSAYO_UNO } from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { papelDeLaMensualidad } from './mensualidad.ts';
import { lineasDePapel } from './papel.ts';
import { ReciboIncompleto } from './recibo.ts';
import { resumirTurno } from './turno.ts';

const PAGO: Registro = {
  ...ENTRADA_ENSAYO,
  id: '0199bc3e-3b40-7000-8000-000000000401',
  tipo: 'pago_abonado',
  estadia_id: null,
  consecutivo: 130,
  instante_evento: '2026-10-06T15:00:00.000Z',
  datos: {
    abonado_id: '0192e9a0-0000-7000-8000-000000000001',
    placa: 'ABC12D',
    vehiculo: 'moto',
    desde: '2026-11-01',
    hasta: '2026-11-30',
    valor: 60_000,
    medio_pago: 'efectivo',
  },
};

describe('el recibo de una mensualidad (HU-Q8.4)', () => {
  it('lleva la sede, el número de la caja, la placa, el periodo y el valor en 32 columnas', () => {
    const lineas = lineasDePapel(
      papelDeLaMensualidad(PAGO, SEDE_ENSAYO_UNO, {
        columnas: 32,
        paginaDeCodigos: 'transliterar',
      }),
      32,
    );
    for (const l of lineas) expect(l.length, l).toBeLessThanOrEqual(32);
    const todo = lineas.join('\n');
    expect(todo).toContain(SEDE_ENSAYO_UNO.nombre.toUpperCase());
    expect(todo).toMatch(/MENSUALIDAD +A-000130/);
    expect(todo).toContain('06/10/2026 10:00');
    expect(todo).toMatch(/Placa ABC12D +Moto/);
    expect(todo).toMatch(/Desde +01\/11\/2026/);
    expect(todo).toMatch(/Hasta \(incluido\) +30\/11\/2026/);
    expect(todo).toMatch(/TOTAL +\$60\.000/);
    expect(todo).toContain('Pago: efectivo');
  });

  it('❌ sin los datos legales de la sede no sale', () => {
    expect(() =>
      papelDeLaMensualidad(
        PAGO,
        { ...SEDE_ENSAYO_UNO, nit: '' },
        {
          columnas: 32,
          paginaDeCodigos: 'transliterar',
        },
      ),
    ).toThrow(ReciboIncompleto);
  });

  it('entra al cierre: su efectivo al esperado; una anulada no cuenta', () => {
    const apertura: Registro = {
      ...PAGO,
      id: '0199bc3e-3b40-7000-8000-000000000400',
      tipo: 'turno_apertura',
      serie: null,
      consecutivo: null,
      instante_evento: '2026-10-06T11:00:00.000Z',
      datos: { base: 50_000, operador: 'Caja 1' },
    };
    const r = resumirTurno(apertura, [apertura, PAGO], 1);
    expect(r).toMatchObject({
      mensualidades: 1,
      porMedio: { efectivo: 60_000 },
      esperado: 110_000,
    });
    expect(r.entregas.recibos).toBe(1);
    const anulada: Registro = {
      ...apertura,
      id: '0199bc3e-3b40-7000-8000-000000000402',
      tipo: 'anulacion',
      anula_id: PAGO.id,
      datos: { motivo: 'cobró dos veces', operador: 'Caja 1' },
    };
    expect(resumirTurno(apertura, [apertura, PAGO, anulada], 1)).toMatchObject({
      mensualidades: 0,
      porMedio: {},
      esperado: 50_000,
    });
  });
});
