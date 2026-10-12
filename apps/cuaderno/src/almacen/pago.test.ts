/**
 * HU-C5.7: los periodos que ofrece la pantalla de Planes salen de `cobro` en planes.json, la misma
 * fuente de los precios del CORE (P2). Un periodo sin precio no aparece y nunca se muestra «COP 0».
 */
import { describe, expect, it } from 'vitest';
import configPlanes from '../../../../content/agro/cuaderno/planes.json' with { type: 'json' };
import { nombreDelPeriodo, periodosDe, pesos } from './pago.ts';

describe('HU-C5.7 · los periodos de un plan', () => {
  it('el plan Finca ofrece 1, 3, 6 y 12 meses, con el total, el valor por mes y el ahorro', () => {
    expect(periodosDe('finca')).toEqual([
      { meses: 1, total: 39000, porMes: 39000, ahorro: 0 },
      { meses: 3, total: 111000, porMes: 37000, ahorro: 6000 },
      { meses: 6, total: 210000, porMes: 35000, ahorro: 24000 },
      { meses: 12, total: 390000, porMes: 32500, ahorro: 78000 },
    ]);
  });

  it('a más meses, el mes nunca sale más caro', () => {
    const porMes = periodosDe('finca').map((p) => p.porMes);
    expect([...porMes].sort((a, b) => b - a)).toEqual(porMes);
  });

  it('CA3 ❌ · un plan sin cobro en línea no ofrece periodos, y ninguno vale COP 0', () => {
    expect(periodosDe('gratuito')).toEqual([]);
    expect(periodosDe('exportador')).toEqual([]);
    expect(periodosDe('no-existe')).toEqual([]);
    for (const plan of configPlanes.planes)
      for (const p of periodosDe(plan.id)) expect(pesos(p.total)).not.toBe('COP 0');
  });

  it('CA3 ❌ · un periodo con monto 0 o sin número se cae de la lista (control con un plan falso)', () => {
    const planes = configPlanes.planes as { id: string; cobro?: Record<string, number> }[];
    planes.push({ id: 'prueba-c57', cobro: { '1': 20000, '3': 0, seis: 50000, '12': 200000 } });
    try {
      expect(periodosDe('prueba-c57').map((p) => p.meses)).toEqual([1, 12]);
    } finally {
      planes.pop();
    }
  });

  it('el botón dice «un mes» o «N meses»', () => {
    expect(nombreDelPeriodo(1)).toBe('un mes');
    expect(nombreDelPeriodo(6)).toBe('6 meses');
  });
});
