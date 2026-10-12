/**
 * HU-C8.5: lo legible por agentes, contra un sitio de mentira armado con las mismas funciones que el
 * build (robots, llms, habilidades). Lo que no ve (P17): las cabeceras que de verdad pone Cloudflare;
 * eso lo dice la corrida de staging, que corre esto mismo contra el sitio desplegado.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { type Agentes, robotsTxt } from '../../apps/sitio/src/lib/robots.ts';
import agentes from '../../content/agentes.json' with { type: 'json' };
import type { Fetch } from '../../scripts/lib/despliegue.ts';
import {
  type Esperado,
  type IndiceDeHabilidades,
  NO_APLICA,
  verificarAgentes,
} from '../../scripts/lib/verificar-agentes.ts';

const SITIO = 'https://cultivopro.co';
const BASE = 'https://s.dev';
const SKILL = '---\nname: calculadora-dpv\n---\n\n# Calculadora de DPV\n';
const huella = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const indice = (sha = huella(SKILL)): IndiceDeHabilidades => ({
  skills: [
    {
      name: 'calculadora-dpv',
      type: 'skill-md',
      description: 'DPV',
      url: `${SITIO}/.well-known/agent-skills/calculadora-dpv/SKILL.md`,
      sha256: sha,
    },
  ],
});
const lista = agentes as Agentes;
const esperado = (habilidades: IndiceDeHabilidades | null = indice()): Esperado => ({
  sitio: SITIO,
  agentes: lista.familias.flatMap((f) => f.agentes),
  habilidades,
});

type Respuesta = { estado: number; texto?: string; cabeceras?: Record<string, string> };
function sitio(cambios: Record<string, Respuesta | null> = {}) {
  const base: Record<string, Respuesta> = {
    '/robots.txt': { estado: 200, texto: robotsTxt(lista, SITIO) },
    '/sitemap.xml': {
      estado: 200,
      texto:
        '<?xml version="1.0"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n',
    },
    '/llms.txt': {
      estado: 200,
      texto: `# CultivoPro\n\n- [Guía](${SITIO}/agro/guia/index.md): cómo usarlo\n`,
    },
    '/agro/guia/index.md': { estado: 200, texto: '# Cómo usar CultivoPro\n' },
    '/agro/guia/': {
      estado: 200,
      texto: '<html>',
      cabeceras: {
        link: '</agro/guia/index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"',
      },
    },
    '/.well-known/agent-skills/index.json': { estado: 200, texto: JSON.stringify(indice()) },
    '/.well-known/agent-skills/calculadora-dpv/SKILL.md': { estado: 200, texto: SKILL },
    '/.well-known/security.txt': {
      estado: 200,
      texto: `Contact: mailto:c@example.com\nExpires: ${new Date(Date.now() + 90 * 864e5).toISOString()}\n`,
    },
  };
  const rutas = { ...base, ...cambios };
  const pedidos: string[] = [];
  const fn = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = String(entrada);
    pedidos.push(`${init?.method ?? 'GET'} ${url}`);
    const r = rutas[url.slice(BASE.length)] ?? { estado: 404 };
    return new Response(r.estado === 404 ? 'no' : (r.texto ?? ''), {
      status: r.estado,
      headers: r.cabeceras ?? {},
    });
  }) as Fetch;
  return { fn, pedidos };
}

describe('HU-C8.5 · verificar-agentes', () => {
  it('CA1 · un sitio sano pasa, solo con GET, y dice lo que no aplica todavía', async () => {
    const { fn, pedidos } = sitio();
    const informe = await verificarAgentes(fn, BASE, esperado());
    expect(informe.fallas).toEqual([]);
    expect(informe.noAplica).toEqual(NO_APLICA);
    // Sin la regla de la zona, la negociación de Markdown es un aviso, no una falla.
    expect(informe.avisos).toEqual([
      '/agro/guia/: con «Accept: text/markdown» todavía responde HTML (regla de la zona pendiente)',
    ]);
    expect(pedidos.every((p) => p.startsWith('GET '))).toBe(true);
  });

  it('CA1 · junta todas las fallas en un informe (P15)', async () => {
    const { fn } = sitio({
      '/robots.txt': { estado: 200, texto: 'User-agent: *\nDisallow:\n' },
      '/agro/guia/index.md': null,
      '/.well-known/security.txt': { estado: 200, texto: 'Expires: 2020-01-01T00:00:00Z\n' },
      '/.well-known/api-catalog': { estado: 200, texto: '{"linkset":[]}' },
    });
    const { fallas } = await verificarAgentes(fn, BASE, esperado());
    expect(fallas).toEqual(
      expect.arrayContaining([
        '/robots.txt: no anuncia el sitemap',
        '/robots.txt: no trae la Content-Signal con ai-train',
        '/robots.txt: no tiene un grupo para GPTBot',
        '/agro/guia/index.md: respondió 404, se esperaba 200',
        '/.well-known/api-catalog: publicado sin una API pública para terceros (P1)',
        '/.well-known/security.txt: sin Contact',
        '/.well-known/security.txt: Expires vencido o ausente',
      ]),
    );
  });

  it('CA2 ❌ · quitar una habilidad del sitio publicado detiene', async () => {
    const { fn } = sitio({
      '/.well-known/agent-skills/index.json': { estado: 200, texto: '{"skills":[]}' },
    });
    expect((await verificarAgentes(fn, BASE, esperado())).fallas).toEqual([
      'habilidad calculadora-dpv: está en el build y no en el índice publicado',
    ]);
  });

  it('CA2 ❌ · cambiar el sha256, o el SKILL.md, detiene', async () => {
    const otro = sitio({
      '/.well-known/agent-skills/index.json': {
        estado: 200,
        texto: JSON.stringify(indice('0'.repeat(64))),
      },
    });
    expect((await verificarAgentes(otro.fn, BASE, esperado())).fallas).toEqual([
      'habilidad calculadora-dpv: el sha256 publicado no es el del build',
    ]);
    const tocado = sitio({
      '/.well-known/agent-skills/calculadora-dpv/SKILL.md': {
        estado: 200,
        texto: `${SKILL}una línea más\n`,
      },
    });
    expect((await verificarAgentes(tocado.fn, BASE, esperado())).fallas).toEqual([
      'habilidad calculadora-dpv: el SKILL.md publicado no coincide con su sha256',
    ]);
  });

  it('sin habilidades en el build, publicar un índice también es una falla (P1)', async () => {
    const { fn } = sitio();
    expect((await verificarAgentes(fn, BASE, esperado(null))).fallas).toEqual([
      '/.well-known/agent-skills/index.json: publicado, pero el build no tiene habilidades',
    ]);
    const sinIndice = sitio({ '/.well-known/agent-skills/index.json': null });
    expect((await verificarAgentes(sinIndice.fn, BASE, esperado(null))).fallas).toEqual([]);
  });

  it('una página sin su cabecera Link se nombra', async () => {
    const { fn } = sitio({ '/agro/guia/': { estado: 200, texto: '<html>' } });
    expect((await verificarAgentes(fn, BASE, esperado())).fallas).toEqual([
      '/agro/guia/: la cabecera Link no anuncia /agro/guia/index.md',
    ]);
  });
});
