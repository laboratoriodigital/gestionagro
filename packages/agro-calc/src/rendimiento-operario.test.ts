import { describe, expect, it } from 'vitest';
import casos from '../casos/rendimiento-operario.json' with { type: 'json' };
import { rendimientoPorOperario } from './rendimiento-operario.ts';

describe('rendimiento por operario (HU-E7.4)', () => {
  it.each(casos.casos)('$nombre', (c) => {
    expect(rendimientoPorOperario(c.cosechas)).toEqual(c.esperado);
  });
});
