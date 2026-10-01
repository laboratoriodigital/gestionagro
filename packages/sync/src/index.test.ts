import { describe, expect, it } from 'vitest';
import { compararVersiones, pedidoDeActualizar, proximoReinicioDeCuota } from './index.ts';

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

describe('versión mínima de la app (HU-E5.5)', () => {
  it('compara X.Y.Z como números, no como texto', () => {
    expect(compararVersiones('0.10.0', '0.9.9')).toBe(1);
    expect(compararVersiones('0.1.0', '0.1.0')).toBe(0);
    expect(compararVersiones('0.1.0', '0.2.0')).toBe(-1);
  });

  it('una app más vieja que la mínima recibe el pedido de actualizar; una ilegible, también', () => {
    expect(pedidoDeActualizar('0.1.0', '0.2.0')).toMatchObject({ minima: '0.2.0' });
    expect(pedidoDeActualizar('0.2.0', '0.2.0')).toBeUndefined();
    expect(pedidoDeActualizar('0.3.1', '0.2.0')).toBeUndefined();
    expect(pedidoDeActualizar(undefined, '0.2.0')).toMatchObject({ minima: '0.2.0' });
    expect(pedidoDeActualizar('basura', '0.2.0')).toMatchObject({ minima: '0.2.0' });
  });
});
