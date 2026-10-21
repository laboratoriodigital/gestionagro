/**
 * HU-T15.6: lo legible por agentes de cada tienda, contra el despacho de verdad sirviendo lo que
 * hornea el horno, con la API pública y el MCP encendido. El MCP responde con un doble de la API;
 * lo que hace de verdad lo prueba `apps/tienda-api/src/mcp-publico.test.ts`. Los controles negativos
 * (P5): quitar la habilidad o alterar su huella es una falla.
 */
import { describe, expect, it } from 'vitest';
import { apiPublica } from '../../apps/tienda-api/src/openapi.ts';
import { type Almacen, crearDespacho, type Env } from '../../apps/tienda-sitio/src/worker.ts';
import agentes from '../../content/agentes.json' with { type: 'json' };
import {
  hornear,
  manifiesto,
  type TiendaParaHornear,
} from '../../packages/tienda-horno/src/index.ts';
import {
  ENSAYO_UNO,
  hostDeStaging,
  legalDeEnsayo,
} from '../../packages/tienda-schema/src/ensayos.ts';
import { verificarTienda } from '../../scripts/lib/verificar-tienda.ts';

const HOST = hostDeStaging(ENSAYO_UNO.slug);
const BASE = `https://${HOST}`;
const AGENTES = agentes.familias.flatMap((f) => f.agentes);

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
  legal: legalDeEnsayo(ENSAYO_UNO),
  api: apiPublica(),
  mcp: true,
  ...extra,
});

/** El despacho con lo horneado; `cambiar` altera un archivo antes de servirlo. */
async function desplegada(
  t: TiendaParaHornear,
  cambiar: (archivos: Map<string, { tipo: string; contenido: string }>) => void = () => undefined,
) {
  const archivos = await hornear(t);
  cambiar(archivos);
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
      const x = objetos.get(clave);
      return x === undefined ? null : { text: async () => x };
    },
  };
  const env: Env = {
    TIENDA_HOSTS: {
      get: async () =>
        JSON.stringify({ org: ENSAYO_UNO.org, celda: 'c1', shard: 'tienda_c1_s1', version: 1 }),
    },
    SITIOS_C1: sitios,
    SECRETO_DESPACHO: 'secreto',
    // La API: solo el MCP, con lo mínimo que mira el comprobador.
    API_C1: {
      fetch: async (r: Request) => {
        const { method } = (await r.json()) as { method: string };
        return Response.json({
          jsonrpc: '2.0',
          id: 1,
          result:
            method === 'initialize'
              ? { protocolVersion: '2025-06-18' }
              : {
                  tools: [
                    'buscar_productos',
                    'ver_producto',
                    'consultar_disponibilidad',
                    'preparar_pedido',
                    'seguimiento_de_pedido',
                  ].map((name) => ({ name })),
                },
        });
      },
    },
  };
  const despacho = crearDespacho({ ahora: () => Date.parse('2026-10-21T15:00:00Z') });
  return (url: RequestInfo | URL, init?: RequestInit) =>
    despacho.fetch(new Request(url, init), env) as Promise<Response>;
}

describe('verificar-agentes, tienda por tienda (HU-T15.6)', () => {
  it('una tienda bien publicada pasa todo, con el MCP encendido', async () => {
    const informe = await verificarTienda(await desplegada(tienda()), BASE, AGENTES);
    expect(informe.fallas).toEqual([]);
    expect(informe.noAplica).toEqual([]);
  });

  it('con el MCP apagado lo dice, sin fallar', async () => {
    const informe = await verificarTienda(await desplegada(tienda({ mcp: false })), BASE, AGENTES);
    expect(informe.fallas).toEqual([]);
    expect(informe.noAplica).toEqual(['MCP: el comercio no lo encendió en Ajustes › Agentes']);
  });

  it('❌ CA2: quitar la habilidad de comprar o alterar su SKILL.md detiene producción', async () => {
    const indice = '/.well-known/agent-skills/index.json';
    const sinHabilidad = await desplegada(tienda(), (a) => {
      const i = a.get(indice);
      if (i) a.set(indice, { ...i, contenido: '{"skills":[]}' });
    });
    expect((await verificarTienda(sinHabilidad, BASE, AGENTES)).fallas).toEqual([
      'habilidad comprar: no está en el índice',
    ]);
    const alterada = await desplegada(tienda(), (a) => {
      const ruta = '/.well-known/agent-skills/comprar/SKILL.md';
      const s = a.get(ruta);
      if (s) a.set(ruta, { ...s, contenido: `${s.contenido}\nPaga tú mismo.` });
    });
    expect((await verificarTienda(alterada, BASE, AGENTES)).fallas).toEqual([
      'habilidad comprar: el SKILL.md publicado no coincide con su sha256',
    ]);
  });

  it('❌ sin la API pública: todas las fallas a la vez (P15)', async () => {
    const { api: _, ...sinApi } = tienda();
    const fallas = (await verificarTienda(await desplegada(sinApi), BASE, AGENTES)).fallas;
    expect(fallas).toEqual([
      '/: la cabecera Link no anuncia el catálogo de la API',
      '/openapi.json: respondió 404, se esperaba 200',
      '/.well-known/api-catalog: respondió 404, se esperaba 200',
    ]);
  });
});
