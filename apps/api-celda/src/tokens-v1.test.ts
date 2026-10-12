/**
 * HU-C4.5 CA2: la celda anota cada día en que aceptó un token v1, para que el registro de una
 * semana diga si ya se pueden rechazar. Con un KV falso; lo que no ve (P17): el vencimiento real de
 * la clave en KV, que solo se ve en Cloudflare.
 */
import { uuidv7 } from '@ed1/agro-schema';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anotarTokenV1, claveDelDia, DURACION_DE_LA_MARCA_S } from './tokens-v1.ts';
import type { KvDeFlags } from './vigia.ts';
import { crearApp, type Env } from './worker.ts';

const SHARD = 'agro_c0_s1';
const AHORA = Date.UTC(2026, 9, 20, 15);
const DIA = 24 * 60 * 60 * 1000;

function kvFalso() {
  const datos = new Map<string, { valor: string; ttl?: number | undefined }>();
  let lecturas = 0;
  const kv: KvDeFlags = {
    get: async (k) => {
      lecturas++;
      return datos.get(k)?.valor ?? null;
    },
    put: async (k, valor, opciones) => {
      datos.set(k, { valor, ttl: opciones?.expirationTtl });
    },
  };
  return { kv, datos, lecturas: () => lecturas };
}

let db: BaseD1;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  ({ db, cerrar } = await baseLocal({
    configuracion: 'apps/api-celda/wrangler.c0.jsonc',
    binding: SHARD,
    base: 'celda',
  }));
}, 60_000);
afterAll(async () => cerrar?.());

describe('HU-C4.5 · el registro de tokens v1', () => {
  it('un día con v1 deja una sola marca, que vence sola; el mismo día no vuelve a leer', async () => {
    const { kv, datos, lecturas } = kvFalso();
    expect(await anotarTokenV1(kv, AHORA)).toBe('anotado');
    expect(await anotarTokenV1(kv, AHORA + 60_000)).toBe('ya-estaba');
    expect(lecturas()).toBe(1);
    expect([...datos]).toEqual([
      ['tokens_v1:2026-10-20', { valor: '1', ttl: DURACION_DE_LA_MARCA_S }],
    ]);
    // Al día siguiente, otra marca.
    expect(await anotarTokenV1(kv, AHORA + DIA)).toBe('anotado');
    expect(datos.has(claveDelDia(AHORA + DIA))).toBe(true);
  });

  it('otra instancia del Worker que encuentra la marca no la reescribe', async () => {
    const { kv, datos } = kvFalso();
    datos.set(claveDelDia(AHORA), { valor: '1' });
    expect(await anotarTokenV1(kv, AHORA)).toBe('ya-estaba');
    expect(datos.get(claveDelDia(AHORA))).toEqual({ valor: '1' });
  });

  it('sin KV, o con el KV caído, la solicitud sigue (P1)', async () => {
    expect(await anotarTokenV1(undefined, AHORA)).toBe('sin-kv');
    const caido: KvDeFlags = {
      get: async () => {
        throw new Error('KV no responde');
      },
      put: async () => undefined,
    };
    expect(await anotarTokenV1(caido, AHORA)).toBe('fallo');
  });

  it('en una solicitud de verdad, un v1 se anota y un v2 no', async () => {
    const firmante = await firmanteDesde(await generarClavePrivada());
    const org = uuidv7(() => AHORA);
    const datos = { sub: 'u1', org, rol: 'propietario', celda: 'c0', shard: SHARD, anillo: 1 };
    const pedir = async (version: 1 | 2) => {
      const { kv, datos: marcas } = kvFalso();
      const env: Env = {
        CELDA: 'c0',
        PRODUCTO: 'agro',
        CORE_CLAVES: JSON.stringify([firmante.publica]),
        ORIGENES_APP: 'https://agro.ejemplo.test',
        FLAGS: kv,
        [SHARD]: db,
      };
      const { token } = await firmarAcceso(
        firmante,
        version === 2 ? { ...datos, aud: 'agro', plan: 'gratuito' } : datos,
        AHORA,
        version,
      );
      const r = await crearApp({ ahora: () => AHORA }).fetch(
        new Request('https://api.ejemplo.test/api/v1/yo', {
          headers: { authorization: `Bearer ${token}` },
        }),
        env,
      );
      expect(r.status).toBe(200);
      return [...marcas.keys()];
    };
    expect(await pedir(1)).toEqual(['tokens_v1:2026-10-20']);
    expect(await pedir(2)).toEqual([]);
  });
});
