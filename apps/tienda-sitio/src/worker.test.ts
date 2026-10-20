/**
 * El despacho de la Tienda (HU-T2.4): resuelve la tienda por el `Host` sin tocar la base, con su
 * caché de 30 s; un host sin tienda responde la página neutra, y las cabeceras internas que llegan
 * de afuera nunca llegan a la API (CA4).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MEDIOS_DE_LA_TIENDA } from '../../../scripts/generar-wrangler.ts';
import {
  CABECERA_DESPACHO,
  CABECERA_IP,
  CABECERA_TIENDA,
  CACHE_MS,
  crearDespacho,
  DIRECCIONES_DE_LA_PLATAFORMA,
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

describe('las direcciones de la plataforma que cubre el comodín (HU-T13.4)', () => {
  it('las fotos siguen a su origen: el despacho no las toma por una tienda ni lee el KV', async () => {
    const hosts = kv({});
    const alOrigen: Request[] = [];
    const despacho = crearDespacho({
      alOrigen: async (s) => {
        alOrigen.push(s);
        return new Response('foto', { headers: { 'content-type': 'image/avif' } });
      },
    });
    for (const host of DIRECCIONES_DE_LA_PLATAFORMA) {
      const r = await despacho.fetch(new Request(`https://${host}/org/foto-800.avif`), {
        TIENDA_HOSTS: hosts,
      });
      expect(await r.text()).toBe('foto');
    }
    expect(alOrigen.map((s) => new URL(s.url).hostname)).toEqual([...DIRECCIONES_DE_LA_PLATAFORMA]);
    expect(hosts.lecturas).toEqual([]);
  });

  it('son las mismas que el despliegue da a las fotos (P2)', () => {
    expect([...DIRECCIONES_DE_LA_PLATAFORMA].sort()).toEqual(
      Object.values(MEDIOS_DE_LA_TIENDA).sort(),
    );
  });
});

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

  it('❌ una página de una tienda publicada sin almacén responde 503, nunca va a la API (HU-T5.1)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { a, env: e } = env();
    const r = await crearDespacho().fetch(new Request(`https://${host}/p/vestido/`), e);
    expect(r.status).toBe(503);
    expect(error).toHaveBeenCalled();
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

describe('los kill switches del despacho (HU-T2.7, TIENDA §15.2)', () => {
  const host = 'ensayo-uno--staging.laboratorio-digital.app';
  const otro = 'ensayo-dos--staging.laboratorio-digital.app';
  const DOS = { org: 'org-ensayo-dos', celda: 'c1', shard: 'tienda_c1_s1' };
  const env = (flags: Record<string, string>) => ({
    TIENDA_HOSTS: kv({ [`h:${host}`]: JSON.stringify(UNO), [`h:${otro}`]: JSON.stringify(DOS) }),
    FLAGS: kv(flags),
    SECRETO_DESPACHO: SECRETO,
    API_C1: api().servicio,
  });

  it('con ks:tienda apagado, toda tienda dice «Volvemos pronto» y no se guarda en caché', async () => {
    const despacho = crearDespacho();
    const e = env({ 'ks:tienda': 'apagado' });
    for (const h of [host, otro]) {
      const r = await despacho.fetch(new Request(`https://${h}/api/v1/cotizar`), e);
      expect(r.status).toBe(503);
      expect(await r.text()).toContain('Volvemos pronto');
      expect(r.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('con ks:tienda:<org> apagado, solo esa tienda queda en pausa', async () => {
    const despacho = crearDespacho();
    const e = env({ [`ks:tienda:${UNO.org}`]: 'apagado' });
    const una = await despacho.fetch(new Request(`https://${host}/api/v1/cotizar`), e);
    const dos = await despacho.fetch(new Request(`https://${otro}/api/v1/cotizar`), e);
    expect(una.status).toBe(503);
    expect(await una.text()).toContain('Esta tienda no está disponible por ahora');
    expect(dos.status).toBe(200);
  });

  it('❌ un host sin tienda sigue siendo «sin tienda», aunque todo esté apagado', async () => {
    const r = await crearDespacho().fetch(
      new Request('https://nadie.laboratorio-digital.app/'),
      env({ 'ks:tienda': 'apagado' }),
    );
    expect(r.status).toBe(404);
  });
});

describe('un alias lleva a la dirección canónica (HU-T13.2)', () => {
  const plataforma = 'ensayo-uno.laboratorio-digital.app';
  const propio = 'www.tienda-uno.example';
  const env = (canonico: string) => {
    const a = api();
    return {
      a,
      env: {
        TIENDA_HOSTS: kv({
          [`h:${plataforma}`]: JSON.stringify({ ...UNO, version: 3, canonico, rol: 'alias' }),
        }),
        SECRETO_DESPACHO: SECRETO,
        API_C1: a.servicio,
      } as Env,
    };
  };

  it('CA1: 301 a la canónica, con la ruta y la consulta intactas', async () => {
    const { env: e } = env(propio);
    const r = await crearDespacho().fetch(
      new Request(`https://${plataforma}/p/camisa-de-lino/?talla=m&utm_source=wa`),
      e,
    );
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe(
      `https://${propio}/p/camisa-de-lino/?talla=m&utm_source=wa`,
    );
  });

  it('❌ CA2: la API nunca se redirige, ni el aviso de Bold', async () => {
    const { a, env: e } = env(propio);
    const despacho = crearDespacho();
    const aviso = await despacho.fetch(
      new Request(`https://${plataforma}/api/v1/avisos/bold`, { method: 'POST', body: '{}' }),
      e,
    );
    const cotizar = await despacho.fetch(new Request(`https://${plataforma}/api/v1/cotizar`), e);
    expect([aviso.status, cotizar.status]).toEqual([200, 200]);
    expect(a.recibidas.map((x) => new URL(x.url).pathname)).toEqual([
      '/api/v1/avisos/bold',
      '/api/v1/cotizar',
    ]);
  });

  it('❌ una canónica que no es un hostname no redirige a ninguna parte (P1)', async () => {
    for (const malo of ['https://otro.example/', 'otro.example/ruta', 'javascript:alert(1)', '']) {
      const { env: e } = env(malo);
      const r = await crearDespacho().fetch(new Request(`https://${plataforma}/`), e);
      expect(r.status, malo).not.toBe(301);
    }
  });
});

describe('la IP del comprador para los límites de la API (bitácora tienda3 37)', () => {
  const host = 'ensayo-uno--staging.laboratorio-digital.app';
  it('el despacho la pasa en su cabecera, y ❌ la que llega de afuera se reemplaza', async () => {
    const a = api();
    const env = {
      TIENDA_HOSTS: kv({ [`h:${host}`]: JSON.stringify({ ...UNO, version: 3 }) }),
      SECRETO_DESPACHO: SECRETO,
      API_C1: a.servicio,
    } as Env;
    await crearDespacho().fetch(
      new Request(`https://${host}/api/v1/cotizar`, {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.7', [CABECERA_IP]: '198.51.100.1' },
      }),
      env,
    );
    await crearDespacho().fetch(
      new Request(`https://${host}/api/v1/cotizar`, {
        method: 'POST',
        headers: { [CABECERA_IP]: '198.51.100.1' },
      }),
      env,
    );
    expect(a.recibidas.map((r) => r.headers.get(CABECERA_IP))).toEqual(['203.0.113.7', null]);
  });
});

describe('una tienda suspendida (HU-T13.6)', () => {
  const host = 'ensayo-uno--staging.laboratorio-digital.app';
  const otra = 'ensayo-dos--staging.laboratorio-digital.app';
  it('responde 451 con la página neutra, también en su API; la otra tienda sigue', async () => {
    const a = api();
    const env = {
      TIENDA_HOSTS: kv({
        [`h:${host}`]: JSON.stringify({ ...UNO, version: 3, estado: 'suspendida' }),
        [`h:${otra}`]: JSON.stringify({
          ...UNO,
          org: 'org-ensayo-dos',
          version: 2,
          estado: 'abierta',
        }),
      }),
      SECRETO_DESPACHO: SECRETO,
      API_C1: a.servicio,
    } as Env;
    const despacho = crearDespacho();
    const pagina = await despacho.fetch(new Request(`https://${host}/`), env);
    expect(pagina.status).toBe(451);
    expect(await pagina.text()).toContain('Esta tienda no está disponible');
    expect(pagina.headers.get('cache-control')).toBe('no-store');
    const suApi = await despacho.fetch(new Request(`https://${host}/api/v1/cotizar`), env);
    expect(suApi.status).toBe(451);
    const deLaOtra = await despacho.fetch(new Request(`https://${otra}/api/v1/cotizar`), env);
    expect(deLaOtra.status).toBe(200);
    expect(a.recibidas).toHaveLength(1);
  });
});
