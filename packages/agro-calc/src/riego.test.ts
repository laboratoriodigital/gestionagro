import { describe, expect, it } from 'vitest';
import casos from '../casos/drenaje.json' with { type: 'json' };
import { ErrorDeMedida } from './medida.ts';
import { drenajePct, formatearPct } from './riego.ts';

describe('porcentaje de drenaje (HU-E3.7, CA1)', () => {
  it.each(casos.casos)('$volumenDrenado de $volumenAplicado → $drenajePct %', (c) => {
    expect(
      Math.abs(drenajePct(c.volumenAplicado, c.volumenDrenado) - c.drenajePct),
    ).toBeLessThanOrEqual(casos.tolerancia_pct);
  });

  it.each(casos.invalidos)(
    'rechaza $volumenDrenado de $volumenAplicado nombrando $campo (P1)',
    (c) => {
      expect(() => drenajePct(c.volumenAplicado, c.volumenDrenado)).toThrow(
        expect.objectContaining({ name: 'ErrorDeMedida', campo: c.campo }),
      );
    },
  );

  it('un valor que no es número lanza, no devuelve NaN', () => {
    expect(() => drenajePct(Number.NaN, 10)).toThrow(ErrorDeMedida);
    expect(() => drenajePct(500, '10' as unknown as number)).toThrow(ErrorDeMedida);
  });

  it('se muestra con coma y hasta un decimal', () => {
    expect(formatearPct(30)).toBe('30 %');
    expect(formatearPct(100 / 3)).toBe('33,3 %');
  });
});
