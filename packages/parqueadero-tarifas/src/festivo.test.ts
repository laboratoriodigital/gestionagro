/**
 * La tarifa de domingos y festivos (HU-Q13.2) y la mensualidad por días hábiles (HU-Q13.3), con
 * el calendario de Colombia de 2026: el domingo 11 y el lunes 12 de octubre (festivo de la Raza,
 * movido al lunes) contra el martes 13, día normal.
 */
import { TARIFA_CARRO } from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { bogota } from './casos.fixture.ts';
import { habilesEntre, liquidar, prorrateo, type ReglasDeTarifa, TarifaInvalida } from './index.ts';

const BASE: ReglasDeTarifa = {
  ...TARIFA_CARRO,
  modo: 'minuto',
  valor: 100,
  fraccion_min: null,
  gracia_min: 0,
  tope_dia: null,
  plena: null,
  nocturna: null,
  perdido: null,
  redondeo: 'ninguno',
};
const CON_FESTIVO: ReglasDeTarifa = { ...BASE, festivo: { valor: 150, plena: null } };

describe('domingos y festivos (HU-Q13.2)', () => {
  it('un minuto que empieza un domingo vale el de festivo; el sábado, el de siempre', () => {
    // Sábado 10 a las 23:50 hasta el domingo 11 a las 00:10: 10 min a 100 y 10 a 150.
    const l = liquidar(
      bogota(2026, 10, 10, 23, 50),
      bogota(2026, 10, 11, 0, 10),
      CON_FESTIVO,
      null,
    );
    expect(l.total).toBe(10 * 100 + 10 * 150);
    expect(l.lineas.map((x) => x.concepto)).toEqual(['tiempo_festivo']);
  });

  it('un festivo entre semana cuenta como domingo; el martes siguiente, no', () => {
    const festivo = liquidar(
      bogota(2026, 10, 12, 9, 0),
      bogota(2026, 10, 12, 9, 30),
      CON_FESTIVO,
      null,
    );
    expect(festivo.total).toBe(30 * 150);
    const martes = liquidar(
      bogota(2026, 10, 13, 9, 0),
      bogota(2026, 10, 13, 9, 30),
      CON_FESTIVO,
      null,
    );
    expect(martes.total).toBe(30 * 100);
    expect(martes.lineas.map((x) => x.concepto)).toEqual(['tiempo']);
  });

  it('❌ sin tarifa de festivo, el domingo cobra como cualquier día (es opcional)', () => {
    const l = liquidar(bogota(2026, 10, 11, 9, 0), bogota(2026, 10, 11, 9, 30), BASE, null);
    expect(l.total).toBe(30 * 100);
    expect(l.lineas.map((x) => x.concepto)).toEqual(['tiempo']);
  });

  it('por fracción, cada fracción vale según el día en que empieza', () => {
    const t: ReglasDeTarifa = {
      ...BASE,
      modo: 'fraccion',
      fraccion_min: 15,
      valor: 1_000,
      festivo: { valor: 1_500, plena: null },
    };
    // De 23:40 del sábado a 00:20 del domingo: fracciones de 23:40, 23:55, 00:10.
    const l = liquidar(bogota(2026, 10, 10, 23, 40), bogota(2026, 10, 11, 0, 20), t, null);
    expect(l.total).toBe(1_000 + 1_000 + 1_500);
  });

  it('la plena de un bloque que empieza en domingo o festivo es la de festivo', () => {
    const t: ReglasDeTarifa = {
      ...BASE,
      plena: { desde_min: 240, valor: 15_000 },
      festivo: { valor: 150, plena: { desde_min: 240, valor: 20_000 } },
    };
    const domingo = liquidar(bogota(2026, 10, 11, 8, 0), bogota(2026, 10, 11, 13, 0), t, null);
    expect(domingo.lineas.map((x) => [x.concepto, x.valor])).toEqual([['plena_festivo', 20_000]]);
    const martes = liquidar(bogota(2026, 10, 13, 8, 0), bogota(2026, 10, 13, 13, 0), t, null);
    expect(martes.lineas.map((x) => [x.concepto, x.valor])).toEqual([['plena', 15_000]]);
  });

  it('el tope por día también vale en domingo', () => {
    const t: ReglasDeTarifa = { ...CON_FESTIVO, tope_dia: 12_000 };
    const l = liquidar(bogota(2026, 10, 11, 8, 0), bogota(2026, 10, 11, 20, 0), t, null);
    expect(l.lineas.map((x) => [x.concepto, x.valor])).toEqual([['tope_dia', 12_000]]);
  });

  it('❌ con tope legal, ni el valor ni la plena de festivo lo pasan', () => {
    const caro: ReglasDeTarifa = {
      ...BASE,
      festivo: { valor: 200, plena: { desde_min: 10, valor: 5_000 } },
    };
    expect(() => liquidar(0, 60_000, caro, 130)).toThrow(TarifaInvalida);
    try {
      liquidar(0, 60_000, caro, 130);
    } catch (e) {
      expect((e as TarifaInvalida).problemas.map((p) => p.campo)).toEqual([
        'festivo.valor',
        'festivo.plena.valor',
      ]);
    }
  });
});

describe('la mensualidad por días hábiles (HU-Q13.3)', () => {
  it('octubre de 2026 tiene 21 hábiles: 22 de lunes a viernes menos el festivo del 12', () => {
    expect(habilesEntre('2026-10-01', '2026-10-31')).toBe(21);
    expect(habilesEntre('2026-10-15', '2026-10-31')).toBe(12);
  });

  it('el mes empezado cobra sus hábiles sobre los del mes entero, a la centena hacia abajo', () => {
    // Del 15 al 31 de un mes que empieza el 1: 12 de 21 hábiles, frente a 17 de 31 calendario.
    expect(prorrateo(300_000, 'mes', '2026-10-01', '2026-10-31', 'habiles')).toBe(300_000);
    expect(prorrateo(300_000, 'mes', '2026-10-15', '2026-11-14', 'habiles')).toBe(300_000);
    const corto = (cuenta: 'habiles' | 'calendario') =>
      prorrateo(300_000, 'mes', '2026-10-15', '2026-10-31', cuenta);
    expect(corto('calendario')).toBe(Math.floor((300_000 * 17) / 31 / 100) * 100);
    expect(corto('habiles')).toBe(
      Math.floor((300_000 * 12) / habilesEntre('2026-10-15', '2026-11-14') / 100) * 100,
    );
  });

  it('sin decir nada, cuenta días calendario, como antes', () => {
    expect(prorrateo(300_000, 'mes', '2026-10-15', '2026-10-31')).toBe(
      prorrateo(300_000, 'mes', '2026-10-15', '2026-10-31', 'calendario'),
    );
  });
});
