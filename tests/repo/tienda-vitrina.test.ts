/**
 * HU-T5.1: el despacho sirve la tienda horneada, sin tocar la base. De punta a punta en proceso: el
 * horno hornea a Ensayo Uno (HU-T4.1), un almacén de mentira guarda su manifiesto y sus objetos como
 * los guardará R2, y el despacho los sirve por el `Host`. El shard es una trampa: si alguien le
 * habla, la prueba falla (CA3).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  type Almacen,
  crearDespacho,
  type Env,
  esDeLaApi,
} from '../../apps/tienda-sitio/src/worker.ts';
import { hornear, manifiesto } from '../../packages/tienda-horno/src/index.ts';
import { ENSAYO_UNO, hostDeStaging } from '../../packages/tienda-schema/src/ensayos.ts';

const HOST = hostDeStaging(ENSAYO_UNO.slug);
const VERSION = 7;

/** Un shard que falla si se le habla: el despacho nunca toca la base. */
const trampa = new Proxy(
  {},
  {
    get() {
      throw new Error('el despacho le habló a la base');
    },
  },
);

async function montar(opciones: { version?: number | null; sinAlmacen?: boolean } = {}) {
  const archivos = await hornear({
    dominio: HOST,
    release: 'r1',
    nombre: ENSAYO_UNO.nombre,
    apariencia: {
      acento: '#9c4a1a',
      tinta: 'negra',
      estilo: 'precision',
      portada: 'catalogo',
      proporcion: '1:1',
      modo: 'claro',
    },
    agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
    productos: ENSAYO_UNO.productos.map((p) => ({
      slug: p.slug,
      nombre: p.nombre,
      opciones: p.opciones,
      variantes: p.variantes,
      actualizado: '2026-10-13T15:00:00.000Z',
    })),
  });
  const m = await manifiesto(archivos);
  const objetos = new Map<string, string>();
  objetos.set(`sitios/${ENSAYO_UNO.org}/${VERSION}/manifiesto.json`, JSON.stringify(m));
  for (const [ruta, a] of archivos) {
    const huella = m.archivos[ruta]?.huella ?? '';
    objetos.set(`objetos/${huella.slice(0, 2)}/${huella}`, a.contenido);
  }
  const lecturas: string[] = [];
  const sitios: Almacen = {
    get: async (clave) => {
      lecturas.push(clave);
      const texto = objetos.get(clave);
      return texto === undefined ? null : { text: async () => texto };
    },
  };
  const version = opciones.version === undefined ? VERSION : opciones.version;
  const env: Env = {
    TIENDA_HOSTS: {
      get: async (clave) =>
        clave === `h:${HOST}`
          ? JSON.stringify({ org: ENSAYO_UNO.org, celda: 'c1', shard: 'tienda_c1_s1', version })
          : null,
    },
    ...(opciones.sinAlmacen ? {} : { SITIOS: sitios }),
    SECRETO_DESPACHO: 'secreto',
    API_C1: { fetch: async () => Response.json({ desde: 'api' }) },
    tienda_c1_s1: trampa,
  };
  return { env, lecturas, despacho: crearDespacho() };
}

const pedir = (d: Awaited<ReturnType<typeof montar>>, ruta: string, init: RequestInit = {}) =>
  d.despacho.fetch(new Request(`https://${HOST}${ruta}`, init), d.env);

describe('la vitrina por el despacho (HU-T5.1)', () => {
  it('la portada y la ficha salen del almacén, con las cabeceras de la vitrina', async () => {
    const d = await montar();
    const portada = await pedir(d, '/');
    expect(portada.status).toBe(200);
    expect(await portada.text()).toContain('<h1>Comercio Ensayo Uno</h1>');
    expect(portada.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(portada.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(portada.headers.get('strict-transport-security')).toBe('max-age=31536000');
    expect(portada.headers.get('vary')).toBe('Accept');
    const ficha = await pedir(d, '/p/camisa-de-lino/');
    expect(await ficha.text()).toContain('"@type":"Product"');
  });

  it('con Accept: text/markdown, el gemelo', async () => {
    const d = await montar();
    const r = await pedir(d, '/p/camisa-de-lino/', { headers: { accept: 'text/markdown' } });
    expect(r.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(await r.text()).toMatch(/^# Camisa de lino/);
  });

  it('sin la barra final, redirige a la ruta con barra', async () => {
    const r = await pedir(await montar(), '/p/camisa-de-lino');
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe(`https://${HOST}/p/camisa-de-lino/`);
  });

  it('el sitemap, robots y el catálogo también', async () => {
    const d = await montar();
    for (const ruta of ['/sitemap.xml', '/robots.txt', '/catalogo.json']) {
      expect((await pedir(d, ruta)).status, ruta).toBe(200);
    }
  });

  it('el manifiesto se lee una vez: una versión publicada no cambia', async () => {
    const d = await montar();
    await pedir(d, '/');
    await pedir(d, '/p/camisa-de-lino/');
    expect(d.lecturas.filter((c) => c.endsWith('manifiesto.json'))).toHaveLength(1);
  });

  it('lo de la API va a la API, nunca al almacén ni a una redirección', async () => {
    const d = await montar();
    for (const ruta of ['/api/v1/cotizar', '/mcp', '/_m']) {
      expect(await (await pedir(d, ruta, { method: 'POST' })).json()).toEqual({ desde: 'api' });
    }
    expect(esDeLaApi('/mcpx')).toBe(false);
  });

  it('❌ una ruta que no está responde 404, sin tocar la base (CA3)', async () => {
    const r = await pedir(await montar(), '/p/no-existe/');
    expect(r.status).toBe(404);
    expect(await r.text()).toContain('Esta página no existe');
  });

  it('❌ una tienda sin versión publicada: «todavía no abre»', async () => {
    const r = await pedir(await montar({ version: null }), '/');
    expect(r.status).toBe(404);
    expect(await r.text()).toContain('Esta tienda todavía no abre');
  });

  it('❌ sin almacén responde 503 y lo registra, nunca una página vacía', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await pedir(await montar({ sinAlmacen: true }), '/');
    expect(r.status).toBe(503);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('❌ un KV que falla no se guarda en la caché: la siguiente visita vuelve a preguntar (P7)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const d = await montar();
    let falla = true;
    const kv = d.env.TIENDA_HOSTS;
    d.env.TIENDA_HOSTS = {
      get: async (clave) => {
        if (falla) throw new Error('KV caído');
        return kv?.get(clave) ?? null;
      },
    };
    expect((await pedir(d, '/')).status).toBe(503);
    falla = false;
    expect((await pedir(d, '/')).status).toBe(200);
    error.mockRestore();
  });

  it('❌ escribir en una página responde 405', async () => {
    expect((await pedir(await montar(), '/', { method: 'POST' })).status).toBe(405);
  });
});
