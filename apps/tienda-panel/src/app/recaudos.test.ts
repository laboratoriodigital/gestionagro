/** HU-T9.5: la antigüedad de un recaudo y lo que revisa «Liquidar». */
import { describe, expect, it } from 'vitest';
import { antiguedad, fleteDeVuelta, revisarLiquidacion } from './recaudos.ts';

describe('recaudos', () => {
  const AHORA = Date.parse('2026-10-15T15:00:00.000Z'); // 10:00 en Bogotá

  it('la antigüedad va en días de calendario de Bogotá', () => {
    expect(antiguedad('2026-10-15T06:00:00.000Z', AHORA)).toBe('hoy'); // 1:00 en Bogotá
    expect(antiguedad('2026-10-15T04:00:00.000Z', AHORA)).toBe('hace 1 día'); // 23:00 del 14
    expect(antiguedad('2026-10-03T15:00:00.000Z', AHORA)).toBe('hace 12 días');
  });

  it('❌ liquidar pide qué recaudos y el número de la liquidación', () => {
    expect(revisarLiquidacion([], ' ').map((e) => e.campo)).toEqual(['pedidos', 'liquidacionRef']);
    expect(revisarLiquidacion(['ped-1'], 'LIQ-1')).toEqual([]);
  });

  it('el flete de vuelta vacío es «no lo sé», nunca 0', () => {
    expect(fleteDeVuelta('')).toBeNull();
    expect(fleteDeVuelta('10.000')).toBe(10000);
    expect(fleteDeVuelta('diez')).toBeUndefined();
  });
});
