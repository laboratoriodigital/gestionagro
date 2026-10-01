import { describe, expect, it } from 'vitest';
import { diasEntre, fechaAgronomica, instanteDeUuidv7, uuidv7 } from './reloj.ts';

const ceros = (n: number) => new Uint8Array(n);
const unos = (n: number) => new Uint8Array(n).fill(0xff);
const FORMATO_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('UUIDv7', () => {
  it('lleva versión 7, variante RFC y el instante del reloj', () => {
    const ms = Date.UTC(2026, 9, 15, 13, 0, 0);
    for (const azar of [ceros, unos]) {
      const u = uuidv7(() => ms, azar);
      expect(u).toMatch(FORMATO_V7);
      expect(instanteDeUuidv7(u)).toBe(ms);
    }
  });

  it('ordena por tiempo como texto', () => {
    const a = uuidv7(() => 1_000, unos);
    const b = uuidv7(() => 1_001, ceros);
    expect(a < b).toBe(true);
  });

  it('un reloj inválido lanza en vez de inventar un id', () => {
    expect(() => uuidv7(() => Number.NaN)).toThrow(RangeError);
    expect(() => uuidv7(() => -1)).toThrow(RangeError);
  });

  it('con el azar del sistema no repite', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7(() => 5)));
    expect(ids.size).toBe(1000);
  });
});

describe('fecha agronómica en el huso de la finca (P8)', () => {
  it.each([
    // 23:59 del 30 de septiembre en Bogotá ya es 1 de octubre en UTC.
    ['2026-10-01T04:59:00Z', '2026-09-30'],
    ['2026-10-01T05:00:00Z', '2026-10-01'],
    // Cambio de año y 29 de febrero.
    ['2027-01-01T04:30:00Z', '2026-12-31'],
    ['2028-03-01T04:00:00Z', '2028-02-29'],
    // 18:59 y 19:01 en Bogotá, alrededor del reinicio de cuota de D1 (00:00 UTC): mismo día.
    ['2026-10-15T23:59:00Z', '2026-10-15'],
    ['2026-10-16T00:01:00Z', '2026-10-15'],
  ])('%s → %s en America/Bogota', (iso, esperado) => {
    expect(fechaAgronomica(Date.parse(iso))).toBe(esperado);
  });

  it('otro huso da otro día para el mismo instante', () => {
    const ms = Date.parse('2026-10-01T04:59:00Z');
    expect(fechaAgronomica(ms, 'Pacific/Kiritimati')).toBe('2026-10-01');
    expect(fechaAgronomica(ms, 'America/Bogota')).toBe('2026-09-30');
  });
});

describe('días entre fechas agronómicas (HU-E3.4, CA4, P8)', () => {
  it.each([
    ['2026-10-15', '2026-10-15', 0],
    ['2026-10-15', '2026-11-01', 17], // cruza fin de mes
    ['2026-10-15', '2027-01-10', 87], // cruza fin de año
    ['2028-02-28', '2028-03-01', 2], // 29 de febrero
    ['2027-02-28', '2027-03-01', 1], // año no bisiesto
    ['2026-10-20', '2026-10-15', -5],
  ])('de %s a %s: %d días', (desde, hasta, dias) => {
    expect(diasEntre(desde, hasta)).toBe(dias);
  });

  it('no depende del huso del teléfono: usa el día agronómico de la finca', () => {
    // 23:30 del 31 de diciembre en Bogotá ya es 1 de enero en UTC y en Kiritimati.
    const ms = Date.parse('2027-01-01T04:30:00Z');
    expect(diasEntre('2026-10-15', fechaAgronomica(ms))).toBe(77);
    expect(diasEntre('2026-10-15', fechaAgronomica(ms, 'Pacific/Kiritimati'))).toBe(78);
  });

  it('una fecha ilegible lanza; no devuelve NaN (P1)', () => {
    expect(() => diasEntre('15/10/2026', '2026-10-20')).toThrow(RangeError);
  });
});
