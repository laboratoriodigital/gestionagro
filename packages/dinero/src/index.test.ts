import { describe, expect, it } from 'vitest';
import {
  calcularTotal,
  cobrableEnLinea,
  formatearPesos,
  LIMITES,
  MontoIlegible,
  pesos,
  repartirDescuento,
} from './index.ts';

describe('formato de pesos sin Intl', () => {
  it.each([
    [0, '$0'],
    [900, '$900'],
    [1000, '$1.000'],
    [80000, '$80.000'],
    [1234567, '$1.234.567'],
    [5_000_000, '$5.000.000'],
    [-5000, '-$5.000'],
  ])('%i → %s', (valor, esperado) => {
    expect(formatearPesos(valor)).toBe(esperado);
  });

  it('un decimal no se formatea: no hay centavos', () => {
    expect(() => formatearPesos(10.5)).toThrow(MontoIlegible);
  });
});

describe('un monto que no se puede leer nunca vale 0 (bitácora ecommerce, Críticos)', () => {
  it.each([
    ['$9.000'],
    ['9,000'],
    [''],
    [null],
    [undefined],
    [Number.NaN],
    [9000.5],
    [-1],
    [Number.POSITIVE_INFINITY],
  ])('%j lanza y nombra el campo', (valor) => {
    expect(() => pesos(valor, 'precio')).toThrow(/«precio»/);
  });

  it('una línea con precio ilegible no da un total con ese producto gratis', () => {
    expect(() =>
      calcularTotal({ lineas: [{ precioCop: '80000' as unknown as number, cantidad: 1 }] }),
    ).toThrow(MontoIlegible);
  });
});

describe('el total de TIENDA-3.0 §6', () => {
  const lineas = [
    { precioCop: 80_000, cantidad: 2 },
    { precioCop: 15_500, cantidad: 1 },
  ];

  it('sin cupón ni envío', () => {
    expect(calcularTotal({ lineas })).toEqual({
      subtotal: 175_500,
      descuento: 0,
      descuentoPromociones: 0,
      descuentoCupon: 0,
      envio: 0,
      total: 175_500,
      avisos: [],
    });
  });

  it('porcentaje: el redondeo favorece al comprador (techo del descuento)', () => {
    // 15 % de 175.500 = 26.325 exacto; con 33.333 de subtotal y 10 %: 3.333,3 → 3.334.
    expect(calcularTotal({ lineas, cupon: { tipo: 'porcentaje', porcentaje: 15 } }).descuento).toBe(
      26_325,
    );
    const r = calcularTotal({
      lineas: [{ precioCop: 33_333, cantidad: 1 }],
      cupon: { tipo: 'porcentaje', porcentaje: 10 },
    });
    expect(r.descuento).toBe(3_334);
    expect(r.total).toBe(29_999);
  });

  it('valor: nunca descuenta más que el subtotal', () => {
    const r = calcularTotal({
      lineas: [{ precioCop: 10_000, cantidad: 1 }],
      cupon: { tipo: 'valor', valorCop: 50_000 },
    });
    expect(r.descuento).toBe(10_000);
    expect(r.total).toBe(0);
  });

  it('el envío es gratis desde el subtotal con el descuento ya aplicado', () => {
    const envio = { precioCop: 12_000, gratisDesdeCop: 150_000 };
    expect(calcularTotal({ lineas, envio }).envio).toBe(0);
    // 175.500 − 30.000 = 145.500 < 150.000: se cobra el envío.
    const conCupon = calcularTotal({ lineas, envio, cupon: { tipo: 'valor', valorCop: 30_000 } });
    expect(conCupon.envio).toBe(12_000);
    expect(conCupon.total).toBe(175_500 - 30_000 + 12_000);
    expect(
      calcularTotal({ lineas, envio: { precioCop: 12_000, gratisDesdeCop: null } }).envio,
    ).toBe(12_000);
  });

  it('envío gratis por cupón: no descuenta, pone el envío en 0', () => {
    const r = calcularTotal({
      lineas,
      envio: { precioCop: 12_000, gratisDesdeCop: null },
      cupon: { tipo: 'envio_gratis' },
    });
    expect(r.descuento).toBe(0);
    expect(r.envio).toBe(0);
  });

  it('un cupón bajo su mínimo no se aplica y lo dice', () => {
    const r = calcularTotal({
      lineas,
      cupon: { tipo: 'porcentaje', porcentaje: 10, minimoCop: 200_000 },
    });
    expect(r.descuento).toBe(0);
    expect(r.avisos).toEqual(['cupon_bajo_el_minimo']);
  });

  it('cuadra siempre: total = subtotal − descuento + envío (el CHECK de la base)', () => {
    for (let p = 1; p <= 100; p++) {
      const r = calcularTotal({
        lineas: [{ precioCop: 12_345 + p, cantidad: (p % 7) + 1 }],
        cupon: { tipo: 'porcentaje', porcentaje: p },
        envio: { precioCop: 9_000, gratisDesdeCop: 60_000 },
      });
      expect(r.total).toBe(r.subtotal - r.descuento + r.envio);
      expect(r.descuento).toBeLessThanOrEqual(r.subtotal);
    }
  });

  it('respeta los topes de líneas y unidades', () => {
    expect(() => calcularTotal({ lineas: [] })).toThrow(RangeError);
    const muchas = Array.from({ length: LIMITES.lineas + 1 }, () => ({
      precioCop: 1,
      cantidad: 1,
    }));
    expect(() => calcularTotal({ lineas: muchas })).toThrow(RangeError);
    expect(() => calcularTotal({ lineas: [{ precioCop: 1, cantidad: 201 }] })).toThrow(/cantidad/);
    expect(() => calcularTotal({ lineas: [{ precioCop: 1, cantidad: 0 }] })).toThrow(/cantidad/);
    expect(() =>
      calcularTotal({
        lineas: [{ precioCop: 1, cantidad: 1 }],
        cupon: { tipo: 'porcentaje', porcentaje: 0 },
      }),
    ).toThrow(/porcentaje/);
  });
});

describe('cobrable en línea', () => {
  it('entre el mínimo de Bold y el tope', () => {
    expect(cobrableEnLinea(999)).toEqual({ cobrable: false, motivo: 'bajo_el_minimo' });
    expect(cobrableEnLinea(1_000)).toEqual({ cobrable: true });
    expect(cobrableEnLinea(5_000_000)).toEqual({ cobrable: true });
    expect(cobrableEnLinea(5_000_001)).toEqual({ cobrable: false, motivo: 'sobre_el_tope' });
  });

  it('el comercio puede bajar el tope, nunca subirlo sobre el de Bold', () => {
    expect(cobrableEnLinea(600_000, 500_000)).toEqual({ cobrable: false, motivo: 'sobre_el_tope' });
    expect(cobrableEnLinea(6_000_000, 9_000_000)).toEqual({
      cobrable: false,
      motivo: 'sobre_el_tope',
    });
  });
});

describe('reparto del descuento por mayor residuo', () => {
  it('suma exacto', () => {
    const r = repartirDescuento([10_000, 10_000, 10_000], 1_000);
    expect(r).toEqual([334, 333, 333]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(1_000);
  });

  it('es proporcional y determinista ante empates', () => {
    expect(repartirDescuento([160_000, 15_500], 26_325)).toEqual([24_000, 2_325]);
    expect(repartirDescuento([1, 1], 1)).toEqual([1, 0]);
  });

  it('cuadra en muchos casos', () => {
    for (let d = 0; d <= 5_000; d += 37) {
      const totales = [1_234, 5_678, 9, 3_000];
      const r = repartirDescuento(totales, d);
      expect(r.reduce((a, b) => a + b, 0)).toBe(d);
      for (const [i, x] of r.entries()) expect(x).toBeLessThanOrEqual(totales[i] ?? 0);
    }
  });

  it('un descuento mayor que el total lanza', () => {
    expect(() => repartirDescuento([100], 101)).toThrow(RangeError);
  });
});

describe('HU-P1.2 · las promociones por cantidad', () => {
  const pan = (cantidad: number) => ({ precioCop: 1_500, cantidad, producto: 'pan' });

  it('lleva 3 y paga 2: por cada 3, una de regalo; con 2 no hay', () => {
    const lleva3 = { pan: { tipo: 'regalo', lleva: 3, paga: 2 } } as const;
    expect(calcularTotal({ lineas: [pan(2)], promociones: lleva3 }).descuento).toBe(0);
    expect(calcularTotal({ lineas: [pan(3)], promociones: lleva3 }).descuento).toBe(1_500);
    expect(calcularTotal({ lineas: [pan(7)], promociones: lleva3 }).descuento).toBe(3_000);
  });

  it('el regalo es la unidad más barata del producto, sumando sus combinaciones', () => {
    const camisa = (precioCop: number, cantidad: number) => ({
      precioCop,
      cantidad,
      producto: 'camisa',
    });
    const r = calcularTotal({
      lineas: [camisa(129_000, 2), camisa(99_000, 1)],
      promociones: { camisa: { tipo: 'regalo', lleva: 3, paga: 2 } },
    });
    expect(r.descuentoPromociones).toBe(99_000);
  });

  it('porcentaje desde N unidades, con el redondeo a favor del comprador', () => {
    const p = { pan: { tipo: 'porcentaje', porcentaje: 10, desdeUnidades: 2 } } as const;
    expect(calcularTotal({ lineas: [pan(1)], promociones: p }).descuento).toBe(0);
    // 3 × 1.500 = 4.500; el 10 % es 450.
    expect(calcularTotal({ lineas: [pan(3)], promociones: p }).descuento).toBe(450);
  });

  it('la promoción va primero y el cupón se calcula sobre lo que queda; cada uno dice lo suyo', () => {
    const r = calcularTotal({
      lineas: [pan(3), { precioCop: 10_000, cantidad: 1, producto: 'torta' }],
      promociones: { pan: { tipo: 'regalo', lleva: 3, paga: 2 } },
      cupon: { tipo: 'porcentaje', porcentaje: 10, minimoCop: 13_000 },
    });
    // 14.500 − 1.500 = 13.000; el cupón da el 10 % de eso.
    expect(r).toMatchObject({
      subtotal: 14_500,
      descuentoPromociones: 1_500,
      descuentoCupon: 1_300,
      descuento: 2_800,
      total: 11_700,
    });
  });

  it('❌ una promoción imposible lanza: nunca regala de más ni descuenta el 100 %', () => {
    expect(() =>
      calcularTotal({
        lineas: [pan(3)],
        promociones: { pan: { tipo: 'regalo', lleva: 3, paga: 3 } },
      }),
    ).toThrow(MontoIlegible);
    expect(() =>
      calcularTotal({
        lineas: [pan(3)],
        promociones: { pan: { tipo: 'porcentaje', porcentaje: 100, desdeUnidades: 2 } },
      }),
    ).toThrow(MontoIlegible);
  });
});
