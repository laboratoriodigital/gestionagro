/**
 * HU-Q13.5: el detalle del prorrateo que la caja muestra al cobrar la mensualidad. Cada tramo dice
 * sus días, los del periodo entero y lo que vale; la suma es el `prorrateo` de siempre.
 */
import { describe, expect, it } from 'vitest';
import { detalleDelProrrateo, prorrateo } from './mensualidad.ts';

describe('el detalle del prorrateo (HU-Q13.5)', () => {
  it('de fecha a fecha, un tramo: 12 de los 31 días del mes que empieza el 20', () => {
    expect(detalleDelProrrateo(300_000, 'mes', '2026-10-20', '2026-10-31')).toEqual([
      {
        desde: '2026-10-20',
        hasta: '2026-10-31',
        dias: 12,
        completo: 31,
        habiles: false,
        entero: false,
        valor: 116_100,
      },
    ]);
  });

  it('del 1 al último día, un tramo por mes: octubre en proporción y noviembre entero', () => {
    const tramos = detalleDelProrrateo(
      300_000,
      'mes',
      '2026-10-20',
      '2026-11-30',
      'calendario',
      'calendario',
    );
    expect(tramos.map((t) => [t.desde, t.hasta, t.dias, t.completo, t.entero, t.valor])).toEqual([
      ['2026-10-20', '2026-10-31', 12, 31, false, 116_100],
      ['2026-11-01', '2026-11-30', 30, 30, true, 300_000],
    ]);
    expect(tramos.reduce((a, t) => a + t.valor, 0)).toBe(
      prorrateo(300_000, 'mes', '2026-10-20', '2026-11-30', 'calendario', 'calendario'),
    );
  });

  it('por días hábiles, cuenta de lunes a viernes sin festivos y lo dice', () => {
    // Octubre de 2026: 22 días de lunes a viernes, menos el festivo del 12; del 20 al 31, 9.
    const [t] = detalleDelProrrateo(
      300_000,
      'mes',
      '2026-10-20',
      '2026-10-31',
      'habiles',
      'calendario',
    );
    expect(t).toMatchObject({
      dias: 9,
      completo: 21,
      habiles: true,
      entero: false,
      valor: 128_500,
    });
  });

  it('❌ un periodo entero no se prorratea: vale el valor del plan', () => {
    const [t] = detalleDelProrrateo(35_000, 'quincena', '2026-10-20', '2026-11-03');
    expect(t).toMatchObject({ dias: 15, completo: 15, entero: true, valor: 35_000 });
  });
});
