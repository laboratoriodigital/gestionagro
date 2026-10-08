/**
 * El recibo firmado (HU-Q8.2): la caja firma su enlace completo con su llave y su certificado, y
 * `verificarRecibo` da los casos de PARQUEADERO §6.3. Ed25519 de WebCrypto, como la celda; la
 * página usa una librería con la misma interfaz. Controles negativos (CA4): un carácter cambiado,
 * la serie de otra caja y un certificado vencido.
 */
import { base64url, firmarCertificado, type LlavePublica } from '@ed1/firma';
import {
  AJUSTE_ENSAYO,
  ENTRADA_ENSAYO,
  SALIDA_ENSAYO,
  SEDE_ENSAYO_UNO,
  TARIFA_CARRO,
} from '@ed1/parqueadero-schema/ensayos';
import { correction, generate } from 'lean-qr';
import { describe, expect, it } from 'vitest';
import {
  armarRecibo,
  conFirma,
  EnlaceInvalido,
  emitidoEn,
  enlaceCompleto,
  enlaceCorto,
  leerEnlace,
  mensajeAFirmar,
  type Recibo,
  serieDe,
  verificarRecibo,
} from './index.ts';

const CATALOGOS = { sede: SEDE_ENSAYO_UNO, tarifa: TARIFA_CARRO, ajuste: AJUSTE_ENSAYO };
const ENTRADA = armarRecibo(ENTRADA_ENSAYO, CATALOGOS, { prueba: false });
const SALIDA = armarRecibo(SALIDA_ENSAYO, CATALOGOS, { prueba: false });
const SEDE_LARGA = {
  ...SEDE_ENSAYO_UNO,
  nombre: 'Parqueadero Ensayo Uno de Nombre Muy Lar',
  direccion: 'Avenida Carrera 68 # 100-200 Interior 4 Bodega 12 Sotano B',
};
const ORG = '0199b8a0-0000-7000-8000-0000000000a1';
const DIA_S = 24 * 60 * 60;

const texto = new TextEncoder();

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
) =>
  crypto.subtle.verify(
    { name: 'Ed25519' },
    await crypto.subtle.importKey('raw', publica, { name: 'Ed25519' }, false, ['verify']),
    firma,
    mensaje,
  );

/** Una celda, una caja con su certificado, y el enlace firmado de `recibo`. */
async function firmado(recibo: Recibo, o: { serie?: string; hasta?: number } = {}) {
  const celda = await par();
  const caja = await par();
  const certificado = await firmarCertificado(
    {
      kid: celda.kid,
      llave: caja.x,
      org: ORG,
      serie: o.serie ?? serieDe(recibo.numero),
      hasta: o.hasta ?? emitidoEn(recibo) + 30 * DIA_S,
    },
    celda.firmar,
  );
  const enlace = await enlaceCompleto(recibo);
  const conLaFirma = conFirma(enlace, await caja.firmar(mensajeAFirmar(enlace)), certificado);
  const llaves: LlavePublica[] = [{ kid: celda.kid, x: celda.x }];
  return { enlace: conLaFirma, llaves };
}

async function verificacion(enlace: string, llaves: readonly LlavePublica[]) {
  const lectura = await leerEnlace(enlace);
  if (lectura.forma !== 'completa') throw new Error('no es completa');
  return verificarRecibo(lectura, llaves, verificar);
}

const QR = (t: string, maxima: number) =>
  (generate(t, {
    minCorrectionLevel: correction.L,
    maxCorrectionLevel: correction.L,
    maxVersion: maxima,
  }).size -
    17) /
  4;

describe('los casos de la página (HU-Q8.2 CA2)', () => {
  it.each([
    ['entrada', ENTRADA],
    ['salida', SALIDA],
  ])(
    'la %s firmada con el certificado vigente: verificado, con la serie de la caja',
    async (_, r) => {
      const { enlace, llaves } = await firmado(r);
      expect(enlace).toMatch(/#1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{86}\.[A-Za-z0-9_-]{174}$/);
      expect(await verificacion(enlace, llaves)).toEqual({ estado: 'verificado', serie: 'A' });
      // El recibo es el mismo con y sin la firma.
      const leido = await leerEnlace(enlace);
      expect(leido.forma === 'completa' && leido.recibo).toEqual(r);
    },
  );

  it('sin firma, como los enlaces de M0: copia digital, sin alarma', async () => {
    expect(await verificacion(await enlaceCompleto(ENTRADA), [])).toEqual({ estado: 'sin-firma' });
  });

  it('emitido después del vencimiento del certificado: vencido', async () => {
    const { enlace, llaves } = await firmado(SALIDA, { hasta: emitidoEn(SALIDA) - 1 });
    expect(await verificacion(enlace, llaves)).toEqual({ estado: 'vencido', serie: 'A' });
  });

  it('el certificado de una celda que la página no conoce: sin verificar, sin alarma', async () => {
    const { enlace } = await firmado(ENTRADA);
    const otra = await par();
    expect(await verificacion(enlace, [{ kid: otra.kid, x: otra.x }])).toEqual({
      estado: 'sin-verificar',
    });
  });

  it('❌ cambiar un carácter de los datos, la firma o el certificado: modificado (CA4)', async () => {
    const { enlace, llaves } = await firmado(SALIDA);
    const [base = '', firma = '', certificado = ''] =
      enlace.split('#')[1]?.split('.').slice(1) ?? [];
    const prefijo = enlace.slice(0, enlace.indexOf('#') + 3);
    const otro = (s: string, i: number) =>
      `${s.slice(0, i)}${s[i] === 'Q' ? 'R' : 'Q'}${s.slice(i + 1)}`;
    let modificados = 0;
    let ilegibles = 0;
    const casos = [
      ...[5, 40, 120].map((i) => `${prefijo}${otro(base, i)}.${firma}.${certificado}`),
      ...[0, 30, 60, 84].map((i) => `${prefijo}${base}.${otro(firma, i)}.${certificado}`),
      ...[20, 60, 100, 160].map((i) => `${prefijo}${base}.${firma}.${otro(certificado, i)}`),
    ];
    for (const alterado of casos) {
      try {
        const v = await verificacion(alterado, llaves);
        expect(v.estado).toBe('modificado');
        modificados++;
      } catch (e) {
        // Un byte de los datos rompe la suma de deflate antes de llegar a la firma.
        expect(e).toBeInstanceOf(EnlaceInvalido);
        ilegibles++;
      }
    }
    expect(modificados + ilegibles).toBe(casos.length);
    expect(modificados).toBeGreaterThanOrEqual(8);
  });

  it('❌ el certificado de la caja B no responde por un recibo de la serie A', async () => {
    const { enlace, llaves } = await firmado(ENTRADA, { serie: 'B' });
    expect(await verificacion(enlace, llaves)).toEqual({ estado: 'modificado' });
  });

  it('❌ quitar la firma y dejar el certificado no es un enlace: error de forma', async () => {
    const { enlace } = await firmado(ENTRADA);
    const fragmento = enlace.slice(enlace.indexOf('#') + 1);
    const sinFirma = fragmento.split('.').toSpliced(2, 1).join('.');
    await expect(leerEnlace(sinFirma)).rejects.toMatchObject({ motivo: 'forma' });
  });

  it('solo se firma un enlace completo sin firma', async () => {
    const { enlace } = await firmado(ENTRADA);
    expect(() => mensajeAFirmar(enlace)).toThrow(EnlaceInvalido);
    expect(() => mensajeAFirmar(enlaceCorto(ENTRADA))).toThrow(EnlaceInvalido);
  });
});

describe('cuánto mide el enlace firmado (HU-Q8.2 CA3, PARQUEADERO §6.3)', () => {
  // Medido el 8 oct 2026 con el código: la firma y el certificado suman 262 caracteres. La
  // entrada y la salida largas firmadas miden 662 y 671 (versión 18 del QR de la pantalla, 89
  // módulos), lo que §6.3 estimó. El papel sigue con la corta, en la versión 7.
  it.each([
    ['entrada', ENTRADA_ENSAYO],
    ['salida', SALIDA_ENSAYO],
  ])('la %s larga firmada cabe en la versión 18 del QR de la pantalla', async (_, registro) => {
    const r = armarRecibo(registro, { ...CATALOGOS, sede: SEDE_LARGA }, { prueba: false });
    const sinFirma = await enlaceCompleto(r);
    const { enlace } = await firmado(r);
    expect(enlace.length - sinFirma.length).toBe(1 + 86 + 1 + 174);
    expect(QR(enlace, 18)).toBeLessThanOrEqual(18);
  });

  it('el papel sigue con la corta en la versión 7', () => {
    const r = armarRecibo(ENTRADA_ENSAYO, { ...CATALOGOS, sede: SEDE_LARGA }, { prueba: false });
    expect(QR(enlaceCorto(r), 7)).toBeLessThanOrEqual(7);
  });
});
