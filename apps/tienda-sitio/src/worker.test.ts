/**
 * El despacho de la Tienda (HU-T2.4): resuelve la tienda por el `Host` sin tocar la base, con su
 * caché de 30 s; un host sin tienda responde la página neutra, y las cabeceras internas que llegan
 * de afuera nunca llegan a la API (CA4).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CABECERA_DESPACHO,
  CABECERA_TIENDA,
  CACHE_MS,
  crearDespacho,
  type Env,
  type Servicio,
} from './worker.ts';

const SECRETO = 'secreto-de-prueba-del-despacho';
const UNO = { org: 'org-ensayo-uno', celda: 'c1', shard: 'tienda_c1_s1' };

/** Un KV que cuenta sus lecturas. */
function kv(valores: Record<string, string>) {
  const lecturas: string[] = [];
  return {
    lecturas,
    get: async (clave: string) => {
      lecturas.push(clave);
      return valores[clave] ?? null;
    },
  };
}

/** Una API de mentira que guarda lo que le llega. */
function api() {
  const recibidas: Request[] = [];
  const servicio: Servicio = {
    fetch: async (s) => {
      recibidas.push(s);
      return Response.json({ estado: 'ok' });
    },
  };
  return { recibidas, servicio };
}

afterEach(() => vi.restoreAllMocks());

describe('un host sin tienda', () => {
  it('responde 404 con la página neutra, que no se indexa y no carga nada', async () => {
    const r = await crearDespacho().fetch(new Request('https://nadie.laboratorio-digital.app/'), {
      TIENDA_HOSTS: kv({}),
    });
    expect(r.status).toBe(404);
    expect(await r.text()).toContain('<h1>Esta dirección no tiene tienda</h1>');
    expect(r.headers.get('content-security-policy')).toBe(
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
  });

  it('❌ sin el KV, o con una entrada ilegible, también: y lo registra (P1)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const despacho = crearDespacho();
    const sinKv = await despacho.fetch(new Request('https://a.laboratorio-digital.app/'), {});
    const ilegible = await despacho.fetch(new Request('https://b.laboratorio-digital.app/'), {
      TIENDA_HOSTS: kv({ 'h:b.laboratorio-digital.app': '{"org":"x"}' }),
    });
    expect([sinKv.status, ilegible.status]).toEqual([404, 404]);
    expect(error).toHaveBeenCalledTimes(2);
  });
});

describe('un host con tienda', () => {
  const host = 'ensayo-uno--staging.laboratorio-digital.app';
  const env = (extra: Record<string, unknown> = {}) => {
    const a = api();
    return {
      a,
      env: {
        TIENDA_HOSTS: kv({ [`h:${host}`]: JSON.stringify({ ...UNO, version: 3 }) }),
        SECRETO_DESPACHO: SECRETO,
        API_C1: a.servicio,
        ...extra,
      } as Env,
    };
  };

  it('pasa /api/v1/* a la API de su celda con el secreto y la tienda resuelta', async () => {
    const { a, env: e } = env();
    const r = await crearDespacho().fetch(new Request(`https://${host}/api/v1/cotizar`), e);
    expect(r.status).toBe(200);
    const [recibida] = a.recibidas;
    expect(recibida?.headers.get(CABECERA_DESPACHO)).toBe(SECRETO);
    expect(JSON.parse(recibida?.headers.get(CABECERA_TIENDA) ?? '')).toEqual({
      org: UNO.org,
      shard: UNO.shard,
    });
  });

  it('❌ las cabeceras internas que llegan de afuera se reemplazan, nunca pasan (CA4)', async () => {
    const { a, env: e } = env();
    await crearDespacho().fetch(
      new Request(`https://${host}/api/v1/cotizar`, {
        headers: {
          [CABECERA_TIENDA]: '{"org":"otra","shard":"tienda_c1_s1"}',
          [CABECERA_DESPACHO]: 'adivinado',
        },
      }),
      e,
    );
    const [recibida] = a.recibidas;
    expect(JSON.parse(recibida?.headers.get(CABECERA_TIENDA) ?? '').org).toBe(UNO.org);
    expect(recibida?.headers.get(CABECERA_DESPACHO)).toBe(SECRETO);
  });

  it('❌ sin el secreto o sin la API de su celda responde 503, sin pasar nada', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const sinSecreto = env({ SECRETO_DESPACHO: undefined });
    const r1 = await crearDespacho().fetch(new Request(`https://${host}/api/v1/x`), sinSecreto.env);
    const r2 = await crearDespacho().fetch(
      new Request(`https://${host}/api/v1/x`),
      env({ API_C1: undefined }).env,
    );
    expect([r1.status, r2.status]).toEqual([503, 503]);
    expect(sinSecreto.a.recibidas).toHaveLength(0);
    expect(error).toHaveBeenCalledTimes(2);
  });

  it('sus páginas responden 404 hasta que el horno las sirva (HU-T5.1)', async () => {
    const { a, env: e } = env();
    const r = await crearDespacho().fetch(new Request(`https://${host}/p/vestido/`), e);
    expect(r.status).toBe(404);
    expect(a.recibidas).toHaveLength(0);
  });

  it('lee el KV una vez cada 30 s por host, no en cada visita', async () => {
    let t = 0;
    const despacho = crearDespacho({ ahora: () => t });
    const { env: e } = env();
    const lector = e.TIENDA_HOSTS as ReturnType<typeof kv>;
    await despacho.fetch(new Request(`https://${host}/`), e);
    t = CACHE_MS - 1;
    await despacho.fetch(new Request(`https://${host}/`), e);
    expect(lector.lecturas).toHaveLength(1);
    t = CACHE_MS;
    await despacho.fetch(new Request(`https://${host}/`), e);
    expect(lector.lecturas).toHaveLength(2);
  });
});
