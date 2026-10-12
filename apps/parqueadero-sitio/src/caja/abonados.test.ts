import type { Abonado } from '@ed1/parqueadero-schema';
import { CASOS_DE_MENSUALIDAD } from '@ed1/parqueadero-tarifas/casos-de-mensualidad';
import { describe, expect, it } from 'vitest';
import {
  abonoDeLaPlaca,
  conPagos,
  inicioDelDia,
  periodoPorCobrar,
  unMesDesde,
  venceEl,
  vencenPronto,
} from './abonados.ts';

/** Las HH:MM de Bogotá de un día, en milisegundos Unix. */
const bogota = (fecha: string, hh: number, mm: number) =>
  inicioDelDia(fecha) + (hh * 60 + mm) * 60_000;

function abonado(cambios: Partial<Abonado> = {}): Abonado {
  return {
    id: '0192e9a0-0000-7000-8000-000000000001',
    org_id: null,
    version: 1,
    actualizado: '2026-10-01T05:00:00.000Z',
    entidad: 'abonado',
    placa: 'ABC12D',
    vehiculo: 'moto',
    referencia: null,
    desde: '2026-10-01',
    hasta: '2026-10-31',
    valor: 60_000,
    activo: true,
    ...cambios,
  };
}

describe('la vigencia de un abono (HU-Q3.11)', () => {
  it('cubre del primer minuto de «desde» al último de «hasta», en hora de Bogotá', () => {
    const a = abonado();
    expect(inicioDelDia('2026-10-01')).toBe(Date.UTC(2026, 9, 1, 5, 0));
    expect(venceEl(a)).toBe(Date.UTC(2026, 10, 1, 5, 0));
    expect(abonoDeLaPlaca([a], 'ABC12D', bogota('2026-10-01', 0, 0)).vigente).toBe(a);
    expect(abonoDeLaPlaca([a], 'ABC12D', bogota('2026-10-31', 23, 59)).vigente).toBe(a);
    expect(abonoDeLaPlaca([a], 'ABC12D', bogota('2026-11-01', 0, 0))).toEqual({
      vigente: null,
      vencido: a,
    });
    expect(abonoDeLaPlaca([a], 'ABC12D', bogota('2026-09-30', 23, 59))).toEqual({
      vigente: null,
      vencido: null,
    });
  });

  it('uno desactivado o de otra placa no cuenta; de dos, el que vence más tarde', () => {
    const viejo = abonado({ hasta: '2026-10-15' });
    const renovado = abonado({ id: '0192e9a0-0000-7000-8000-000000000002', hasta: '2026-11-15' });
    const ahora = bogota('2026-10-10', 12, 0);
    expect(abonoDeLaPlaca([viejo, renovado], 'ABC12D', ahora).vigente).toBe(renovado);
    expect(abonoDeLaPlaca([abonado({ activo: false })], 'ABC12D', ahora)).toEqual({
      vigente: null,
      vencido: null,
    });
    expect(abonoDeLaPlaca([abonado()], 'XYZ98D', ahora).vigente).toBeNull();
  });

  it('un mes va hasta el día anterior del mes siguiente, o su último día', () => {
    expect(unMesDesde('2026-10-07')).toBe('2026-11-06');
    expect(unMesDesde('2026-10-01')).toBe('2026-10-31');
    expect(unMesDesde('2026-01-31')).toBe('2026-02-28');
    expect(unMesDesde('2026-12-15')).toBe('2027-01-14');
  });
});

describe('las mensualidades cobradas (HU-Q8.4)', () => {
  const ID = '0192e9a0-0000-7000-8000-000000000001';
  const pago = (desde: string, hasta: string) => ({ abonado_id: ID, desde, hasta });

  it('un pago seguido alarga la vigencia; uno después de un hueco abre otra', () => {
    const a = abonado();
    expect(conPagos([a], [pago('2026-11-01', '2026-11-30')])[0]).toMatchObject({
      desde: '2026-10-01',
      hasta: '2026-11-30',
    });
    // Dos seguidos, en cualquier orden.
    expect(
      conPagos([a], [pago('2026-12-01', '2026-12-31'), pago('2026-11-01', '2026-11-30')])[0]?.hasta,
    ).toBe('2026-12-31');
    // Venció el 31 de octubre y pagó desde el 10 de noviembre: los días del medio no cubren.
    const conHueco = conPagos([a], [pago('2026-11-10', '2026-12-09')])[0];
    expect(conHueco).toMatchObject({ desde: '2026-11-10', hasta: '2026-12-09' });
    if (!conHueco) throw new Error('falta el abonado');
    expect(abonoDeLaPlaca([conHueco], 'ABC12D', bogota('2026-11-05', 12, 0)).vigente).toBeNull();
    // Un pago de otro abonado no lo toca, y sin pagos sigue siendo el mismo objeto.
    expect(conPagos([a], [{ ...pago('2026-11-01', '2026-11-30'), abonado_id: 'otro' }])[0]).toBe(a);
  });

  it('cobra el periodo siguiente al vigente, o desde hoy si venció', () => {
    const a = abonado({ valor: 300_000 });
    expect(periodoPorCobrar(a, '2026-10-28')).toEqual({
      desde: '2026-11-01',
      hasta: '2026-11-30',
      valor: 300_000,
    });
    expect(periodoPorCobrar(a, '2026-11-05')).toEqual({
      desde: '2026-11-05',
      hasta: '2026-12-04',
      valor: 300_000,
    });
    // Hasta fin de mes, con prorrateo: del 5 al 30 de noviembre son 26 de 30 días.
    expect(periodoPorCobrar(a, '2026-11-05', { hastaFinDeMes: true })).toEqual({
      desde: '2026-11-05',
      hasta: '2026-11-30',
      valor: 260_000,
    });
    expect(periodoPorCobrar(abonado({ plan: 'quincena', valor: 35_000 }), '2026-10-28')).toEqual({
      desde: '2026-11-01',
      hasta: '2026-11-15',
      valor: 35_000,
    });
    // El primero: el periodo con que se agregó, del 20 al 31 de octubre.
    const nuevo = abonado({ desde: '2026-10-20', hasta: '2026-10-31', valor: 300_000 });
    expect(periodoPorCobrar(nuevo, '2026-10-20', { primero: true })).toEqual({
      desde: '2026-10-20',
      hasta: '2026-10-31',
      valor: 116_100,
    });
  });

  it('vencen pronto: los activos que vencen de hoy a 5 días, el primero arriba (CA2)', () => {
    const lista = [
      abonado({ placa: 'AAA11A', hasta: '2026-10-31' }),
      abonado({ placa: 'BBB22B', hasta: '2026-10-27' }),
      abonado({ placa: 'CCC33C', hasta: '2026-11-02' }),
      abonado({ placa: 'DDD44D', hasta: '2026-10-25' }),
      abonado({ placa: 'EEE55E', hasta: '2026-10-28', activo: false }),
    ];
    expect(vencenPronto(lista, '2026-10-27').map((a) => a.placa)).toEqual(['BBB22B', 'AAA11A']);
  });
});

describe('la caja cobra lo mismo que el liquidador del sitio (HU-Q11.6 WI-Q11.6.2)', () => {
  it.each(CASOS_DE_MENSUALIDAD)('$nombre', (c) => {
    // Un abonado vencido antes de `desde`: la caja cobra desde ese día.
    const a = abonado({ plan: 'mes', valor: c.valor, desde: '2025-01-01', hasta: '2025-01-31' });
    const [desde, hasta, valor] = c.periodos[0] ?? [];
    expect(periodoPorCobrar(a, c.desde, { hastaFinDeMes: c.hastaFinDeMes })).toEqual({
      desde,
      hasta,
      valor,
    });
  });
});
