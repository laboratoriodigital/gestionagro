/**
 * HU-T6.1 y HU-T6.3: el botón de enviar dice lo primero que falta, y el enlace de seguimiento se
 * lee del fragmento, nunca de otra parte.
 */
import { describe, expect, it } from 'vitest';
import { estadoDeLaSolicitud, estadoDeLaVenta, leerFragmento, leerRadicado } from './venta.ts';

const listo = { lineas: 2, forma: 'transferencia', hayEnvios: true, envio: 'e1', acepta: true };

describe('qué falta para enviar (HU-T6.1)', () => {
  it('con todo, «Enviar por WhatsApp»', () => {
    expect(estadoDeLaVenta(listo)).toEqual({ listo: true, texto: 'Enviar por WhatsApp' });
  });

  it.each([
    ['sin líneas', { lineas: 0 }, 'lineas', 'Tu pedido está vacío'],
    ['sin forma de pago', { forma: null }, 'forma', 'Elige cómo pagar'],
    ['sin envío, si la tienda tiene envíos', { envio: null }, 'envio', 'Elige cómo te llega'],
    [
      '❌ sin aceptar: la casilla nunca viene marcada',
      { acepta: false },
      'acepta',
      'Acepta los términos para enviar',
    ],
  ])('%s', (_caso, cambio, falta, texto) => {
    expect(estadoDeLaVenta({ ...listo, ...cambio })).toEqual({ listo: false, texto, falta });
  });

  it('una tienda sin envíos no pide elegir uno', () => {
    expect(estadoDeLaVenta({ ...listo, hayEnvios: false, envio: null }).listo).toBe(true);
  });
});

describe('el enlace de seguimiento (HU-T6.3)', () => {
  it('lee el código y el secreto del fragmento', () => {
    expect(leerFragmento('#c=ABC123&s=abcdefghijklmnopqrstuv')).toEqual({
      codigo: 'ABC123',
      secreto: 'abcdefghijklmnopqrstuv',
    });
  });

  it.each(['', '#c=ABC123', '#c=ABCDEI&s=abcdefghijklmnopqrstuv', '#c=ABC123&s=corto'])(
    '❌ «%s» no es un enlace',
    (hash) => {
      expect(leerFragmento(hash)).toBeNull();
    },
  );
});

describe('la solicitud (HU-T6.4)', () => {
  const lista = {
    tipo: 'queja',
    texto: 'El pedido llegó roto',
    contacto: 'ensayo@ejemplo.co',
    acepta: true,
  };

  it('con todo, «Enviar la solicitud»', () => {
    expect(estadoDeLaSolicitud(lista)).toEqual({ listo: true, texto: 'Enviar la solicitud' });
  });

  it.each([
    ['sin tipo', { tipo: '' }, 'tipo'],
    ['un texto de menos de 10 letras', { texto: '  corto   ' }, 'texto'],
    ['sin contacto', { contacto: 'abc' }, 'contacto'],
    ['❌ sin autorizar: la casilla nunca viene marcada', { acepta: false }, 'acepta'],
  ])('%s', (_caso, cambio, falta) => {
    expect(estadoDeLaSolicitud({ ...lista, ...cambio })).toMatchObject({ listo: false, falta });
  });

  it('lee el radicado y el secreto del fragmento', () => {
    expect(leerRadicado('#r=12&s=abcdefghijklmnopqrstuv')).toEqual({
      radicado: 12,
      secreto: 'abcdefghijklmnopqrstuv',
    });
  });

  it.each([
    '',
    '#r=12',
    '#r=0&s=abcdefghijklmnopqrstuv',
    '#r=R-12&s=abcdefghijklmnopqrstuv',
    '#r=12&s=corto',
  ])('❌ «%s» no es un enlace de solicitud', (hash) => {
    expect(leerRadicado(hash)).toBeNull();
  });
});
