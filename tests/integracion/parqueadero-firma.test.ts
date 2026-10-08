/**
 * La llave de la caja, su certificado y la firma de sus recibos (HU-Q8.1 y HU-Q8.2), contra la
 * API de la celda de verdad (`crearApp`) con su D1 local. El enlace firmado se verifica como en
 * `/r/`. Controles negativos (CA3): un navegador sin Ed25519 y una caja de otra serie.
 */
import 'fake-indexeddb/auto';
import { uuidv7 } from '@ed1/ids';
import { armarRecibo, enlaceCompleto, leerEnlace, verificarRecibo } from '@ed1/parqueadero-recibos';
import {
  AJUSTE_ENSAYO,
  DISPOSITIVO,
  ENTRADA_ENSAYO,
  SEDE_ENSAYO_UNO,
  TARIFA_CARRO,
} from '@ed1/parqueadero-schema/ensayos';
import { generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  abrir,
  alta,
  type Entorno,
  env,
  ORG_UNO,
  T0,
  token,
  vaciarShard,
} from '../../apps/parqueadero-api/src/prueba.fixture.ts';
import { crearApp } from '../../apps/parqueadero-api/src/worker.ts';
import { abrirBase } from '../../apps/parqueadero-sitio/src/caja/datos.ts';
import {
  asegurarLlave,
  certificar,
  estadoDeLaFirma,
  firmarEnlace,
} from '../../apps/parqueadero-sitio/src/caja/firma.ts';

const DIA_MS = 24 * 60 * 60 * 1000;
const API = 'https://api.ejemplo.test';

let e: Entorno;
let llaveDeLaCelda: string;
beforeAll(async () => {
  e = await abrir();
  llaveDeLaCelda = await generarClavePrivada();
}, 60_000);
afterAll(async () => e?.cerrar());
beforeEach(async () => vaciarShard(e.db));

/** La celda de prueba como la ve la caja, en el instante `ahora`. */
const celda = (ahora: () => number) => {
  const app = crearApp({ ahora });
  return (async (url: RequestInfo | URL, init?: RequestInit) =>
    app.fetch(
      new Request(url, init),
      env(e, { CELDA_RECIBO_PRIVATE_KEY: llaveDeLaCelda }),
    )) as typeof fetch;
};

async function llavesDeLaCelda() {
  const r = await celda(() => T0)(`${API}/api/claves-recibo`);
  return ((await r.json()) as { claves: { kid: string; x: string }[] }).claves;
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

const RECIBO = armarRecibo(
  ENTRADA_ENSAYO,
  { sede: SEDE_ENSAYO_UNO, tarifa: TARIFA_CARRO, ajuste: AJUSTE_ENSAYO },
  { prueba: false },
);

async function destino() {
  return { api: API, acceso: await token(e), dispositivo: DISPOSITIVO };
}

describe('la llave de la caja (HU-Q8.1 CA1, CA3)', () => {
  it('es Ed25519 y no exportable, y se genera una sola vez', async () => {
    const db = abrirBase(`firma-${uuidv7()}`);
    const una = await asegurarLlave(db, () => T0);
    expect(una.estado).toBe('lista');
    if (una.estado !== 'lista') return;
    expect(una.privada.extractable).toBe(false);
    expect(una.privada.algorithm.name).toBe('Ed25519');
    await expect(crypto.subtle.exportKey('pkcs8', una.privada)).rejects.toThrow();
    const otra = await asegurarLlave(db, () => T0);
    expect(otra.estado === 'lista' && otra.llave).toBe(una.llave);
  });

  it('❌ sin Ed25519 en el navegador emite sin firma y lo dice; nunca pide una llave exportable', async () => {
    const db = abrirBase(`firma-${uuidv7()}`);
    const generateKey = vi.fn(async () => {
      throw new DOMException('Algorithm: Unrecognized name', 'NotSupportedError');
    });
    const sutil = { generateKey, exportKey: crypto.subtle.exportKey, sign: crypto.subtle.sign };
    expect((await asegurarLlave(db, () => T0, sutil)).estado).toBe('sin-ed25519');
    expect(await estadoDeLaFirma(db, T0)).toEqual({ es: 'sin-ed25519' });
    expect(generateKey).toHaveBeenCalledTimes(1);
    for (const [, exportable] of generateKey.mock.calls as unknown as [unknown, boolean][]) {
      expect(exportable).toBe(false);
    }
    expect(await firmarEnlace(db, await enlaceCompleto(RECIBO), RECIBO.numero)).toBe(
      await enlaceCompleto(RECIBO),
    );
  });
});

describe('el certificado y el recibo firmado (HU-Q8.1 CA1, HU-Q8.2 CA1)', () => {
  it('la caja pide su certificado y su recibo se verifica en /r/', async () => {
    await alta(e.db, ORG_UNO, DISPOSITIVO, 'A');
    const db = abrirBase(`firma-${uuidv7()}`);
    const enlace = await enlaceCompleto(RECIBO);
    // Sin certificado todavía: sale sin firma.
    expect(await firmarEnlace(db, enlace, RECIBO.numero)).toBe(enlace);

    expect(
      await certificar(db, await destino(), { ahora: () => T0, fetchFn: celda(() => T0) }),
    ).toBe(true);
    expect(await estadoDeLaFirma(db, T0)).toEqual({
      es: 'vigente',
      hasta: T0 + 30 * DIA_MS,
      serie: 'A',
    });
    const firmado = await firmarEnlace(db, enlace, RECIBO.numero);
    expect(firmado.startsWith(`${enlace}.`)).toBe(true);
    const lectura = await leerEnlace(firmado);
    if (lectura.forma !== 'completa') throw new Error('no es completa');
    expect(await verificarRecibo(lectura, await llavesDeLaCelda(), verificar)).toEqual({
      estado: 'verificado',
      serie: 'A',
    });
  });

  it('no vuelve a pedirlo hasta su última semana', async () => {
    await alta(e.db, ORG_UNO, DISPOSITIVO, 'A');
    const db = abrirBase(`firma-${uuidv7()}`);
    const pedidos: string[] = [];
    const contando = (ahora: () => number) =>
      (async (url: RequestInfo | URL, init?: RequestInit) => {
        pedidos.push(String(url));
        return celda(ahora)(url, init);
      }) as typeof fetch;
    const d = await destino();
    await certificar(db, d, { ahora: () => T0, fetchFn: contando(() => T0) });
    const dia20 = T0 + 20 * DIA_MS;
    expect(await certificar(db, d, { ahora: () => dia20, fetchFn: contando(() => dia20) })).toBe(
      false,
    );
    expect(pedidos).toHaveLength(1);
    const dia25 = T0 + 25 * DIA_MS;
    expect(
      await certificar(
        db,
        { ...d, acceso: await token(e, {}, dia25) },
        {
          ahora: () => dia25,
          fetchFn: contando(() => dia25),
        },
      ),
    ).toBe(true);
    expect(pedidos).toHaveLength(2);
    expect((await estadoDeLaFirma(db, dia25)).es).toBe('vigente');
  });

  it('con el certificado vencido sigue firmando, y el estado lo dice', async () => {
    await alta(e.db, ORG_UNO, DISPOSITIVO, 'A');
    const db = abrirBase(`firma-${uuidv7()}`);
    await certificar(db, await destino(), { ahora: () => T0, fetchFn: celda(() => T0) });
    const despues = T0 + 31 * DIA_MS;
    expect((await estadoDeLaFirma(db, despues)).es).toBe('vencido');
    const enlace = await enlaceCompleto(RECIBO);
    expect(await firmarEnlace(db, enlace, RECIBO.numero)).not.toBe(enlace);
  });

  it('❌ no firma un recibo de otra serie: una caja responde por sus números', async () => {
    await alta(e.db, ORG_UNO, DISPOSITIVO, 'B');
    const db = abrirBase(`firma-${uuidv7()}`);
    await certificar(db, await destino(), { ahora: () => T0, fetchFn: celda(() => T0) });
    const enlace = await enlaceCompleto(RECIBO);
    expect(RECIBO.numero.startsWith('A-')).toBe(true);
    expect(await firmarEnlace(db, enlace, RECIBO.numero)).toBe(enlace);
  });

  it('❌ una caja retirada no recibe certificado y sigue emitiendo sin firma', async () => {
    await alta(e.db, ORG_UNO, DISPOSITIVO, 'A');
    await e.db
      .prepare(`UPDATE dispositivo SET estado = 'retirado', retirado = ? WHERE id = ?`)
      .bind(new Date(T0).toISOString(), DISPOSITIVO)
      .run();
    const db = abrirBase(`firma-${uuidv7()}`);
    expect(
      await certificar(db, await destino(), { ahora: () => T0, fetchFn: celda(() => T0) }),
    ).toBe(false);
    expect(await estadoDeLaFirma(db, T0)).toEqual({ es: 'sin-certificado' });
  });
});
