/**
 * El Worker del panel de la Tienda (HU-T2.4): las pantallas son assets, `/api/*` pasa a la API de
 * la celda con el secreto del despacho, y de punta a punta contra la API de verdad: la salud del
 * shard y de la base de control, y una cabecera `x-tienda` de afuera que nunca llega.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { crearApp } from '../../tienda-api/src/worker.ts';
import { atender, CABECERA_DESPACHO, CABECERA_TIENDA, type Env, type Servicio } from './worker.ts';

const SECRETO = 'secreto-de-prueba-del-despacho';

function servicio() {
  const recibidas: Request[] = [];
  const s: Servicio = {
    fetch: async (r) => {
      recibidas.push(r);
      return new Response('ok');
    },
  };
  return { recibidas, s };
}

afterEach(() => vi.restoreAllMocks());

describe('el panel', () => {
  it('sirve las pantallas como assets, sin pasar por la API', async () => {
    const assets = servicio();
    const api = servicio();
    await atender(new Request('https://panel.ejemplo.test/pedidos/'), {
      ASSETS: assets.s,
      API_C1: api.s,
      SECRETO_DESPACHO: SECRETO,
    });
    expect([assets.recibidas.length, api.recibidas.length]).toEqual([1, 0]);
  });

  it('pasa /api/* a la API de su celda con el secreto, y borra la tienda que llega de afuera', async () => {
    const api = servicio();
    await atender(
      new Request('https://panel.ejemplo.test/api/salud', {
        headers: { [CABECERA_TIENDA]: '{"org":"otra"}', [CABECERA_DESPACHO]: 'adivinado' },
      }),
      { API_C1: api.s, SECRETO_DESPACHO: SECRETO },
    );
    const [recibida] = api.recibidas;
    expect(recibida?.headers.get(CABECERA_DESPACHO)).toBe(SECRETO);
    expect(recibida?.headers.has(CABECERA_TIENDA)).toBe(false);
  });

  it.each<[string, Env]>([
    ['sin el secreto', { API_C1: servicio().s }],
    [
      'con dos celdas, hasta que el token diga cuál (HU-T2.8)',
      {
        API_C1: servicio().s,
        API_C2: servicio().s,
        SECRETO_DESPACHO: SECRETO,
      },
    ],
    ['sin ninguna celda', { SECRETO_DESPACHO: SECRETO }],
  ])('❌ %s responde 503 y no adivina', async (_caso, env) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await atender(new Request('https://panel.ejemplo.test/api/salud'), env);
    expect(r.status).toBe(503);
    expect(error).toHaveBeenCalledOnce();
  });
});

describe('de punta a punta con la API de verdad', () => {
  let shard: BaseD1;
  let control: BaseD1;
  const cerrar: (() => Promise<void>)[] = [];
  const configuracion = 'apps/tienda-api/wrangler.c1.jsonc';

  beforeAll(async () => {
    const s = await baseLocal({ configuracion, binding: 'tienda_c1_s1', base: 'tienda' });
    const c = await baseLocal({ configuracion, binding: 'tienda_control', base: 'tienda-control' });
    shard = s.db;
    control = c.db;
    cerrar.push(s.cerrar, c.cerrar);
  }, 60_000);
  afterAll(async () => {
    for (const c of cerrar) await c();
  });

  /** La API de la celda detrás de su binding, con sus bases y el mismo secreto. */
  const apiDeVerdad = (secretoDeLaApi: string): Servicio => {
    const app = crearApp();
    return {
      fetch: async (r) =>
        app.fetch(r, {
          CELDA: 'c1',
          PRODUCTO: 'tienda',
          SECRETO_DESPACHO: secretoDeLaApi,
          tienda_c1_s1: shard,
          tienda_control: control,
        }),
    };
  };

  it('GET /api/salud por el panel: la API responde con sus dos bases', async () => {
    const r = await atender(new Request('https://panel.ejemplo.test/api/salud'), {
      API_C1: apiDeVerdad(SECRETO),
      SECRETO_DESPACHO: SECRETO,
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ estado: 'ok', shards: 1, control: true });
  });

  it('❌ si el panel y la API no comparten el secreto, la API no existe (404)', async () => {
    const r = await atender(new Request('https://panel.ejemplo.test/api/salud'), {
      API_C1: apiDeVerdad('otro-secreto'),
      SECRETO_DESPACHO: SECRETO,
    });
    expect(r.status).toBe(404);
  });
});
