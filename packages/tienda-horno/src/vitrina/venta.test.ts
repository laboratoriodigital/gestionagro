/**
 * HU-T6.1 y HU-T6.3: el botón de enviar dice lo primero que falta, y el enlace de seguimiento se
 * lee del fragmento, nunca de otra parte.
 */
import { describe, expect, it } from 'vitest';
import { estadoDeLaVenta, leerFragmento } from './venta.ts';

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
