/** HU-T10.1: lo que revisan los formularios de envío y de cupón, y cómo se dice un cupón. */
import { describe, expect, it } from 'vitest';
import {
  type CuponDelPanel,
  cuponEnPalabras,
  formularioDeCupon,
  formularioDeEnvio,
  pasaDeLaLey,
  revisarCupon,
  revisarEnvio,
} from './venta.ts';

describe('el formulario de envío', () => {
  const lleno = {
    ...formularioDeEnvio(null),
    nombre: ' Nacional ',
    precio: '15.000',
    diasMax: '5',
  };

  it('manda pesos y días en números, y las ciudades sin repetir; ninguna es todas', () => {
    expect(
      revisarEnvio({
        ...lleno,
        gratisDesde: '$ 150.000',
        ciudades: 'Medellín, Envigado,, Medellín',
      }),
    ).toEqual({
      errores: [],
      cuerpo: {
        nombre: 'Nacional',
        precioCop: 15000,
        gratisDesdeCop: 150000,
        ciudades: ['Medellín', 'Envigado'],
        diasMin: null,
        diasMax: 5,
        activa: true,
      },
    });
    expect(revisarEnvio(lleno).cuerpo.ciudades).toBeNull();
  });

  it('❌ sin nombre, sin plazo máximo o con el mínimo por encima', () => {
    expect(revisarEnvio(formularioDeEnvio(null)).errores.map((e) => e.campo)).toEqual([
      'nombre',
      'diasMax',
    ]);
    expect(revisarEnvio({ ...lleno, diasMin: '8' }).errores).toEqual([
      { campo: 'diasMin', mensaje: 'Los días mínimos pasan de los máximos.' },
    ]);
    expect(revisarEnvio({ ...lleno, precio: 'quince' }).errores.map((e) => e.campo)).toEqual([
      'precio',
    ]);
  });

  it('❌ dice cuándo el plazo pasa de los 30 días calendario (CA1)', () => {
    expect(pasaDeLaLey({ ...lleno, diasMax: '30' })).toBe(false);
    expect(pasaDeLaLey({ ...lleno, diasMax: '31' })).toBe(true);
    expect(pasaDeLaLey({ ...lleno, diasMin: '35', diasMax: '' })).toBe(true);
  });
});

describe('el formulario de cupón', () => {
  it('el código va en mayúsculas; el envío gratis no lleva valor', () => {
    const f = {
      ...formularioDeCupon(null),
      codigo: ' diez-off ',
      tipo: 'porcentaje' as const,
      valor: '10 %',
    };
    expect(revisarCupon({ ...f, usosMaximos: '50', hasta: '2026-10-31' })).toEqual({
      errores: [],
      cuerpo: {
        codigo: 'DIEZ-OFF',
        tipo: 'porcentaje',
        valor: 10,
        minimoCop: 0,
        desde: null,
        hasta: '2026-10-31',
        usosMaximos: 50,
        activo: true,
      },
    });
    expect(revisarCupon({ ...f, tipo: 'envio_gratis', valor: '' }).cuerpo.valor).toBe(0);
  });

  it('❌ un porcentaje de más de 100, un valor vacío, la vigencia al revés y un tope bajo lo usado', () => {
    const f = { ...formularioDeCupon(null), codigo: 'PRUEBA' };
    expect(revisarCupon(f).errores.map((e) => e.campo)).toEqual(['tipo']);
    expect(
      revisarCupon({ ...f, tipo: 'porcentaje', valor: '150' }).errores.map((e) => e.campo),
    ).toEqual(['valor']);
    expect(revisarCupon({ ...f, tipo: 'valor', valor: '' }).errores.map((e) => e.campo)).toEqual([
      'valor',
    ]);
    expect(
      revisarCupon({ ...f, tipo: 'envio_gratis', desde: '2026-10-20', hasta: '2026-10-10' })
        .errores,
    ).toEqual([{ campo: 'hasta', mensaje: 'La vigencia termina antes de empezar.' }]);
    expect(revisarCupon({ ...f, tipo: 'envio_gratis', usosMaximos: '10' }, 12).errores).toEqual([
      { campo: 'usosMaximos', mensaje: 'Ya se usó 12 veces: el tope no puede ser menor.' },
    ]);
    expect(
      revisarCupon({ ...f, codigo: 'con espacio', tipo: 'envio_gratis' }).errores.map(
        (e) => e.campo,
      ),
    ).toEqual(['codigo']);
  });
});

describe('un cupón en palabras', () => {
  const cupon: CuponDelPanel = {
    codigo: 'DIEZ',
    tipo: 'porcentaje',
    valor: 10,
    minimoCop: 60000,
    desde: null,
    hasta: '2026-10-31',
    usosMaximos: 50,
    usos: 3,
    activo: true,
    version: 1,
  };

  it('dice qué descuenta, desde cuánto, hasta cuándo y cuántos usos lleva', () => {
    expect(cuponEnPalabras(cupon)).toBe(
      '10 % de descuento · en compras desde $60.000 · hasta el 31 oct 2026 · 3 de 50 usos',
    );
    expect(
      cuponEnPalabras({
        ...cupon,
        tipo: 'envio_gratis',
        minimoCop: 0,
        hasta: null,
        usosMaximos: null,
        usos: 1,
      }),
    ).toBe('Envío gratis · 1 uso, sin tope');
  });

  it('❌ uno agotado lo dice (CA2)', () => {
    expect(cuponEnPalabras({ ...cupon, usos: 50 })).toContain('agotado: 50 de 50 usos');
  });
});
