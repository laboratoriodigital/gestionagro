import { describe, expect, it } from 'vitest';
import casos from '../casos/rendimiento.json' with { type: 'json' };
import { ErrorDeMedida } from './medida.ts';
import { formatearCantidad, rendimiento } from './rendimiento.ts';

const cerca = (a: number | null, b: number | null) =>
  a === null || b === null ? a === b : Math.abs(a - b) <= casos.tolerancia;

describe('rendimiento por m² y por planta (HU-E6.6, CA1)', () => {
  it.each(casos.casos)(
    '$cosechado cosechado, $descarte de descarte, $areaM2 m², $plantas plantas',
    (c) => {
      const r = rendimiento(c);
      expect(cerca(r.comercial, c.comercial)).toBe(true);
      expect(cerca(r.porM2, c.porM2)).toBe(true);
      expect(cerca(r.porPlanta, c.porPlanta)).toBe(true);
      expect(cerca(r.descartePct, c.descartePct)).toBe(true);
    },
  );

  it.each(casos.invalidos)('rechaza nombrando $campo (P1)', (c) => {
    expect(() => rendimiento(c)).toThrow(
      expect.objectContaining({ name: 'ErrorDeMedida', campo: c.campo }),
    );
  });

  it('sin plantas no inventa un cero', () => {
    expect(
      rendimiento({ cosechado: 10, descarte: 0, areaM2: 5, plantas: null }).porPlanta,
    ).toBeNull();
  });

  it('un valor que no es número lanza, no devuelve NaN', () => {
    expect(() =>
      rendimiento({ cosechado: Number.NaN, descarte: 0, areaM2: 5, plantas: null }),
    ).toThrow(ErrorDeMedida);
  });

  it('se muestra con coma decimal y punto de miles', () => {
    expect(formatearCantidad(2.4)).toBe('2,4');
    expect(formatearCantidad(0.39375)).toBe('0,39');
    expect(formatearCantidad(1250)).toBe('1.250');
  });
});
