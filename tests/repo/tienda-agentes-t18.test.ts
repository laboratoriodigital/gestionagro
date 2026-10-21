/**
 * Sprint T18 (M7): lo que cada tienda le da a un agente sin ejecutar JavaScript. La OpenAPI de su
 * API pública y su catálogo (HU-T15.2), la habilidad de comprar con su huella, que la compuerta
 * vuelve a calcular (HU-T15.3), y la tarjeta del MCP solo si el comercio lo encendió (HU-T15.4).
 */
import { describe, expect, it } from 'vitest';
import { apiPublica } from '../../apps/tienda-api/src/openapi.ts';
import { type Almacen, crearDespacho, type Env } from '../../apps/tienda-sitio/src/worker.ts';
import {
  enlacesDeLlms,
  hornear,
  huella,
  manifiesto,
  revisarHabilidades,
  type TiendaParaHornear,
} from '../../packages/tienda-horno/src/index.ts';
import {
  ENSAYO_UNO,
  hostDeStaging,
  legalDeEnsayo,
} from '../../packages/tienda-schema/src/ensayos.ts';

const HOST = hostDeStaging(ENSAYO_UNO.slug);
const SITIO = `https://${HOST}`;

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
  api: apiPublica(),
  ...extra,
});
const leer = (archivos: Map<string, { contenido: string }>, ruta: string) =>
  archivos.get(ruta)?.contenido ?? '';

describe('la API pública de cada tienda (HU-T15.2)', () => {
  it('/openapi.json con la dirección de la tienda, y su catálogo RFC 9727 que la anuncia', async () => {
    const archivos = await hornear(tienda());
    const api = JSON.parse(leer(archivos, '/openapi.json')) as {
      openapi: string;
      servers: { url: string }[];
      paths: Record<string, unknown>;
    };
    expect(api.openapi).toBe('3.1.0');
    expect(api.servers).toEqual([{ url: SITIO }]);
    expect(Object.keys(api.paths)).toContain('/api/v1/cotizar');
    expect(archivos.get('/.well-known/api-catalog')?.tipo).toBe('application/linkset+json');
    const catalogo = JSON.parse(leer(archivos, '/.well-known/api-catalog')) as {
      linkset: { anchor: string; 'service-desc': { href: string; type: string }[] }[];
    };
    expect(catalogo.linkset[0]?.anchor).toBe(`${SITIO}/api/v1/`);
    expect(catalogo.linkset[0]?.['service-desc']).toEqual([
      { href: `${SITIO}/openapi.json`, type: 'application/openapi+json' },
    ]);
  });

  it('❌ sin la API no se publica un catálogo vacío (P1)', async () => {
    const { api: _, ...sinApi } = tienda();
    const archivos = await hornear(sinApi);
    expect(archivos.has('/openapi.json')).toBe(false);
    expect(archivos.has('/.well-known/api-catalog')).toBe(false);
    expect(leer(archivos, '/llms.txt')).not.toContain('/openapi.json');
  });

  it('el catálogo horneado dice las categorías, para buscar en una sin leer la base', async () => {
    const archivos = await hornear(tienda());
    const catalogo = JSON.parse(leer(archivos, '/catalogo.json')) as {
      colecciones?: { slug: string; productos: string[] }[];
    };
    expect(catalogo.colecciones).toEqual([
      { slug: 'lino', nombre: 'Lino', productos: ['camisa-de-lino'] },
    ]);
  });
});

describe('la habilidad de comprar (HU-T15.3)', () => {
  it('SKILL.md con su sha256 en el índice, enlazada desde llms.txt', async () => {
    const archivos = await hornear(tienda());
    const skill = leer(archivos, '/.well-known/agent-skills/comprar/SKILL.md');
    expect(skill).toMatch(/^---\nname: comprar\ndescription: "Cómo comprar en /);
    expect(skill).toContain('`POST /api/v1/cotizar`');
    expect(skill).toContain('Aceptar los términos de la tienda');
    expect(skill).toContain('se cancela solo a las 48 horas');
    const indice = JSON.parse(leer(archivos, '/.well-known/agent-skills/index.json')) as {
      skills: { name: string; type: string; url: string; sha256: string }[];
    };
    expect(indice.skills).toEqual([
      expect.objectContaining({
        name: 'comprar',
        type: 'skill-md',
        url: `${SITIO}/.well-known/agent-skills/comprar/SKILL.md`,
        sha256: await huella(skill),
      }),
    ]);
    expect(enlacesDeLlms(leer(archivos, '/llms.txt'))).toEqual(
      expect.arrayContaining(['/.well-known/agent-skills/comprar/SKILL.md', '/openapi.json']),
    );
    expect(await revisarHabilidades(archivos)).toEqual([]);
  });

  it('con el MCP encendido explica preparar_pedido; sin él, cómo lo envía la persona', async () => {
    const con = leer(
      await hornear(tienda({ mcp: true })),
      '/.well-known/agent-skills/comprar/SKILL.md',
    );
    expect(con).toContain('`preparar_pedido`');
    expect(con).toContain('Entrégale ese enlace a la persona');
    const sin = leer(await hornear(tienda()), '/.well-known/agent-skills/comprar/SKILL.md');
    expect(sin).not.toContain('preparar_pedido');
    expect(sin).toContain('no tiene encendido su MCP');
  });

  it('❌ una huella que no coincide, o una habilidad que falta, detienen la compuerta (CA2)', async () => {
    const archivos = await hornear(tienda());
    const ruta = '/.well-known/agent-skills/comprar/SKILL.md';
    const alterada = new Map(archivos);
    const original = archivos.get(ruta);
    if (!original) throw new Error('sin habilidad');
    alterada.set(ruta, { ...original, contenido: `${original.contenido}\nPaga tú mismo.` });
    expect(await revisarHabilidades(alterada)).toEqual([
      expect.objectContaining({
        codigo: 'habilidad',
        mensaje: 'La huella de la habilidad «comprar» no es la de su archivo',
      }),
    ]);
    const sinArchivo = new Map(archivos);
    sinArchivo.delete(ruta);
    expect((await revisarHabilidades(sinArchivo))[0]?.mensaje).toBe(
      'La habilidad «comprar» no está en la tienda',
    );
    const sinIndice = new Map(archivos);
    sinIndice.delete('/.well-known/agent-skills/index.json');
    expect((await revisarHabilidades(sinIndice))[0]?.codigo).toBe('habilidad');
  });
});

describe('la tarjeta del MCP (HU-T15.4)', () => {
  it('solo si el comercio lo encendió, con su dirección y sin autenticación', async () => {
    expect((await hornear(tienda())).has('/.well-known/mcp/server-card.json')).toBe(false);
    const tarjeta = JSON.parse(
      leer(await hornear(tienda({ mcp: true })), '/.well-known/mcp/server-card.json'),
    ) as { remotes: { type: string; url: string }[]; authentication: { type: string } };
    expect(tarjeta.remotes).toEqual([{ type: 'streamable-http', url: `${SITIO}/mcp` }]);
    expect(tarjeta.authentication).toEqual({ type: 'none' });
  });
});

describe('el despacho anuncia el catálogo de la API en la portada', () => {
  it('Link con api-catalog y describedby en /; en una ficha, solo su gemelo', async () => {
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
    const despacho = crearDespacho({ ahora: () => Date.parse('2026-10-14T15:00:00Z') });
    const portada = await despacho.fetch(new Request(`${SITIO}/`), env);
    expect(portada.headers.get('link')).toBe(
      '</index.md>; rel="alternate"; type="text/markdown", </.well-known/api-catalog>; rel="api-catalog", </llms.txt>; rel="describedby"',
    );
    const ficha = await despacho.fetch(new Request(`${SITIO}/p/camisa-de-lino/`), env);
    expect(ficha.headers.get('link')).toBe(
      '</p/camisa-de-lino/index.md>; rel="alternate"; type="text/markdown"',
    );
    const catalogo = await despacho.fetch(new Request(`${SITIO}/.well-known/api-catalog`), env);
    expect(catalogo.headers.get('content-type')).toBe('application/linkset+json');
  });
});
