import { describe, expect, it } from 'vitest';
import {
  diaSiguiente,
  diasEntre,
  finDelPeriodo,
  finDeMes,
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
