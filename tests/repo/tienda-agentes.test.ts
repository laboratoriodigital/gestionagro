/**
 * HU-T15.1: cada tienda, legible por agentes sin ejecutar JavaScript. El robots con las familias de
 * `content/agentes.json` y las señales de **esa** tienda; `llms.txt` con enlaces que existen (si no,
 * la compuerta no publica: CA3); el manifiesto de la app web; el gemelo `.md` anunciado también en
 * la cabecera `Link` (CA2) y `security.txt` servido por el despacho, con su `Expires` vigente.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type Almacen, crearDespacho, type Env } from '../../apps/tienda-sitio/src/worker.ts';
import {
  compuerta,
  enlacesDeLlms,
  FAMILIAS_DE_AGENTES,
  hornear,
  manifiesto,
  robotsDeLaTienda,
  type TiendaParaHornear,
} from '../../packages/tienda-horno/src/index.ts';
import {
  ENSAYO_UNO,
  hostDeStaging,
  legalDeEnsayo,
} from '../../packages/tienda-schema/src/ensayos.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const HOST = hostDeStaging(ENSAYO_UNO.slug);

const tienda = (extra: Partial<TiendaParaHornear> = {}): TiendaParaHornear => ({
  dominio: HOST,
  release: 'r1',
  nombre: ENSAYO_UNO.nombre,
  frase: 'Ropa de lino, hecha despacio.',
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
  colecciones: [{ slug: 'lino', nombre: 'Lino', productos: ['camisa-de-lino'] }],
  legal: legalDeEnsayo(ENSAYO_UNO),
  ...extra,
});

describe('el robots de cada tienda (CA1)', () => {
  it('lleva las familias de content/agentes.json, sin agentes escritos en el código (P2)', () => {
    const json = JSON.parse(readFileSync(join(RAIZ, 'content', 'agentes.json'), 'utf8')) as {
      familias: { agentes: string[] }[];
    };
    const robots = robotsDeLaTienda(tienda().agentes, `https://${HOST}`);
    for (const agente of json.familias.flatMap((f) => f.agentes)) {
      expect(robots).toContain(`User-agent: ${agente}\n`);
    }
    expect(FAMILIAS_DE_AGENTES.length).toBe(json.familias.length);
    expect(robots).toContain('Content-Signal: search=yes, ai-input=yes, ai-train=no');
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toContain(`Sitemap: https://${HOST}/sitemap.xml`);
  });

  it('❌ la familia de entrenamiento no lee nada si la tienda dice ai-train=no; sí si dice yes', () => {
    const grupo = (r: string) =>
      r.split('\n\n').find((g) => g.includes('User-agent: GPTBot')) ?? '';
    const no = robotsDeLaTienda({ search: 'yes', aiInput: 'yes', aiTrain: 'no' }, 'https://x');
    const si = robotsDeLaTienda({ search: 'yes', aiInput: 'yes', aiTrain: 'yes' }, 'https://x');
    expect(grupo(no)).toContain('Disallow: /\n'.trimEnd());
    expect(grupo(no)).not.toContain('Allow: /');
    expect(grupo(si)).toContain('Allow: /');
  });
});

describe('llms.txt, el manifiesto y el gemelo anunciado', () => {
  it('llms.txt enlaza a los gemelos que existen en lo horneado', async () => {
    const archivos = await hornear(tienda());
    const llms = archivos.get('/llms.txt')?.contenido ?? '';
    expect(llms.startsWith('# Comercio Ensayo Uno\n\n> Ropa de lino, hecha despacio.')).toBe(true);
    const enlaces = enlacesDeLlms(llms);
    expect(enlaces).toEqual([
      '/p/camisa-de-lino/index.md',
      '/c/lino/index.md',
      '/legal/terminos/index.md',
      '/legal/privacidad/index.md',
      '/legal/envios/index.md',
      '/legal/retracto/index.md',
      '/legal/garantia/index.md',
      '/solicitud/index.md',
      '/catalogo.md',
    ]);
    for (const e of enlaces) expect(archivos.has(e)).toBe(true);
  });

  it('❌ un enlace de llms.txt que no existe detiene la compuerta (CA3)', async () => {
    const archivos = new Map(await hornear(tienda()));
    const llms = archivos.get('/llms.txt');
    if (!llms) throw new Error('sin llms.txt');
    archivos.set('/llms.txt', {
      ...llms,
      contenido: `${llms.contenido}- [Viejo](/p/ya-no-esta/index.md)\n`,
    });
    const fallas = compuerta({ ajustes: {}, productos: [], archivos }).fallas.filter(
      (f) => f.codigo === 'enlace-roto',
    );
    expect(fallas.map((f) => f.mensaje)).toEqual([
      'El índice para asistentes (llms.txt) enlaza a /p/ya-no-esta/index.md, que no existe',
    ]);
  });

  it('el manifiesto de la app web lleva el nombre y el color de la tienda', async () => {
    const archivos = await hornear(tienda());
    const m = archivos.get('/manifest.webmanifest');
    expect(m?.tipo).toBe('application/manifest+json');
    expect(JSON.parse(m?.contenido ?? '{}')).toMatchObject({
      name: 'Comercio Ensayo Uno',
      start_url: '/',
      theme_color: '#9c4a1a',
    });
    expect(archivos.get('/index.html')?.contenido).toContain(
      '<link rel="manifest" href="/manifest.webmanifest">',
    );
  });
});

describe('lo que sirve el despacho (CA2)', () => {
  async function montar() {
    const archivos = await hornear(tienda());
    const m = await manifiesto(archivos);
    const objetos = new Map<string, string>([
      [`sitios/${ENSAYO_UNO.org}/1/manifiesto.json`, JSON.stringify(m)],
    ]);
    for (const [ruta, a] of archivos) {
      const h = m.archivos[ruta]?.huella ?? '';
      objetos.set(`objetos/${h.slice(0, 2)}/${h}`, a.contenido);
    }
    const sitios: Almacen = {
      get: async (clave) => {
        const t = objetos.get(clave);
        return t === undefined ? null : { text: async () => t };
      },
    };
    const env: Env = {
      TIENDA_HOSTS: {
        get: async () =>
          JSON.stringify({ org: ENSAYO_UNO.org, celda: 'c1', shard: 'tienda_c1_s1', version: 1 }),
      },
      SITIOS_C1: sitios,
    };
    return { env, despacho: crearDespacho({ ahora: () => Date.parse('2026-10-14T15:00:00Z') }) };
  }

  it('cada página dice dónde está su gemelo en la cabecera Link; un archivo suelto, no', async () => {
    const { env, despacho } = await montar();
    const ficha = await despacho.fetch(new Request(`https://${HOST}/p/camisa-de-lino/`), env);
    expect(ficha.headers.get('link')).toBe(
      '</p/camisa-de-lino/index.md>; rel="alternate"; type="text/markdown"',
    );
    const robots = await despacho.fetch(new Request(`https://${HOST}/robots.txt`), env);
    expect(robots.headers.get('link')).toBeNull();
  });

  it('security.txt con el correo de la plataforma y un Expires de menos de un año', async () => {
    const { env, despacho } = await montar();
    const r = await despacho.fetch(new Request(`https://${HOST}/.well-known/security.txt`), env);
    const texto = await r.text();
    expect(r.status).toBe(200);
    expect(texto).toContain('Contact: mailto:laboratoriodigital.la@gmail.com');
    expect(texto).toContain('Expires: 2027-04-12T00:00:00Z');
    expect(texto).toContain(`Canonical: https://${HOST}/.well-known/security.txt`);
  });
});
