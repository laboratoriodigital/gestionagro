import { describe, expect, it } from 'vitest';
import {
  armarTexto,
  enlaceConNumero,
  enlaceParaCompartir,
  normalizarNumero,
  validarTexto,
  WhatsAppInvalido,
} from './index.ts';

describe('normalizarNumero', () => {
  it.each([
    ['300 123 4567', '573001234567'],
    ['+57 300 123 4567', '573001234567'],
    ['573001234567', '573001234567'],
    ['(300) 123-4567', '573001234567'],
    ['0057 300 123 4567', '573001234567'],
    ['601 234 5678', '576012345678'],
    ['+1 415 555 0100', '14155550100'],
    ['+593 99 123 4567', '593991234567'],
  ])('%s da %s', (entrada, esperado) => {
    expect(normalizarNumero(entrada)).toBe(esperado);
  });

  it.each([
    ['', 'vacío'],
    ['300 123 456', 'un dígito de menos'],
    ['3001234567a', 'una letra'],
    ['123', 'corto'],
    ['+57 300 123 456', '57 sin sus 10 dígitos'],
    ['+1234567890123456', 'más de 15 dígitos'],
    ['200 123 4567', 'diez dígitos que no son de Colombia ni traen indicativo'],
  ])('«%s» lanza (%s): nunca inventa un número', (entrada) => {
    expect(() => normalizarNumero(entrada)).toThrow(WhatsAppInvalido);
  });

  it('el error nombra el número y el motivo', () => {
    try {
      normalizarNumero('300 123 456');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(WhatsAppInvalido);
      expect((e as WhatsAppInvalido).motivo).toBe('numero');
      expect((e as Error).message).toContain('300 123 456');
    }
  });
});

describe('el texto', () => {
  it.each(['🚗 Su recibo', '  🅿️ Su recibo', '🇨🇴 Recibo', '\u{FE0F}Recibo'])(
    '«%s» empieza con emoji y lanza',
    (texto) => {
      expect(() => validarTexto(texto)).toThrow(/emoji/);
    },
  );

  it('un emoji después del texto sí se permite', () => {
    expect(validarTexto('Gracias 🚗')).toBe('Gracias 🚗');
  });

  it('un texto vacío lanza', () => {
    expect(() => validarTexto('  \n ')).toThrow(/vacío/);
  });

  it('armarTexto deja el enlace en su propia línea', () => {
    const texto = armarTexto([
      'Recibo de entrada A-000123 - Parqueadero Ensayo Uno',
      'Su recibo:',
      ' https://parqueadero.laboratorio-digital.app/r/#1.q1Yq ',
    ]);
    expect(texto.split('\n')[2]).toBe('https://parqueadero.laboratorio-digital.app/r/#1.q1Yq');
  });

  it('armarTexto lanza si el enlace comparte línea con otro texto', () => {
    expect(() =>
      armarTexto(['Su recibo: https://parqueadero.laboratorio-digital.app/r/#1.q1Yq']),
    ).toThrow(/solo en su línea/);
  });
});

describe('los enlaces', () => {
  const texto = 'Recibo A-1 – Placa ABC123\nCalle 5 # 3-20 & Cra 4\n¿Dudas? Ñandú';

  it('enlaceConNumero codifica tildes, #, & y saltos de línea', () => {
    const enlace = enlaceConNumero('300 123 4567', texto);
    expect(enlace.startsWith('https://wa.me/573001234567?text=')).toBe(true);
    const parametro = enlace.split('?text=')[1] ?? '';
    expect(parametro).not.toMatch(/[\s#&?]/);
    expect(parametro).toContain('%0A');
    expect(parametro).toContain('%23');
    expect(parametro).toContain('%26');
    expect(parametro).toContain('%C3%91'); // Ñ en UTF-8
    expect(decodeURIComponent(parametro)).toBe(texto);
    expect(new URL(enlace).searchParams.get('text')).toBe(texto);
  });

  it('enlaceParaCompartir es la forma que usa el agro', () => {
    expect(enlaceParaCompartir(texto)).toBe(`https://wa.me/?text=${encodeURIComponent(texto)}`);
  });

  it('un número inválido no arma enlace', () => {
    expect(() => enlaceConNumero('12', 'Hola')).toThrow(WhatsAppInvalido);
  });

  it('un texto con emoji al principio no arma enlace', () => {
    expect(() => enlaceParaCompartir('🚗 Hola')).toThrow(WhatsAppInvalido);
  });
});
