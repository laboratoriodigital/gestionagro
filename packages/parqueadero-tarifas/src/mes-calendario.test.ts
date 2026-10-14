/**
 * HU-Q13.4: la mensualidad del 1 al último día del mes, como opción de la sede. Contratada a mitad
 * de mes, esos días se cobran en proporción y los meses siguientes, enteros. Por omisión sigue de
 * fecha a fecha, como siempre.
 */
import { describe, expect, it } from 'vitest';
import { finDelPeriodo, habilesEntre, prorrateo } from './mensualidad.ts';

const centena = (n: number) => Math.floor(n / 100) * 100;

describe('los meses del 1 al último día (HU-Q13.4)', () => {
  it('un mes termina el último día de su mes; de fecha a fecha, el día anterior del siguiente', () => {
    expect(finDelPeriodo('mes', '2026-10-15', 'calendario')).toBe('2026-10-31');
    expect(finDelPeriodo('mes', '2026-10-15')).toBe('2026-11-14');
    expect(finDelPeriodo('quincena', '2026-10-15', 'calendario')).toBe('2026-10-29');
  });

  it('contratada el 15 de octubre: 17 de 31 días en proporción', () => {
    expect(prorrateo(300_000, 'mes', '2026-10-15', '2026-10-31', 'calendario', 'calendario')).toBe(
      centena((300_000 * 17) / 31),
    );
  });

  it('del 15 de octubre al 30 de noviembre: octubre en proporción y noviembre entero', () => {
    expect(prorrateo(300_000, 'mes', '2026-10-15', '2026-11-30', 'calendario', 'calendario')).toBe(
      centena((300_000 * 17) / 31) + 300_000,
    );
  });

  it('un mes que empieza el 1 vale el mes entero', () => {
    expect(prorrateo(300_000, 'mes', '2026-11-01', '2026-11-30', 'calendario', 'calendario')).toBe(
      300_000,
    );
  });

  it('con días hábiles, la proporción es sobre los hábiles del mes calendario', () => {
    // Octubre de 2026: 21 hábiles; del 15 al 31, 12.
    expect(prorrateo(300_000, 'mes', '2026-10-15', '2026-10-31', 'habiles', 'calendario')).toBe(
      centena((300_000 * 12) / habilesEntre('2026-10-01', '2026-10-31')),
    );
  });

  it('❌ de fecha a fecha, por omisión, el mes del 15 al 14 vale entero, como antes', () => {
    expect(prorrateo(300_000, 'mes', '2026-10-15', '2026-11-14')).toBe(300_000);
  });
});
