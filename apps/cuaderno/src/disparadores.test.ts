import { describe, expect, it } from 'vitest';
import { debeSincronizar, ENTRE_REVISIONES_AL_VOLVER_MS, type Situacion } from './disparadores.ts';

const base: Situacion = {
  ahora: 1_000_000,
  enLinea: true,
  corriendo: false,
  esperarHasta: 0,
  ultima: 0,
  pendientes: 1,
};

describe('cuándo sincronizar (bitácora agro 22)', () => {
  it('después de guardar, si hay algo en la cola', () => {
    expect(debeSincronizar('guardado', base)).toBe(true);
    expect(debeSincronizar('guardado', { ...base, pendientes: 0 })).toBe(false);
  });

  it('al volver a la app, como máximo cada 30 s', () => {
    expect(
      debeSincronizar('visible', { ...base, ultima: base.ahora - ENTRE_REVISIONES_AL_VOLVER_MS }),
    ).toBe(true);
    expect(debeSincronizar('visible', { ...base, ultima: base.ahora - 10_000 })).toBe(false);
  });

  it.each([
    ['sin señal', { enLinea: false }],
    ['con otra sincronización corriendo', { corriendo: true }],
    ['antes de la espera que pidió la nube', { esperarHasta: base.ahora + 60_000 }],
  ])('nunca %s', (_caso, cambio) => {
    expect(debeSincronizar('guardado', { ...base, ...cambio })).toBe(false);
    expect(debeSincronizar('visible', { ...base, ...cambio })).toBe(false);
  });
});
