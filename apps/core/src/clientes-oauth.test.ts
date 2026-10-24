/**
 * HU-C9.3: el registro de clientes de OAuth. Registro dinámico (RFC 7591) con tope por IP, y
 * documentos de metadatos (CIMD) leídos con un `fetch` falso: lo que no ve (P17) es un servidor de
 * metadatos de verdad, que se prueba en staging con un agente real.
 */
import type { BaseD1 } from '@ed1/d1';
import { generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { baseDelCore, vaciarCore } from './base-de-prueba.ts';
import {
  clienteParaAutorizar,
  esUrlDeMetadatos,
  TOPE_DE_REGISTROS,
  vueltaAceptable,
} from './clientes-oauth.ts';
import type { Entorno } from './entrar.ts';
import { CATALOGO } from './productos.ts';
import { crearApp, type Env } from './worker.ts';

let db: BaseD1;
let cerrar: () => Promise<void>;
let clave: string;
const AHORA = Date.UTC(2026, 10, 2, 15);
let reloj = AHORA;
beforeAll(async () => {
  ({ db, cerrar } = await baseDelCore());
  clave = await generarClavePrivada();
}, 60_000);
afterAll(async () => cerrar?.());
beforeEach(async () => {
  await vaciarCore(db);
  reloj = AHORA;
});

const env = (destino = 'staging'): Env => ({
  DB: db,
  CORE_JWT_PRIVATE_KEY: clave,
  GOOGLE_CLIENT_ID: 'cliente',
  GOOGLE_CLIENT_SECRET: 'secreto',
  ORIGENES_APP: 'https://agro.example',
  DESTINO: destino,
});
const app = crearApp({ ahora: () => reloj });
const registrar = (cuerpo: unknown, ip = '203.0.113.7', destino = 'staging') =>
  app.fetch(
    new Request('https://core.example/oauth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
      body: JSON.stringify(cuerpo),
    }),
    env(destino),
  );
const AGENTE = {
  client_name: 'Asistente Ensayo',
  redirect_uris: ['https://agente.example/vuelta'],
};

describe('HU-C9.3 · registro dinámico (RFC 7591)', () => {
  it('CA1 · registra un cliente público y responde como pide la RFC, sin guardar la IP', async () => {
    const r = await registrar(AGENTE);
    expect(r.status).toBe(201);
    const cuerpo = (await r.json()) as Record<string, unknown>;
    expect(cuerpo).toMatchObject({
      client_name: 'Asistente Ensayo',
      redirect_uris: ['https://agente.example/vuelta'],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
    });
    const fila = await db
      .prepare('SELECT tipo, estado, origen_hash FROM cliente_oauth WHERE id = ?')
      .bind(cuerpo['client_id'])
      .first<{ tipo: string; estado: string; origen_hash: string }>();
    expect(fila).toMatchObject({ tipo: 'dcr', estado: 'activo' });
    expect(fila?.origen_hash).not.toContain('203.0.113.7');
  });

  it('CA2 ❌ · por encima del tope por IP, 429; otra IP sigue pudiendo', async () => {
    for (let i = 0; i < TOPE_DE_REGISTROS; i++) expect((await registrar(AGENTE)).status).toBe(201);
    const tope = await registrar(AGENTE);
    expect(tope.status).toBe(429);
    expect(tope.headers.get('retry-after')).toBe('3600');
    expect((await registrar(AGENTE, '198.51.100.9')).status).toBe(201);
    // Una hora después, la misma IP vuelve a poder.
    reloj += 61 * 60 * 1000;
    expect((await registrar(AGENTE)).status).toBe(201);
  });

  it('❌ · una vuelta que no es HTTPS (salvo la propia máquina), sin nombre o con secreto, no se registra', async () => {
    const malas = [
      { ...AGENTE, redirect_uris: ['http://agente.example/vuelta'] },
      { ...AGENTE, redirect_uris: [] },
      { ...AGENTE, client_name: '' },
      { ...AGENTE, token_endpoint_auth_method: 'client_secret_basic' },
    ];
    for (const cuerpo of malas) expect((await registrar(cuerpo)).status).toBe(400);
    expect(
      (await registrar({ ...AGENTE, redirect_uris: ['http://127.0.0.1:8123/cb'] })).status,
    ).toBe(201);
  });

  it('en producción también hay registro de clientes (HC6 aceptada el 24 oct 2026)', async () => {
    expect((await registrar(AGENTE, '203.0.113.7', 'produccion')).status).not.toBe(404);
  });
});

describe('HU-C9.3 · documentos de metadatos del cliente (CIMD)', () => {
  const ID = 'https://agente.example/oauth/cliente.json';
  const entorno = (): Entorno =>
    ({ db, ahora: () => reloj, catalogo: CATALOGO }) as unknown as Entorno;
  function metadatos(doc: Record<string, unknown> | null, estado = 200) {
    let pedidos = 0;
    const fn = (async () => {
      pedidos++;
      return new Response(doc ? JSON.stringify(doc) : 'no', { status: estado });
    }) as unknown as typeof fetch;
    return { fn, pedidos: () => pedidos };
  }
  const DOC = {
    client_id: ID,
    client_name: 'Asistente CIMD',
    redirect_uris: ['https://agente.example/cb'],
  };

  it('CA1 · lee el documento la primera vez y usa la copia el mismo día', async () => {
    const m = metadatos(DOC);
    const r = await clienteParaAutorizar(entorno(), m.fn, ID);
    expect(r).toMatchObject({ cliente: { id: ID, tipo: 'cimd', nombre: 'Asistente CIMD' } });
    await clienteParaAutorizar(entorno(), m.fn, ID);
    expect(m.pedidos()).toBe(1);
    // Al día siguiente, la vuelve a leer.
    reloj += 25 * 60 * 60 * 1000;
    await clienteParaAutorizar(entorno(), m.fn, ID);
    expect(m.pedidos()).toBe(2);
  });

  it('❌ · un documento que nombra a otro cliente, o con una vuelta insegura, no sirve', async () => {
    expect(
      await clienteParaAutorizar(
        entorno(),
        metadatos({ ...DOC, client_id: 'https://otro.example/c.json' }).fn,
        ID,
      ),
    ).toEqual({ motivo: 'El documento no es de este cliente.' });
    expect(
      await clienteParaAutorizar(
        entorno(),
        metadatos({ ...DOC, redirect_uris: ['http://agente.example/cb'] }).fn,
        ID,
      ),
    ).toEqual({ motivo: 'Una dirección de vuelta del cliente no es segura.' });
    expect(await clienteParaAutorizar(entorno(), metadatos(null, 404).fn, ID)).toEqual({
      motivo: 'El documento del cliente respondió 404.',
    });
  });

  it('CA2 ❌ · un cliente bloqueado no sigue, y leer su documento otra vez no lo desbloquea', async () => {
    await clienteParaAutorizar(entorno(), metadatos(DOC).fn, ID);
    await db.prepare("UPDATE cliente_oauth SET estado = 'bloqueado' WHERE id = ?").bind(ID).run();
    reloj += 25 * 60 * 60 * 1000;
    const m = metadatos(DOC);
    expect(await clienteParaAutorizar(entorno(), m.fn, ID)).toEqual({
      motivo: 'Este asistente está bloqueado y no puede pedir acceso.',
    });
    expect(m.pedidos()).toBe(0);
  });

  it('solo URL HTTPS con nombre y ruta; vueltas HTTPS o a la propia máquina', () => {
    expect(esUrlDeMetadatos(ID)).toBe(true);
    for (const malo of [
      'http://agente.example/c.json',
      'https://203.0.113.7/c.json',
      'https://agente.example/',
      'no-es-url',
    ])
      expect(esUrlDeMetadatos(malo), malo).toBe(false);
    expect(vueltaAceptable('http://localhost:3000/cb')).toBe(true);
    expect(vueltaAceptable('https://agente.example/cb#x')).toBe(false);
  });
});
