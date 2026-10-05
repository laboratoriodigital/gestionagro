/**
 * HU-C1.2: el precio de cada plan por periodo (PLATAFORMA §4.2 y §4.8, ADR-22). Los `planes.json`
 * se leen de donde dice `productos.json` (P2); cada caso malo es su control negativo (P5).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fallasDeCobro, PERIODOS, type PlanConCobro } from '@ed1/productos';
import { describe, expect, it } from 'vitest';
import { cargarProductos } from '../../scripts/lib/registro-productos.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const leer = (ruta: string) => JSON.parse(readFileSync(join(RAIZ, ruta), 'utf8'));

const finca = (cobro: Record<string, number>, mensual?: number): PlanConCobro => ({
  id: 'finca',
  ...(mensual === undefined ? {} : { cobro_mensual_cop: mensual }),
  cobro,
});

describe('los planes reales', () => {
  it.each(cargarProductos().productos.map((p) => [p.id, p.planes]))(
    '%s (%s) cumple las reglas del cobro por periodo',
    (_producto, ruta) => {
      expect(fallasDeCobro(leer(ruta).planes)).toEqual([]);
    },
  );

  it('el plan Finca del agro ofrece los cuatro periodos, con cobro[1] igual al mensual de hoy', () => {
    const plan = leer('content/agro/cuaderno/planes.json').planes.find(
      (p: PlanConCobro) => p.id === 'finca',
    ) as PlanConCobro;
    expect(
      Object.keys(plan.cobro ?? {})
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([...PERIODOS]);
    expect(plan.cobro?.['1']).toBe(plan.cobro_mensual_cop);
  });

  it('los periodos son los de la migración 0006 (P2): la tabla `periodo` y PERIODOS dicen lo mismo', () => {
    const sql = readFileSync(
      join(RAIZ, 'docs/plataforma/sql/core/0006_dimension_de_producto.sql'),
      'utf8',
    );
    const siembra = /INSERT INTO periodo \(meses, nombre\)\s*VALUES ([^;]+);/.exec(sql)?.[1] ?? '';
    const meses = [...siembra.matchAll(/\((\d+),/g)].map((m) => Number(m[1]));
    expect(meses).toEqual([...PERIODOS]);
  });
});

describe('las reglas', () => {
  it('acepta la propuesta de PLATAFORMA §4.2', () => {
    expect(fallasDeCobro([finca({ 1: 39000, 3: 111000, 6: 210000, 12: 390000 }, 39000)])).toEqual(
      [],
    );
  });

  it('un plan sin cobro no tiene nada que revisar', () => {
    expect(fallasDeCobro([{ id: 'gratuito' }])).toEqual([]);
  });

  it('rechaza un semestral más caro que seis meses, nombrando los dos periodos', () => {
    expect(fallasDeCobro([finca({ 1: 39000, 6: 240000 })])).toEqual([
      '«finca»: a 6 meses el mes sale más caro (40000) que a 1 (39000)',
    ]);
  });

  it('rechaza un periodo que no existe', () => {
    expect(fallasDeCobro([finca({ 1: 39000, 2: 76000 })])).toEqual([
      '«finca» cobra 2 meses, que no es un periodo (1, 3, 6, 12)',
    ]);
  });

  it('rechaza decimales y montos por debajo del mínimo de Bold', () => {
    expect(fallasDeCobro([finca({ 1: 39000.5, 3: 900 })])).toEqual([
      '«finca» cobra 39000.5 por 1 meses: tiene que ser un entero de al menos COP 1000',
      '«finca» cobra 900 por 3 meses: tiene que ser un entero de al menos COP 1000',
    ]);
  });

  it('rechaza un cobro[1] distinto del cobro mensual mientras existan los dos campos', () => {
    expect(fallasDeCobro([finca({ 1: 40000 }, 39000)])).toEqual([
      '«finca»: cobro["1"] (40000) no es cobro_mensual_cop (39000)',
    ]);
  });
});
