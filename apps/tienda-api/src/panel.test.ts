/**
 * La API de la Tienda verifica los tokens del CORE (HU-T2.8, TIENDA §12.1 y §14.1): tokens firmados
 * de verdad con una clave de prueba (P17), contra el shard local con los dos comercios de prueba
 * (P4). La tienda sale del token, nunca del cuerpo ni de la URL.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const SECRETO = 'secreto-de-prueba-del-despacho';
const T0 = Date.UTC(2026, 9, 13, 15);
const UNO = '0199e0a0-0000-7000-8000-0000000000c1';
const DOS = '0199e0a0-0000-7000-8000-0000000000c2';
const PERSONA = '0199e0a0-0000-7000-8000-0000000000d1';

let shard: BaseD1;
let cerrar: () => Promise<void>;
let firmante: Firmante;
let otroFirmante: Firmante;

beforeAll(async () => {
  ({ db: shard, cerrar } = await baseLocal({
    configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
    binding: 'tienda_c1_s1',
    base: 'tienda',
  }));
  for (const [org, slug, nombre] of [
    [UNO, 'ensayo-uno', 'Comercio Ensayo Uno'],
    [DOS, 'ensayo-dos', 'Comercio Ensayo Dos'],
  ] as const) {
    await shard
      .prepare(
        "INSERT INTO tienda (org_id, slug, nombre, estado, plan, creado, actualizado) VALUES (?, ?, ?, 'borrador', 'gratis', 'x', 'x')",
      )
      .bind(org, slug, nombre)
      .run();
  }
  firmante = await firmanteDesde(await generarClavePrivada());
  otroFirmante = await firmanteDesde(await generarClavePrivada());
}, 60_000);
afterAll(async () => cerrar?.());

const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  tienda_c1_s1: shard,
});

const token = async (
  extra: Partial<Parameters<typeof firmarAcceso>[1]> = {},
  f: Firmante = firmante,
  ahora = T0,
) =>
  (
    await firmarAcceso(
      f,
      {
        sub: PERSONA,
        org: UNO,
        rol: 'propietario',
        celda: 'c1',
        shard: 'tienda_c1_s1',
        anillo: 1,
        aud: 'tienda',
        plan: 'gratis',
        auth_time: Math.floor(T0 / 1000),
        ...extra,
      },
      ahora,
      2,
    )
  ).token;

const pedir = (t: string | null, ruta = '/api/panel/v1/yo', ahora = T0) =>
  crearApp({ ahora: () => ahora }).request(
    ruta,
    {
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        ...(t ? { authorization: `Bearer ${t}` } : {}),
      },
    },
    env(),
  );

describe('GET /api/panel/v1/yo, con el token del CORE (HU-T2.8)', () => {
  it('el token de Ensayo Uno llega a su tienda, con su rol y su plan', async () => {
    const r = await pedir(await token());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      org: UNO,
      rol: 'propietario',
      plan: 'gratis',
      funciones: expect.objectContaining({ productos: 15, cobro_en_linea: expect.any(Boolean) }),
      tienda: { slug: 'ensayo-uno', nombre: 'Comercio Ensayo Uno', estado: 'borrador' },
    });
  });

  it('el de Ensayo Dos llega a la suya: la tienda sale del token (P4)', async () => {
    const r = await pedir(await token({ org: DOS, rol: 'colaborador' }));
    expect((await r.json()).tienda.slug).toBe('ensayo-dos');
  });

  it('❌ una organización en la URL no cambia la tienda', async () => {
    const r = await pedir(await token(), `/api/panel/v1/yo?org=${DOS}`);
    expect((await r.json()).org).toBe(UNO);
  });

  it.each([['sin token', null, 401, 'sin-sesion']] as const)(
    '❌ %s: %i',
    async (_caso, t, estado, motivo) => {
      const r = await pedir(t);
      expect(r.status).toBe(estado);
      expect((await r.json()).estado).toBe(motivo);
    },
  );

  it.each<[string, () => Promise<string>, number, string]>([
    ['un token del agro', () => token({ aud: 'agro' }), 401, 'sin-sesion'],
    ['un token del parqueadero', () => token({ aud: 'parqueadero' }), 401, 'sin-sesion'],
    ['un token vencido', () => token({}, firmante, T0 - 13 * 60 * 60 * 1000), 401, 'sin-sesion'],
    ['un token firmado con otra clave', () => token({}, otroFirmante), 401, 'sin-sesion'],
    [
      'una cuenta sin tienda',
      () => token({ org: null, rol: null, shard: null }),
      403,
      'sin-tienda',
    ],
    ['un token de otra celda', () => token({ celda: 'c9' }), 403, 'otra-celda'],
    ['un shard que no es de la Tienda', () => token({ shard: 'agro_c0_s1' }), 403, 'otra-celda'],
  ])(
    '❌ %s responde %i con un motivo que el panel sabe mostrar',
    async (_caso, t, estado, motivo) => {
      const r = await pedir(await t());
      expect(r.status).toBe(estado);
      const cuerpo = await r.json();
      expect(cuerpo.estado).toBe(motivo);
      expect(typeof cuerpo.motivo).toBe('string');
    },
  );
});

describe('POST /api/panel/v1/publicar (HU-T4.4)', () => {
  const publicarCon = async (e: Env, t: string) =>
    crearApp({ ahora: () => T0 }).request(
      '/api/panel/v1/publicar',
      { method: 'POST', headers: { [CABECERA_DESPACHO]: SECRETO, authorization: `Bearer ${t}` } },
      e,
    );

  it('❌ un rol que la matriz no conoce no publica', async () => {
    const r = await publicarCon(env(), await token({ rol: 'cajero' }));
    expect(r.status).toBe(403);
    expect((await r.json()).estado).toBe('prohibido');
  });

  it('❌ con ks:tienda-horno apagado, publicar está en pausa y lo publicado sigue', async () => {
    const r = await publicarCon(
      {
        ...env(),
        FLAGS: { get: async (k: string) => (k === 'ks:tienda-horno' ? 'apagado' : null) },
      },
      await token(),
    );
    expect(r.status).toBe(503);
    expect((await r.json()).estado).toBe('apagado');
  });

  it('❌ sin el almacén ni los punteros configurados, no finge publicar (P1)', async () => {
    const r = await publicarCon(env(), await token());
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ estado: 'sin-configurar' });
  });
});
