import { describe, expect, it } from 'vitest';
import { id, instanteDeUuidv7, uuidv7 } from './index.ts';

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

describe('el esquema de un id', () => {
  it('acepta un UUIDv7 generado aquí', () => {
    expect(id.safeParse(uuidv7(() => Date.UTC(2026, 9, 5), unos)).success).toBe(true);
  });

  it('rechaza un UUID de otra versión y lo dice en palabras', () => {
    const r = id.safeParse('f47ac10b-58cc-4372-a567-0e02b2c3d479');
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('debe ser un UUIDv7');
  });
});
