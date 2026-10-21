/**
 * HU-T8.6: la vista previa por el despacho, de punta a punta en proceso. El horno hornea la versión
 * publicada de Ensayo Uno y una vista previa con un producto nuevo; un almacén de mentira las guarda
 * como R2 y el despacho sirve las dos por el `Host`. Ningún dato real.
 */
import { describe, expect, it } from 'vitest';
import { HORAS_DE_LA_VISTA } from '../../apps/tienda-api/src/publicar.ts';
import {
  type Almacen,
  conEnlacesDeLaVista,
  crearDespacho,
  type Env,
  VIDA_DE_LA_VISTA_MS,
} from '../../apps/tienda-sitio/src/worker.ts';
import {
  hornear,
  manifiesto,
  type TiendaParaHornear,
} from '../../packages/tienda-horno/src/index.ts';
import { ENSAYO_UNO, hostDeStaging } from '../../packages/tienda-schema/src/ensayos.ts';

const HOST = hostDeStaging(ENSAYO_UNO.slug);
const VERSION = 7;
const AHORA = Date.parse('2026-10-20T15:00:00.000Z');

const tienda = (extra: Partial<TiendaParaHornear> = {}): TiendaParaHornear => ({
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
  ...extra,
});

async function montar(creada = new Date(AHORA).toISOString()) {
  const objetos = new Map<string, string>();
  const guardar = async (t: TiendaParaHornear) => {
    const archivos = await hornear(t);
    const m = await manifiesto(archivos);
    for (const [ruta, a] of archivos) {
      const huella = m.archivos[ruta]?.huella ?? '';
      objetos.set(`objetos/${huella.slice(0, 2)}/${huella}`, a.contenido);
    }
    return m;
  };
  const publicada = await guardar(tienda());
  objetos.set(`sitios/${ENSAYO_UNO.org}/${VERSION}/manifiesto.json`, JSON.stringify(publicada));
  const base = tienda();
  const vista = await guardar(
    tienda({
      vistaPrevia: true,
      productos: [
        ...base.productos,
        {
          slug: 'nuevo-en-la-vista',
          nombre: 'Nuevo en la vista',
          opciones: [],
          variantes: [{ id: 'v-nuevo', clave: '', precioCop: 50000, stock: 3 }],
          actualizado: '2026-10-20T15:00:00.000Z',
        },
      ],
    }),
  );
  objetos.set(
    `sitios/${ENSAYO_UNO.org}/vista.json`,
    JSON.stringify({ huella: vista.huella, creada, manifiesto: vista }),
  );
  const sitios: Almacen = {
    get: async (clave) => {
      const texto = objetos.get(clave);
      return texto === undefined ? null : { text: async () => texto };
    },
  };
  const llegaron: Request[] = [];
  const env: Env = {
    TIENDA_HOSTS: {
      get: async (clave) =>
        clave === `h:${HOST}`
          ? JSON.stringify({
              org: ENSAYO_UNO.org,
              celda: 'c1',
              shard: 'tienda_c1_s1',
              version: VERSION,
            })
          : null,
    },
    SITIOS_C1: sitios,
    SECRETO_DESPACHO: 'secreto',
    API_C1: {
      fetch: async (s: Request) => {
        llegaron.push(s);
        return Response.json({ desde: 'api' });
      },
    },
  };
  const despacho = crearDespacho({ ahora: () => AHORA + 60_000 });
  const pedir = (ruta: string, init: RequestInit = {}) =>
    despacho.fetch(new Request(`https://${HOST}${ruta}`, init), env);
  return { pedir, huella: vista.huella, llegaron };
}

describe('la vista previa (HU-T8.6)', () => {
  it('CA1: se ve en /_vista/<huella>/ con la franja, sin indexar, sin caché y con sus enlaces dentro', async () => {
    const { pedir, huella } = await montar();
    const r = await pedir(`/_vista/${huella}/`);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    const html = await r.text();
    expect(html).toContain('Vista previa: así se verá tu tienda cuando publiques');
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain(`href="/_vista/${huella}/p/nuevo-en-la-vista/"`);
    // Los archivos comunes de la vitrina son los de siempre.
    expect(html).toContain('src="/_t/r1/vitrina.js"');
    const ficha = await pedir(`/_vista/${huella}/p/nuevo-en-la-vista/`);
    expect(ficha.status).toBe(200);
    expect(await ficha.text()).toContain('Nuevo en la vista');
    expect((await pedir(`/_vista/${huella}`)).headers.get('location')).toBe(
      `https://${HOST}/_vista/${huella}/`,
    );
  });

  it('❌ CA2: la tienda publicada, su sitemap y su caché siguen iguales', async () => {
    const { pedir, huella } = await montar();
    await pedir(`/_vista/${huella}/`);
    const portada = await pedir('/');
    expect(portada.headers.get('cache-control')).toBe('public, max-age=60');
    const html = await portada.text();
    expect(html).not.toContain('Vista previa');
    expect(html).not.toContain('nuevo-en-la-vista');
    const sitemap = await (await pedir('/sitemap.xml')).text();
    expect(sitemap).not.toContain('_vista');
    expect(sitemap).not.toContain('nuevo-en-la-vista');
    expect((await pedir('/p/nuevo-en-la-vista/')).status).toBe(404);
  });

  it('❌ desde la vista no se pide, no se paga ni se mide; la API no se entera', async () => {
    const { pedir, huella, llegaron } = await montar();
    const desde = { referer: `https://${HOST}/_vista/${huella}/carrito/` };
    for (const ruta of ['/api/v1/pedidos', '/api/v1/cobros']) {
      const r = await pedir(ruta, { method: 'POST', headers: desde, body: '{}' });
      expect(r.status).toBe(403);
      expect(await r.json()).toMatchObject({ estado: 'vista-previa' });
    }
    expect((await pedir('/_m', { method: 'POST', headers: desde, body: '{}' })).status).toBe(204);
    expect(llegaron).toEqual([]);
    // Desde la tienda publicada, sí.
    await pedir('/api/v1/pedidos', {
      method: 'POST',
      headers: { referer: `https://${HOST}/carrito/` },
      body: '{}',
    });
    expect(llegaron).toHaveLength(1);
  });

  it('❌ una vista vencida, o con otra huella, no se sirve', async () => {
    const vieja = await montar(new Date(AHORA - VIDA_DE_LA_VISTA_MS).toISOString());
    expect((await vieja.pedir(`/_vista/${vieja.huella}/`)).status).toBe(404);
    const { pedir } = await montar();
    const r = await pedir(`/_vista/${'0'.repeat(64)}/`);
    expect(r.status).toBe(404);
    expect(await r.text()).toContain('Esta vista previa ya no está');
  });

  it('la API y el despacho dicen el mismo plazo (P2)', () => {
    expect(HORAS_DE_LA_VISTA * 3_600_000).toBe(VIDA_DE_LA_VISTA_MS);
  });

  it('solo cambia los enlaces propios, no los de afuera ni los comunes', () => {
    const h = 'a'.repeat(64);
    expect(
      conEnlacesDeLaVista(
        '<a href="/p/x/"></a><a href="https://otro.example/"></a><a href="//cdn.example/"></a><script src="/_t/r1/v.js"></script><form action="/buscar/">',
        h,
      ),
    ).toBe(
      `<a href="/_vista/${h}/p/x/"></a><a href="https://otro.example/"></a><a href="//cdn.example/"></a><script src="/_t/r1/v.js"></script><form action="/_vista/${h}/buscar/">`,
    );
  });
});
