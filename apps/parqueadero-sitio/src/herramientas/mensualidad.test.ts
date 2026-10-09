import { liquidarMensualidad } from '@ed1/parqueadero-tarifas';
import { describe, expect, it } from 'vitest';
import {
  detalleDelPeriodo,
  fechaLegible,
  hoyEnBogota,
  leerPesos,
  pedidoDelFormulario,
  valorPorDia,
} from './mensualidad.ts';

describe('el liquidador de mensualidades (HU-Q11.6)', () => {
  it('lee pesos con o sin puntos de miles, y nada más', () => {
    expect(leerPesos('300000')).toBe(300_000);
    expect(leerPesos('300.000')).toBe(300_000);
    expect(leerPesos(' $1.200.000 ')).toBe(1_200_000);
    expect(leerPesos('300,000')).toBeNaN();
    expect(leerPesos('30.00')).toBeNaN();
    expect(leerPesos('')).toBeNaN();
  });

  it('el día de hoy es el de Bogotá, sin depender de la zona del navegador', () => {
    expect(hoyEnBogota(Date.UTC(2026, 9, 21, 3, 0))).toBe('2026-10-20');
    expect(hoyEnBogota(Date.UTC(2026, 9, 21, 5, 0))).toBe('2026-10-21');
    expect(fechaLegible('2026-10-20')).toBe('20/10/2026');
  });

  it('lee el formulario: hasta fin de mes salvo que pida meses, y sin meses es 0', () => {
    const campos: Record<string, string> = {
      vehiculo: 'moto',
      valor: '60.000',
      desde: '2026-10-20',
      cobrar: 'fin-de-mes',
      meses: '',
    };
    expect(pedidoDelFormulario((n) => campos[n] ?? '')).toEqual({
      vehiculo: 'moto',
      valor: 60_000,
      desde: '2026-10-20',
      meses: 0,
      hastaFinDeMes: true,
    });
    const meses = pedidoDelFormulario((n) => ({ ...campos, cobrar: 'meses', meses: '3' })[n] ?? '');
    expect(meses).toMatchObject({ meses: 3, hastaFinDeMes: false });
  });

  it('❌ un vehículo inventado o unos meses ilegibles no pasan por buenos', () => {
    const d = pedidoDelFormulario((n) => ({ vehiculo: 'avion', meses: 'dos' })[n] ?? '');
    expect(d.vehiculo).toBe('carro');
    expect(d.meses).toBeNaN();
    expect(d.valor).toBeNaN();
  });

  it('el detalle dice la cuenta de los días sueltos y el mes completo (CA1)', () => {
    const [suelto, completo] = liquidarMensualidad(300_000, '2026-10-20', {
      meses: 1,
      hastaFinDeMes: true,
    }).periodos;
    if (!suelto || !completo) throw new Error('faltan periodos');
    expect(detalleDelPeriodo(suelto, 300_000)).toBe(
      '12 de 31 días: $300.000 × 12 ÷ 31 = $116.129, hacia abajo a la centena.',
    );
    expect(valorPorDia(suelto, 300_000)).toBe(9_677);
    expect(detalleDelPeriodo(completo, 300_000)).toBe('Mes completo: 30 días.');
    const [exacto] = liquidarMensualidad(300_000, '2026-02-15', {
      meses: 0,
      hastaFinDeMes: true,
    }).periodos;
    if (!exacto) throw new Error('falta el periodo');
    expect(detalleDelPeriodo(exacto, 300_000)).toBe(
      '14 de 28 días: $300.000 × 14 ÷ 28 = $150.000.',
    );
  });
});
