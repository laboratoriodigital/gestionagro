import { describe, expect, it } from 'vitest';
import casos from '../casos/bodega.json' with { type: 'json' };
import { bodega, type Movimiento } from './bodega.ts';

const cerca = (a: number | null | undefined, b: number | null) =>
  a === null || b === null ? a === b : Math.abs((a ?? Number.NaN) - b) <= casos.tolerancia;

describe('bodega con costo promedio ponderado (HU-E7.1, CA2 y CA3)', () => {
  it.each(casos.casos)('$nombre', (c) => {
    const r = bodega(c.movimientos as Movimiento[]);
    expect(cerca(r.existencia, c.existencia)).toBe(true);
    expect(cerca(r.costoUnitario, c.costoUnitario)).toBe(true);
    for (const [id, costo] of Object.entries(c.salidas)) {
      expect(cerca(r.costoDeSalida.get(id), costo as number | null)).toBe(true);
    }
    expect(r.quedoNegativa).toBe(c.quedoNegativa);
  });

  it('una cantidad que no es número no se cuenta (no da NaN)', () => {
    const r = bodega([
      { id: 'c1', tipo: 'entrada', cantidad: 10, precioTotal: 100 },
      { id: 'x', tipo: 'salida', cantidad: Number.NaN },
    ]);
    expect(r.existencia).toBe(10);
    expect(r.costoUnitario).toBe(10);
  });
});
