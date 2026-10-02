/**
 * QR de trazabilidad (HU-E6.4): codificar, firmar con Ed25519 (WebCrypto, como la celda) y leer
 * como la página. Control negativo del CA2: cambiar un solo carácter.
 */
import { describe, expect, it } from 'vitest';
import {
  base64url,
  CAMPOS,
  type ClavePublicaQr,
  codificar,
  type DatosQr,
  fragmento,
  leerQr,
  mensajeAFirmar,
} from './index.ts';

const DATOS: DatosQr = {
  v: 1,
  l: 'T-27MAR-2',
  f: 'Finca Ensayo Uno',
  m: 'Municipio Ensayo',
  r: 'ecologico',
  c: 'Cultivo Ensayo',
  va: 'Variedad Ensayo',
  a: ['Nave 1', 'Nave 2'],
  d: ['2027-03-20', '2027-03-27'],
};

async function celda(): Promise<{
  firmar: (m: Uint8Array<ArrayBuffer>) => Promise<Uint8Array<ArrayBuffer>>;
  clave: ClavePublicaQr;
}> {
  const par = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', par.publicKey)) as JsonWebKey;
  return {
    firmar: async (m) =>
      new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, par.privateKey, m)),
    clave: { kid: 'kid-c0', x: jwk.x ?? '' },
  };
}

const verificar = async (
  publica: Uint8Array<ArrayBuffer>,
  mensaje: Uint8Array<ArrayBuffer>,
  firma: Uint8Array<ArrayBuffer>,
) => {
  const clave = await crypto.subtle.importKey('raw', publica, { name: 'Ed25519' }, false, [
    'verify',
  ]);
  return crypto.subtle.verify({ name: 'Ed25519' }, clave, firma, mensaje);
};

async function firmado() {
  const c = await celda();
  const codificado = codificar({ ...DATOS, k: c.clave.kid });
  return { c, frag: fragmento(codificado, await c.firmar(mensajeAFirmar(codificado))) };
}

describe('CA2 · verificado, sin verificar o no coincide', () => {
  it('con la firma de la celda: verificado, y se leen los datos', async () => {
    const { c, frag } = await firmado();
    const r = await leerQr(frag, [c.clave], verificar);
    expect(r).toEqual({ estado: 'verificado', datos: { ...DATOS, k: 'kid-c0' } });
  });

  it('sin firma: sin verificar, con los datos', async () => {
    const r = await leerQr(codificar(DATOS), [], verificar);
    expect(r).toEqual({ estado: 'sin-verificar', datos: DATOS });
  });

  it('control negativo: cambiar un solo carácter de los datos o de la firma no coincide', async () => {
    const { c, frag } = await firmado();
    const [datos = '', firma = ''] = frag.split('.');
    const otro = (s: string, i: number) =>
      s.slice(0, i) + (s[i] === 'A' ? 'B' : 'A') + s.slice(i + 1);
    for (const alterado of [`${otro(datos, 20)}.${firma}`, `${datos}.${otro(firma, 10)}`]) {
      const r = await leerQr(alterado, [c.clave], verificar);
      expect(['no-coincide', 'danado']).toContain(r.estado);
      expect(r.estado).not.toBe('verificado');
      expect(r.estado).not.toBe('sin-verificar');
    }
  });

  it('otros datos con la firma de un lote verdadero: no coincide (no se puede reusar una firma)', async () => {
    const { c, frag } = await firmado();
    const firma = frag.split('.')[1];
    const falso = codificar({ ...DATOS, f: 'Otra finca', k: c.clave.kid });
    expect((await leerQr(`${falso}.${firma}`, [c.clave], verificar)).estado).toBe('no-coincide');
  });

  it('firmado con una clave que la página no conoce: lo dice, no lo da por bueno ni por falso', async () => {
    const { frag } = await firmado();
    expect((await leerQr(frag, [], verificar)).estado).toBe('clave-desconocida');
  });

  it('un fragmento que no se puede leer: dañado', async () => {
    expect((await leerQr('#esto-no-es-un-qr', [], verificar)).estado).toBe('danado');
    expect((await leerQr('a.b.c', [], verificar)).estado).toBe('danado');
  });
});

describe('CA3 · el QR no lleva datos personales', () => {
  it('solo salen los campos permitidos, aunque se le pase otra cosa', () => {
    const conMas = {
      ...DATOS,
      persona: 'Persona Ensayo',
      email: 'ensayo@example.com',
      org_id: 'x',
    };
    const json = JSON.parse(
      atob(
        codificar(conMas as DatosQr)
          .replaceAll('-', '+')
          .replaceAll('_', '/'),
      ),
    );
    expect(Object.keys(json).every((k) => (CAMPOS as readonly string[]).includes(k))).toBe(true);
    expect(JSON.stringify(json)).not.toMatch(/Persona Ensayo|@|org_id/);
  });

  it('el mismo lote da siempre el mismo texto (orden fijo)', () => {
    const al_reves = Object.fromEntries(Object.entries(DATOS).reverse()) as unknown as DatosQr;
    expect(codificar(al_reves)).toBe(codificar(DATOS));
    expect(base64url(new Uint8Array([251, 255]))).toBe('-_8');
  });
});
