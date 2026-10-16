/**
 * HU-T6.1 y HU-T6.3: el botón de enviar dice lo primero que falta, y el enlace de seguimiento se
 * lee del fragmento, nunca de otra parte.
 */
import { describe, expect, it } from 'vitest';
import {
  celularValido,
  estadoDeLaSolicitud,
  estadoDeLaVenta,
  faltaDeLaEntrega,
  leerFragmento,
  leerRadicado,
  TEXTO_SIN_EL_PAGO,
  vueltaDelPago,
} from './venta.ts';

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

describe('pagar en línea (HU-T11.4)', () => {
  const enLinea = { ...listo, forma: 'en_linea' };
  it('con los datos de entrega, «Pagar en línea»', () => {
    expect(estadoDeLaVenta({ ...enLinea, entrega: true })).toEqual({
      listo: true,
      texto: 'Pagar en línea',
    });
  });

  it('❌ sin el nombre y el celular de quien recibe, no paga', () => {
    expect(estadoDeLaVenta({ ...enLinea, entrega: false })).toEqual({
      listo: false,
      texto: 'Escribe tu nombre y tu celular',
      falta: 'entrega',
    });
    // Por WhatsApp no se piden: se dan en el chat.
    expect(estadoDeLaVenta({ ...listo, entrega: false }).listo).toBe(true);
  });

  it('el celular es de Colombia, con o sin +57', () => {
    expect(celularValido('3001234567')).toBe(true);
    expect(celularValido('+57 300 123 4567')).toBe(true);
    expect(celularValido('300 123 456')).toBe(false);
    expect(celularValido('6041234567')).toBe(false);
    expect(faltaDeLaEntrega({ nombre: 'Ensayo Dos Compradora', celular: '3001234567' })).toBeNull();
    expect(faltaDeLaEntrega({ nombre: ' ', celular: '3001234567' })).toBe('nombre');
    expect(faltaDeLaEntrega({ nombre: 'Ensayo Dos', celular: '12345' })).toBe('celular');
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

describe('volver de Bold (HU-T11.9 CA2)', () => {
  it('pagado: el carrito se vacía y va al pedido; en proceso, se queda como está', () => {
    expect(vueltaDelPago('pagado', true)).toEqual({
      carrito: 'vaciar',
      irAlPedido: true,
      texto: null,
    });
    expect(vueltaDelPago('revisar', true).carrito).toBe('vaciar');
    expect(vueltaDelPago('esperando', true)).toEqual({
      carrito: 'conservar',
      irAlPedido: true,
      texto: null,
    });
  });

  it('❌ un pago que no pasó deja los productos en el carrito, con otro código, y no va al pedido', () => {
    for (const estado of ['rechazado', 'vencido']) {
      const v = vueltaDelPago(estado, true);
      expect(v.carrito, estado).toBe('renovar');
      expect(v.irAlPedido, estado).toBe(false);
      expect(v.texto, estado).toMatch(/siguen en el carrito/);
    }
  });

  it('❌ sin token (otro navegador) o sin respuesta: explica cómo encontrar el pedido, sin un error', () => {
    expect(vueltaDelPago(null, false)).toEqual({
      carrito: 'conservar',
      irAlPedido: false,
      texto: TEXTO_SIN_EL_PAGO,
    });
    expect(TEXTO_SIN_EL_PAGO).not.toMatch(/error/i);
    // Con el enlace guardado en este navegador, lo abre.
    expect(vueltaDelPago(null, true)).toMatchObject({ carrito: 'conservar', irAlPedido: true });
  });
});
