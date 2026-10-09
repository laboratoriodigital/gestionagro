import { describe, expect, it } from 'vitest';
import { conComa, cuposElectricos, respuesta } from './cupos-electricos.ts';

describe('los cupos para vehículos eléctricos (HU-Q11.7)', () => {
  it('el 2 % de los cupos, hacia arriba para no quedar por debajo del mínimo', () => {
    expect(cuposElectricos(120, 2)).toEqual({ centesimas: 240, cupos: 3 });
    expect(cuposElectricos(100, 2)).toEqual({ centesimas: 200, cupos: 2 });
    expect(cuposElectricos(30, 2)).toEqual({ centesimas: 60, cupos: 1 });
    expect(cuposElectricos(1, 2)).toEqual({ centesimas: 2, cupos: 1 });
  });

  it('❌ unos cupos ilegibles, en cero o desmedidos no dan respuesta', () => {
    for (const c of [0, -5, 2.5, Number.NaN, 100_001]) expect(cuposElectricos(c, 2)).toBeNull();
  });

  it('escribe las centésimas con coma y sin ceros de más', () => {
    expect(conComa(240)).toBe('2,4');
    expect(conComa(205)).toBe('2,05');
    expect(conComa(200)).toBe('2');
    expect(conComa(60)).toBe('0,6');
  });

  it('dice si el municipio está obligado, y cuando no lo sabe, cómo saberlo', () => {
    const c = cuposElectricos(120, 2);
    if (!c) throw new Error('sin respuesta');
    expect(respuesta(c, 120, 2, 'si')).toEqual({
      titular: '3 cupos para vehículos eléctricos, como mínimo',
      detalle: 'El 2 % de 120 cupos es 2,4: se redondea hacia arriba, a 3.',
    });
    expect(respuesta(c, 120, 2, 'no-se').detalle).toContain('su alcaldía le dice la categoría');
    expect(respuesta(c, 120, 2, 'no').titular).toBe('La ley no se lo exige en su municipio');
    const exacto = cuposElectricos(50, 2);
    if (!exacto) throw new Error('sin respuesta');
    expect(respuesta(exacto, 50, 2, 'si')).toEqual({
      titular: '1 cupo para vehículos eléctricos, como mínimo',
      detalle: 'El 2 % de 50 cupos es 1.',
    });
  });
});
