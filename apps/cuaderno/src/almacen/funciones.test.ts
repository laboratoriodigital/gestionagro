/**
 * Funciones por plan (HU-E9.1): el calendario de carencias se enciende o apaga desde un JSON.
 */
import { describe, expect, it } from 'vitest';
import { funcionActiva } from './funciones.ts';

describe('funciones por plan', () => {
  it('hoy el calendario de carencias está encendido en todos los planes', () => {
    for (const plan of ['gratuito', 'finca', 'exportador', 'cadena']) {
      expect(funcionActiva('calendario_carencias', plan)).toBe(true);
    }
  });

  it('apagado en el gratuito, sigue en los pagos; un plan desconocido cuenta como el gratuito', () => {
    const tabla = { calendario_carencias: { gratuito: false, finca: true } };
    expect(funcionActiva('calendario_carencias', 'gratuito', tabla)).toBe(false);
    expect(funcionActiva('calendario_carencias', 'finca', tabla)).toBe(true);
    expect(funcionActiva('calendario_carencias', 'plan-que-no-existe', tabla)).toBe(false);
  });

  it('sin el gratuito en la tabla, apagada: nunca se enciende por omisión', () => {
    const tabla = { calendario_carencias: { finca: true } };
    expect(funcionActiva('calendario_carencias', 'gratuito', tabla)).toBe(false);
  });
});
