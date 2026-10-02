import { describe, expect, it } from 'vitest';
import casos from '../casos/costo-unitario.json' with { type: 'json' };
import { costoUnitario } from './costo-unitario.ts';

describe('costo por unidad y margen (HU-E7.3)', () => {
  it.each(casos.casos)('$nombre', (c) => {
    expect(costoUnitario(c.entrada)).toEqual(c.esperado);
  });

  it('una cantidad vendible que no es número no da costo por unidad (P1)', () => {
    const base = casos.casos[0]?.entrada;
    if (!base) throw new Error('faltan casos');
    expect(costoUnitario({ ...base, vendible: Number.NaN }).porUnidad).toBeNull();
  });
});
