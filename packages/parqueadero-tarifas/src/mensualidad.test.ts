import { describe, expect, it } from 'vitest';
import { CASOS_DE_MENSUALIDAD } from './mensualidad.fixture.ts';
import {
  diaSiguiente,
  diasEntre,
  finDelPeriodo,
  finDeMes,
  liquidarMensualidad,
  MensualidadIncompleta,
  prorrateo,
  unMesDesde,
} from './mensualidad.ts';

describe('los periodos de una mensualidad (HU-Q8.4)', () => {
  it('un mes va al día anterior del mes siguiente; si no existe, al último', () => {
    expect(unMesDesde('2026-10-07')).toBe('2026-11-06');
    expect(unMesDesde('2026-10-01')).toBe('2026-10-31');
    expect(unMesDesde('2026-01-31')).toBe('2026-02-28');
    expect(unMesDesde('2026-12-15')).toBe('2027-01-14');
  });

  it('una quincena son 15 días con los dos extremos', () => {
    expect(finDelPeriodo('quincena', '2026-10-20')).toBe('2026-11-03');
    expect(diasEntre('2026-10-20', '2026-11-03')).toBe(15);
    expect(finDelPeriodo('mes', '2026-10-20')).toBe('2026-11-19');
  });

  it('el día siguiente y el fin de mes cruzan meses y años', () => {
    expect(diaSiguiente('2026-12-31')).toBe('2027-01-01');
    expect(finDeMes('2026-02-10')).toBe('2026-02-28');
    expect(finDeMes('2028-02-10')).toBe('2028-02-29');
  });

  it('el prorrateo de un mes empezado cobra sus días, hacia abajo a la centena', () => {
    // Del 20 al 31 de octubre: 12 de los 31 días de un mes desde el 20.
    expect(prorrateo(300_000, 'mes', '2026-10-20', '2026-10-31')).toBe(116_100);
    expect(prorrateo(60_000, 'mes', '2026-10-20', '2026-10-31')).toBe(23_200);
    expect(prorrateo(300_000, 'mes', '2026-10-20', '2026-11-19')).toBe(300_000);
    expect(prorrateo(300_000, 'mes', '2026-10-20', '2026-12-31')).toBe(300_000);
  });

  it('❌ el prorrateo nunca cobra más que el periodo completo', () => {
    for (const hasta of ['2026-10-20', '2026-10-25', '2026-11-18']) {
      expect(prorrateo(99_999, 'mes', '2026-10-20', hasta)).toBeLessThan(99_999);
    }
  });
});

describe('el liquidador de mensualidades (HU-Q11.6)', () => {
  it.each(CASOS_DE_MENSUALIDAD)('$nombre', (c) => {
    const l = liquidarMensualidad(c.valor, c.desde, c);
    expect(l.periodos.map((p) => [p.desde, p.hasta, p.valor])).toEqual(c.periodos);
    expect(l.total).toBe(c.total);
  });

  it('cada periodo dice sus días, los del mes y la cuenta antes de la centena', () => {
    const [primero, segundo] = liquidarMensualidad(300_000, '2026-10-20', {
      meses: 1,
      hastaFinDeMes: true,
    }).periodos;
    expect(primero).toMatchObject({ dias: 12, diasDelMes: 31, exacto: 116_129, valor: 116_100 });
    expect(segundo).toMatchObject({ dias: 30, diasDelMes: 30, exacto: 300_000, valor: 300_000 });
  });

  it('❌ un valor ilegible o en cero, una fecha que no existe o sin meses no dan total', () => {
    const faltan = (valor: number, desde: string, meses: number, hastaFinDeMes = false) => {
      try {
        liquidarMensualidad(valor, desde, { meses, hastaFinDeMes });
        return [];
      } catch (e) {
        if (!(e instanceof MensualidadIncompleta)) throw e;
        return e.faltan;
      }
    };
    expect(faltan(0, '2026-10-20', 1)).toEqual(['el valor del mes']);
    expect(faltan(Number.NaN, '2026-02-30', 0)).toEqual([
      'el valor del mes',
      'la fecha de inicio',
      'cuántos meses',
    ]);
    expect(faltan(300_000, '', 25, true)).toEqual(['la fecha de inicio', 'cuántos meses']);
    expect(faltan(300_000, '2026-10-20', 0, true)).toEqual([]);
  });
});
