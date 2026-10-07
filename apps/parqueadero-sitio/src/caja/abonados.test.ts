import type { Abonado } from '@ed1/parqueadero-schema';
import { describe, expect, it } from 'vitest';
import { abonoDeLaPlaca, inicioDelDia, unMesDesde, venceEl } from './abonados.ts';

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
