/**
 * El certificado de firma de una caja (HU-Q8.1 CA1) y la llave pública de recibos de la celda,
 * contra el D1 local del shard de c2. La cadena se verifica con `@ed1/firma`, como `/r/`.
 */

import { base64url, leerCertificado, verificarCadena } from '@ed1/firma';
import { DISPOSITIVO } from '@ed1/parqueadero-schema/ensayos';
import { generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RENOVAR_ANTES_S, VIGENCIA_S } from './certificados.ts';
import {
  abrir,
  alta,
  CAJERO,
  conTerminos,
  type Entorno,
  env,
  ORG_DOS,
  ORG_UNO,
  T0,
  token,
  vaciarShard,
} from './prueba.fixture.ts';
import { crearApp } from './worker.ts';

let e: Entorno;
let llaveDeLaCelda: string;
beforeAll(async () => {
  e = await abrir();
  llaveDeLaCelda = await generarClavePrivada();
}, 60_000);
afterAll(async () => e?.cerrar());
beforeEach(async () => vaciarShard(e.db));

const DIA_MS = 24 * 60 * 60 * 1000;

async function parDeLaCaja() {
  const p = (await crypto.subtle.generateKey({ name: 'Ed25519' }, false, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  return {
    llave: base64url(new Uint8Array(await crypto.subtle.exportKey('raw', p.publicKey))),
    firmar: async (m: Uint8Array<ArrayBuffer>) =>
      base64url(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, p.privateKey, m))),
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

/** Pide un certificado como la caja, en el instante dado. */
async function pedirCertificado(
  cuerpo: unknown,
  opciones: { ahora?: number; datos?: Parameters<typeof token>[1]; sinLlave?: boolean } = {},
) {
  const ahora = opciones.ahora ?? T0;
  const app = crearApp({ ahora: () => ahora });
  const r = await app.fetch(
    new Request(`https://api.ejemplo.test${conTerminos('/api/v1/dispositivos/certificado')}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await token(e, opciones.datos ?? {}, ahora)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
    }),
    env(e, opciones.sinLlave ? {} : { CELDA_RECIBO_PRIVATE_KEY: llaveDeLaCelda }),
  );
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

async function llavesPublicas() {
  const r = await crearApp().fetch(
    new Request('https://api.ejemplo.test/api/claves-recibo'),
    env(e, { CELDA_RECIBO_PRIVATE_KEY: llaveDeLaCelda }),
  );
  return { status: r.status, cuerpo: (await r.json()) as { claves: { kid: string; x: string }[] } };
}

describe('GET /api/claves-recibo', () => {
  it('sin token, la llave pública de la celda', async () => {
    const r = await llavesPublicas();
    expect(r.status).toBe(200);
    expect(r.cuerpo.claves).toHaveLength(1);
    expect(r.cuerpo.claves[0]?.kid).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });

  it('❌ sin la llave configurada responde 503 y lo dice (P1)', async () => {
    const r = await crearApp().fetch(
      new Request('https://api.ejemplo.test/api/claves-recibo'),
      env(e),
    );
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ motivo: 'Falta CELDA_RECIBO_PRIVATE_KEY' });
  });
});

describe('POST /api/v1/dispositivos/certificado (HU-Q8.1 CA1)', () => {
  it('certifica la llave de la caja con su serie y su parqueadero, por 30 días', async () => {
    await alta(e.db, ORG_UNO, DISPOSITIVO, 'B');
    const caja = await parDeLaCaja();
    const r = await pedirCertificado({ dispositivo: DISPOSITIVO, llave: caja.llave });
    expect(r.status).toBe(200);
    expect(r.cuerpo).toMatchObject({ serie: 'B', hasta: T0 + 30 * DIA_MS });
    const leido = leerCertificado(String(r.cuerpo['certificado']));
    expect(leido?.certificado).toMatchObject({
      llave: caja.llave,
      org: ORG_UNO,
      serie: 'B',
      hasta: (T0 + 30 * DIA_MS) / 1000,
    });

    // La cadena completa verifica con la llave que publica la celda, como en /r/.
    const mensaje = new TextEncoder().encode('1.recibo');
    const cadena = await verificarCadena({
      mensaje,
      firma: await caja.firmar(mensaje),
      certificado: String(r.cuerpo['certificado']),
      llaves: (await llavesPublicas()).cuerpo.claves,
      emitido: T0 / 1000,
      verificar,
    });
    expect(cadena.estado).toBe('verificado');

    const fila = await e.db
      .prepare('SELECT llave_publica, certificado_hasta FROM dispositivo WHERE id = ?')
      .bind(DISPOSITIVO)
      .first<{ llave_publica: string; certificado_hasta: string }>();
    expect(fila).toEqual({
      llave_publica: caja.llave,
      certificado_hasta: new Date(T0 + 30 * DIA_MS).toISOString(),
    });
  });

  it('lo pide cualquier rol: firma la caja, no la persona', async () => {
    await alta(e.db, ORG_UNO, DISPOSITIVO, 'A');
    const caja = await parDeLaCaja();
    const r = await pedirCertificado(
      { dispositivo: DISPOSITIVO, llave: caja.llave },
      { datos: { sub: CAJERO, rol: 'cajero' } },
    );
    expect(r.status).toBe(200);
  });

  it('se renueva solo en la última semana: antes devuelve el mismo certificado', async () => {
    await alta(e.db, ORG_UNO, DISPOSITIVO, 'A');
    const caja = await parDeLaCaja();
    const primero = await pedirCertificado({ dispositivo: DISPOSITIVO, llave: caja.llave });
    const antes = T0 + (VIGENCIA_S - RENOVAR_ANTES_S) * 1000 - DIA_MS;
    const igual = await pedirCertificado(
      { dispositivo: DISPOSITIVO, llave: caja.llave },
      { ahora: antes },
    );
    expect(igual.cuerpo['certificado']).toBe(primero.cuerpo['certificado']);

    const enLaUltimaSemana = T0 + (VIGENCIA_S - RENOVAR_ANTES_S) * 1000 + DIA_MS;
    const nuevo = await pedirCertificado(
      { dispositivo: DISPOSITIVO, llave: caja.llave },
      { ahora: enLaUltimaSemana },
    );
    expect(nuevo.cuerpo['hasta']).toBe(enLaUltimaSemana + 30 * DIA_MS);
    expect(nuevo.cuerpo['certificado']).not.toBe(primero.cuerpo['certificado']);
  });

  it('una llave nueva de la misma caja recibe un certificado nuevo', async () => {
    await alta(e.db, ORG_UNO, DISPOSITIVO, 'A');
    const una = await parDeLaCaja();
    const otra = await parDeLaCaja();
    await pedirCertificado({ dispositivo: DISPOSITIVO, llave: una.llave });
    const r = await pedirCertificado(
      { dispositivo: DISPOSITIVO, llave: otra.llave },
      { ahora: T0 + DIA_MS },
    );
    expect(leerCertificado(String(r.cuerpo['certificado']))?.certificado.llave).toBe(otra.llave);
    expect(r.cuerpo['hasta']).toBe(T0 + 31 * DIA_MS);
  });

  it('❌ una caja retirada no se certifica (§11.4 punto 3)', async () => {
    await alta(e.db, ORG_UNO, DISPOSITIVO, 'A');
    await e.db
      .prepare(`UPDATE dispositivo SET estado = 'retirado', retirado = ? WHERE id = ?`)
      .bind(new Date(T0).toISOString(), DISPOSITIVO)
      .run();
    const r = await pedirCertificado({
      dispositivo: DISPOSITIVO,
      llave: (await parDeLaCaja()).llave,
    });
    expect(r.status).toBe(403);
    expect(r.cuerpo['estado']).toBe('retirado');
  });

  it('❌ la caja de otro parqueadero no existe para este token', async () => {
    await alta(e.db, ORG_DOS, DISPOSITIVO, 'A');
    const r = await pedirCertificado({
      dispositivo: DISPOSITIVO,
      llave: (await parDeLaCaja()).llave,
    });
    expect(r.status).toBe(404);
  });

  it('❌ una llave que no son 32 bytes Ed25519 se rechaza', async () => {
    await alta(e.db, ORG_UNO, DISPOSITIVO, 'A');
    for (const llave of ['', 'AAAA', base64url(new Uint8Array(33)), 'no base64', 42]) {
      const r = await pedirCertificado({ dispositivo: DISPOSITIVO, llave });
      expect(r.status, String(llave)).toBe(400);
    }
    expect((await pedirCertificado({ llave: (await parDeLaCaja()).llave })).status).toBe(400);
  });

  it('❌ sin la llave de la celda responde 503: los recibos salen sin firma', async () => {
    await alta(e.db, ORG_UNO, DISPOSITIVO, 'A');
    const r = await pedirCertificado(
      { dispositivo: DISPOSITIVO, llave: (await parDeLaCaja()).llave },
      { sinLlave: true },
    );
    expect(r.status).toBe(503);
    expect(r.cuerpo['estado']).toBe('sin-configurar');
  });
});
