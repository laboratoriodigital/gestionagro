/**
 * `@ed1/firma` (HU-Q8.1): base64url, el certificado de un dispositivo y la cadena celda →
 * dispositivo → mensaje, con Ed25519 de WebCrypto como la celda. Controles negativos: un byte
 * cambiado en cada parte, la llave de otra celda y un certificado vencido.
 */
import { describe, expect, it } from 'vitest';
import {
  base64url,
  type Certificado,
  cuerpoDelCertificado,
  desdeBase64url,
  esCanonico,
  firmarCertificado,
  type LlavePublica,
  leerCertificado,
  verificarCadena,
} from './index.ts';

const texto = new TextEncoder();
const ORG = '0199b8a0-0000-7000-8000-00000000e001';
const HASTA = 1_800_000_000;

async function par() {
  const p = (await crypto.subtle.generateKey({ name: 'Ed25519' }, false, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const x = base64url(new Uint8Array(await crypto.subtle.exportKey('raw', p.publicKey)));
  const huella = new Uint8Array(await crypto.subtle.digest('SHA-256', texto.encode(x)));
  return {
    x,
    kid: base64url(huella).slice(0, 16),
    firmar: async (m: Uint8Array<ArrayBuffer>) =>
      new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, p.privateKey, m)),
  };
}

const verificar = async (
  publica: Uint8Array<ArrayBuffer>,
  mensaje: Uint8Array<ArrayBuffer>,
  firma: Uint8Array<ArrayBuffer>,
) => {
  const llave = await crypto.subtle.importKey('raw', publica, { name: 'Ed25519' }, false, [
    'verify',
  ]);
  return crypto.subtle.verify({ name: 'Ed25519' }, llave, firma, mensaje);
};

/** Cambia un carácter base64url por otro distinto, sin romper la forma. */
const cambiar = (s: string, i: number) =>
  `${s.slice(0, i)}${s[i] === 'A' ? 'B' : 'A'}${s.slice(i + 1)}`;

async function cadena(opciones: { hasta?: number } = {}) {
  const celda = await par();
  const caja = await par();
  const certificado = await firmarCertificado(
    { kid: celda.kid, llave: caja.x, org: ORG, serie: 'A', hasta: opciones.hasta ?? HASTA },
    celda.firmar,
  );
  const mensaje = texto.encode('1.datos-del-recibo');
  const firma = base64url(await caja.firmar(mensaje));
  const llaves: LlavePublica[] = [{ kid: celda.kid, x: celda.x }];
  return { celda, caja, certificado, mensaje, firma, llaves };
}

describe('base64url', () => {
  it('ida y vuelta, sin relleno', () => {
    const bytes = Uint8Array.from([0, 250, 251, 252, 253, 254, 255]);
    expect(base64url(bytes)).toBe('APr7_P3-_w');
    expect(desdeBase64url('APr7_P3-_w')).toEqual(bytes);
  });

  it('esCanonico: una sola forma por bytes', () => {
    expect(esCanonico('APr7_P3-_w')).toBe(true);
    // Los últimos bits sobrantes cambiados dan los mismos bytes: no es la forma canónica.
    expect(esCanonico('APr7_P3-_x')).toBe(false);
    expect(esCanonico('AP+7')).toBe(false);
    expect(esCanonico('')).toBe(false);
    expect(esCanonico('A')).toBe(false);
  });
});

describe('el certificado', () => {
  it('se lee igual que se firmó, y mide 130 bytes con una serie de una letra', async () => {
    const { certificado, caja, celda } = await cadena();
    const leido = leerCertificado(certificado);
    expect(leido?.certificado).toEqual({
      kid: celda.kid,
      llave: caja.x,
      org: ORG,
      serie: 'A',
      hasta: HASTA,
    });
    expect(desdeBase64url(certificado)).toHaveLength(130);
    expect(certificado).toHaveLength(174);
  });

  it('series de hasta tres letras; vencimientos hasta 2106', async () => {
    const { celda, caja } = await cadena();
    for (const serie of ['B', 'AA', 'Z9Z']) {
      const c = await firmarCertificado(
        { kid: celda.kid, llave: caja.x, org: ORG, serie, hasta: 0xffffffff },
        celda.firmar,
      );
      expect(leerCertificado(c)?.certificado.serie).toBe(serie);
      expect(leerCertificado(c)?.certificado.hasta).toBe(0xffffffff);
    }
  });

  it('❌ no arma lo que no cabe en el formato', () => {
    const base: Certificado = {
      kid: 'AAAAAAAAAAAAAAAA',
      llave: base64url(new Uint8Array(32)),
      org: ORG,
      serie: 'A',
      hasta: HASTA,
    };
    expect(() => cuerpoDelCertificado({ ...base, serie: 'ABCD' })).toThrow('serie');
    expect(() => cuerpoDelCertificado({ ...base, serie: 'a' })).toThrow('serie');
    expect(() => cuerpoDelCertificado({ ...base, org: 'no-es-uuid' })).toThrow('UUID');
    expect(() => cuerpoDelCertificado({ ...base, llave: 'AAAA' })).toThrow('32 bytes');
    expect(() => cuerpoDelCertificado({ ...base, kid: 'AAAA' })).toThrow('12 bytes');
    expect(() => cuerpoDelCertificado({ ...base, hasta: 2 ** 32 })).toThrow('vencimiento');
    expect(() => cuerpoDelCertificado({ ...base, hasta: 1.5 })).toThrow('vencimiento');
  });

  it('❌ no lee lo que no es la versión 1', async () => {
    const { certificado } = await cadena();
    const bytes = desdeBase64url(certificado);
    bytes[0] = 2;
    expect(leerCertificado(base64url(bytes))).toBeNull();
    expect(leerCertificado(certificado.slice(0, 40))).toBeNull();
    expect(leerCertificado('no es base64url')).toBeNull();
  });
});

describe('la cadena celda → dispositivo → mensaje', () => {
  it('verificado con el certificado vigente al emitir', async () => {
    const c = await cadena();
    const r = await verificarCadena({ ...c, emitido: HASTA, verificar });
    expect(r).toEqual({
      estado: 'verificado',
      certificado: expect.objectContaining({ serie: 'A' }),
    });
  });

  it('vencido si se emitió después de su vencimiento, aunque todo coincida', async () => {
    const c = await cadena();
    const r = await verificarCadena({ ...c, emitido: HASTA + 1, verificar });
    expect(r.estado).toBe('vencido');
  });

  it('llave desconocida si la celda no está entre las que la página lleva', async () => {
    const c = await cadena();
    const otra = await par();
    const r = await verificarCadena({
      ...c,
      llaves: [{ kid: otra.kid, x: otra.x }],
      emitido: HASTA,
      verificar,
    });
    expect(r.estado).toBe('llave-desconocida');
  });

  it('❌ un carácter cambiado en el mensaje, la firma o el certificado: modificado', async () => {
    const c = await cadena();
    const mensaje = texto.encode('1.datos-del-recibO');
    expect((await verificarCadena({ ...c, mensaje, emitido: HASTA, verificar })).estado).toBe(
      'modificado',
    );
    for (let i = 0; i < c.firma.length - 1; i += 7) {
      const firma = cambiar(c.firma, i);
      expect((await verificarCadena({ ...c, firma, emitido: HASTA, verificar })).estado).toBe(
        'modificado',
      );
    }
    // Desde el carácter 18 (después de la versión y el kid): llave, org, vence, serie y firma.
    for (let i = 18; i < c.certificado.length - 1; i += 5) {
      const certificado = cambiar(c.certificado, i);
      const r = await verificarCadena({ ...c, certificado, emitido: HASTA, verificar });
      expect(r.estado, `carácter ${i}`).toBe('modificado');
    }
  });

  it('❌ un dispositivo no se certifica a sí mismo: la llave del certificado no es de celda', async () => {
    const c = await cadena();
    const propio = await firmarCertificado(
      { kid: c.celda.kid, llave: c.caja.x, org: ORG, serie: 'A', hasta: HASTA + 999 },
      c.caja.firmar,
    );
    const r = await verificarCadena({ ...c, certificado: propio, emitido: HASTA, verificar });
    expect(r.estado).toBe('modificado');
  });

  it('❌ lo ilegible es modificado, nunca una excepción', async () => {
    const c = await cadena();
    for (const [firma, certificado] of [
      ['', c.certificado],
      ['@@', c.certificado],
      [c.firma.slice(0, 20), c.certificado],
      [c.firma, ''],
    ] as const) {
      const r = await verificarCadena({ ...c, firma, certificado, emitido: HASTA, verificar });
      expect(r.estado).toBe('modificado');
    }
    const falla = async () => {
      throw new Error('sin Ed25519');
    };
    expect((await verificarCadena({ ...c, emitido: HASTA, verificar: falla })).estado).toBe(
      'modificado',
    );
  });
});
