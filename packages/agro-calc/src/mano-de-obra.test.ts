import { describe, expect, it } from 'vitest';
import casos from '../casos/mano-de-obra.json' with { type: 'json' };
import { costoDeHoras, HORAS_POR_JORNAL, valorVigente } from './mano-de-obra.ts';

describe('mano de obra (HU-E7.2)', () => {
  it.each(casos.vigencia)('CA1: $nombre', (c) => {
    expect(valorVigente(c.valores, c.fecha)).toBe(c.esperado);
  });

  it.each(casos.costo)('$horas h con un jornal de $valor → $esperado', (c) => {
    expect(costoDeHoras(c.horas, c.valor)).toBe(c.esperado);
  });

  it('un jornal son 8 horas, y unas horas que no son número no dan costo', () => {
    expect(HORAS_POR_JORNAL).toBe(8);
    expect(costoDeHoras(Number.NaN, 60000)).toBeNull();
  });
});
