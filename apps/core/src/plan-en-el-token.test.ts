/**
 * HU-C4.3: el plan del token v2 ya trae la gracia de su producto, para que la celda aplique sus
 * límites sin llamar al CORE ni saber de gracias (PLATAFORMA §4.6).
 */
import type { Producto } from '@ed1/productos';
import { describe, expect, it } from 'vitest';
import { CATALOGO, type CatalogoDelCore, planEnElToken } from './productos.ts';

const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.UTC(2026, 10, 30, 12);
const vence = (dias: number) => new Date(AHORA + dias * DIA).toISOString();

const catalogo: CatalogoDelCore = {
  ...CATALOGO,
  productos: [
    ...CATALOGO.productos,
    { ...(CATALOGO.productos[0] as Producto), id: 'tienda', gracia_dias: 7 },
  ],
  planes: {
    ...CATALOGO.planes,
    tienda: [
      { id: 'semilla', nombre: 'Semilla', gratuito: true },
      { id: 'vitrina', nombre: 'Vitrina', cobro_mensual_cop: 25000 },
    ],
  },
};

describe('HU-C4.3 · el plan en el token', () => {
  it('sin vencimiento, el plan tal cual', () => {
    expect(
      planEnElToken(
        catalogo,
        { producto: 'agro', plan_pagado: 'gratuito', vence_pagado: null },
        AHORA,
      ),
    ).toEqual({ plan: 'gratuito', plan_vence: null });
  });

  it('el agro no tiene gracia: vencido es gratuito', () => {
    const org = { producto: 'agro', plan_pagado: 'finca' };
    expect(planEnElToken(catalogo, { ...org, vence_pagado: vence(3) }, AHORA)).toEqual({
      plan: 'finca',
      plan_vence: Math.floor((AHORA + 3 * DIA) / 1000),
    });
    expect(planEnElToken(catalogo, { ...org, vence_pagado: vence(-1) }, AHORA)).toEqual({
      plan: 'gratuito',
      plan_vence: null,
    });
  });

  it('con 7 días de gracia, vencido hace 3 días sigue pagado, y el vencimiento ya la trae', () => {
    const org = { producto: 'tienda', plan_pagado: 'vitrina', vence_pagado: vence(-3) };
    expect(planEnElToken(catalogo, org, AHORA)).toEqual({
      plan: 'vitrina',
      plan_vence: Math.floor((AHORA + 4 * DIA) / 1000),
    });
  });

  it('pasada la gracia, el gratuito de su producto, no el de otro', () => {
    const org = { producto: 'tienda', plan_pagado: 'vitrina', vence_pagado: vence(-8) };
    expect(planEnElToken(catalogo, org, AHORA)).toEqual({ plan: 'semilla', plan_vence: null });
  });
});
