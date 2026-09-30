import { describe, expect, it } from 'vitest';
import casos from '../casos/dpv.json' with { type: 'json' };
import { dpvAireKPa, dpvHojaKPa, ErrorDeMedida, presionSaturacionKPa } from './index.ts';

const cerca = (valor: number, esperado: number) =>
  expect(Math.abs(valor - esperado)).toBeLessThanOrEqual(casos.tolerancia_kPa / 2 + 1e-9);

describe('DPV del aire contra la tabla de casos (ARQUITECTURA §5.2)', () => {
  it.each(casos.aire)('$temperaturaC °C y $humedadRelativaPct % → $dpvKPa kPa', (c) => {
    cerca(presionSaturacionKPa(c.temperaturaC), c.presionSaturacionKPa);
    cerca(dpvAireKPa(c.temperaturaC, c.humedadRelativaPct), c.dpvKPa);
  });
});

describe('DPV de la hoja contra la tabla de casos', () => {
  it.each(casos.hoja)(
    'aire $temperaturaAireC °C, $humedadRelativaPct %, hoja $temperaturaHojaC °C → $dpvHojaKPa kPa',
    (c) => {
      cerca(dpvHojaKPa(c.temperaturaAireC, c.humedadRelativaPct, c.temperaturaHojaC), c.dpvHojaKPa);
    },
  );

  it('con la hoja a la temperatura del aire, coincide con el DPV del aire', () => {
    expect(dpvHojaKPa(24, 70, 24)).toBeCloseTo(dpvAireKPa(24, 70), 12);
  });

  it('una hoja más fría que el punto de rocío da negativo, sin recortarlo a 0', () => {
    expect(dpvHojaKPa(24, 90, 18)).toBeLessThan(0);
  });
});

describe('entradas inválidas lanzan; nunca devuelven 0 ni NaN (P1)', () => {
  it.each(casos.invalidos)(
    '$campo fuera de rango: $temperaturaC °C, $humedadRelativaPct %',
    (c) => {
      expect(() => dpvAireKPa(c.temperaturaC, c.humedadRelativaPct)).toThrow(
        expect.objectContaining({ name: 'ErrorDeMedida', campo: c.campo }),
      );
    },
  );

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['undefined', undefined],
    ['null', null],
    ['texto «24,5»', '24,5'],
    ['texto vacío', ''],
  ])('temperatura %s lanza ErrorDeMedida', (_nombre, valor) => {
    expect(() => dpvAireKPa(valor as number, 70)).toThrow(ErrorDeMedida);
  });

  it.each([
    ['NaN', Number.NaN],
    ['texto «70»', '70'],
  ])('humedad %s lanza ErrorDeMedida', (_nombre, valor) => {
    expect(() => dpvAireKPa(24, valor as number)).toThrow(ErrorDeMedida);
  });

  it('el error de la hoja nombra el campo de la hoja', () => {
    expect(() => dpvHojaKPa(24, 70, 75)).toThrow(
      expect.objectContaining({ campo: 'temperaturaHojaC' }),
    );
    expect(() => dpvHojaKPa(-20, 70, 24)).toThrow(
      expect.objectContaining({ campo: 'temperaturaAireC' }),
    );
  });

  it('el mensaje dice el valor y el rango aceptado', () => {
    expect(() => dpvAireKPa(24, 120)).toThrow(
      '«humedadRelativaPct» fuera de rango: 120 (se acepta de 0 a 100)',
    );
  });
});
