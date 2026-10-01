import { describe, expect, it } from 'vitest';
import { proximoReinicioDeCuota } from './index.ts';

describe('reinicio de la cuota diaria (P8)', () => {
  it('es a las 00:00 UTC: las 19:00 en Bogotá, también en fin de mes y de año', () => {
    // 18:59 en Bogotá (23:59 UTC) → el reinicio es en un minuto.
    expect(proximoReinicioDeCuota(Date.UTC(2026, 9, 1, 23, 59))).toBe(Date.UTC(2026, 9, 2));
    // 19:01 en Bogotá (00:01 UTC del día siguiente) → el reinicio es el otro día.
    expect(proximoReinicioDeCuota(Date.UTC(2026, 9, 2, 0, 1))).toBe(Date.UTC(2026, 9, 3));
    expect(proximoReinicioDeCuota(Date.UTC(2026, 11, 31, 12))).toBe(Date.UTC(2027, 0, 1));
    expect(proximoReinicioDeCuota(Date.UTC(2028, 1, 28, 12))).toBe(Date.UTC(2028, 1, 29));
  });
});
