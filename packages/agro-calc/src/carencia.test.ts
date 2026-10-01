import { describe, expect, it } from 'vitest';
import casos from '../casos/carencia.json' with { type: 'json' };
import { vencimientoCarencia, vencimientoReentrada } from './carencia.ts';

describe('vencimiento de la carencia (HU-E3.10, CA1 y CA3)', () => {
  it.each(casos.carencia)('$caso: $fechaAplicacion + $dias días → $puedeCosecharDesde', (c) => {
    expect(vencimientoCarencia(c.fechaAplicacion, c.dias)).toBe(c.puedeCosecharDesde);
  });

  it.each(casos.invalidos)('rechaza $fechaAplicacion con $dias días nombrando $campo (P1)', (c) => {
    expect(() => vencimientoCarencia(c.fechaAplicacion, c.dias)).toThrow(
      expect.objectContaining({ name: 'ErrorDeMedida', campo: c.campo }),
    );
  });
});

describe('vencimiento de la reentrada (HU-E3.10, CA1)', () => {
  it.each(casos.reentrada)('$caso', (c) => {
    expect(new Date(vencimientoReentrada(Date.parse(c.instante), c.horas)).toISOString()).toBe(
      c.entrarDesde,
    );
  });

  it('horas negativas, fraccionarias o ilegibles lanzan, no inventan un instante', () => {
    const t = Date.parse('2026-12-10T14:30:00.000Z');
    for (const horas of [-1, 1.5, Number.NaN]) {
      expect(() => vencimientoReentrada(t, horas)).toThrow(
        expect.objectContaining({ campo: 'reentradaHoras' }),
      );
    }
  });
});
