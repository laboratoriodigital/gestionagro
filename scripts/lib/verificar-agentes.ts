/**
 * Las comprobaciones de lo legible por agentes (HU-C8.5, PLATAFORMA §5.1 y §5.8), contra el sitio
 * desplegado y sin depender de un servicio externo. Corre en la prueba de humo del despliegue: en
 * staging, una falla detiene el trabajo y producción no sale (P16). Junta todas las fallas en un
 * informe (P15).
 *
 * Lo que hoy se exige, por grupo:
 * - **Descubrimiento:** `robots.txt` con su `Sitemap`; `sitemap.xml` bien formado; la cabecera
 *   `Link` de cada página pública hacia su gemelo y hacia `llms.txt`.
 * - **Contenido:** `llms.txt` con cada enlace vivo, y cada gemelo en Markdown.
 * - **Control de bots:** la `Content-Signal` y un grupo por agente de `content/agentes.json`.
 * - **Capacidades:** las habilidades publicadas son las del build, con su `sha256` (CA2); ningún
 *   catálogo de API mientras no haya una API pública (P1); `security.txt` vigente.
 *
 * Lo que no aplica todavía se lista aparte, con su porqué, para que el informe no lo calle: la
 * negociación de `Accept: text/markdown` (un aviso, porque depende de la regla de la zona), OAuth
 * (EC9), MCP (EC9), Web Bot Auth y comercio (§5.6).
 */
import { createHash } from 'node:crypto';
import type { Fetch } from './despliegue.ts';

export interface IndiceDeHabilidades {
  skills: { name: string; type: string; description: string; url: string; sha256: string }[];
}

export interface Esperado {
  /** El host de producción: los enlaces de `llms.txt` y del índice lo nombran. */
  sitio: string;
  /** Los agentes de `content/agentes.json`. */
  agentes: readonly string[];
  /** El índice de habilidades del build, o null si el build no publica ninguna. */
  habilidades: IndiceDeHabilidades | null;
}

export interface InformeDeAgentes {
  fallas: string[];
  avisos: string[];
  noAplica: string[];
}

export const NO_APLICA = [
  'OAuth / OIDC (RFC 8414 y 9728): llega con el CORE como servidor de autorización (EC9)',
  'MCP Server Card: llega con el servidor MCP del cuaderno (EC9)',
  'Web Bot Auth: ningún producto opera un agente que visite sitios ajenos (§5.7)',
  'x402, MPP, UCP y ACP: el sitio no vende (§5.6)',
];

const sha256 = (texto: string) => createHash('sha256').update(texto, 'utf8').digest('hex');

export async function verificarAgentes(
  fetchFn: Fetch,
  base: string,
  esperado: Esperado,
): Promise<InformeDeAgentes> {
  const fallas: string[] = [];
  const avisos: string[] = [];
  const local = (url: string) =>
    url.startsWith(esperado.sitio) ? base + url.slice(esperado.sitio.length) : url;
  const pedir = async (ruta: string, init?: RequestInit) => {
    try {
      return await fetchFn(`${base}${ruta}`, { redirect: 'manual', ...init });
    } catch (e) {
      fallas.push(`${ruta}: no respondió (${(e as Error).message})`);
      return null;
    }
  };
  const texto = async (ruta: string): Promise<{ r: Response; cuerpo: string } | null> => {
    const r = await pedir(ruta);
    if (!r) return null;
    if (r.status !== 200) {
      fallas.push(`${ruta}: respondió ${r.status}, se esperaba 200`);
      return null;
    }
    return { r, cuerpo: await r.text() };
  };

  // Descubrimiento y control de bots: robots.txt.
  const robots = await texto('/robots.txt');
  if (robots) {
    if (!/^Sitemap: https:\/\/\S+\/sitemap\.xml$/m.test(robots.cuerpo))
      fallas.push('/robots.txt: no anuncia el sitemap');
    if (!/^Content-Signal: .*ai-train=(yes|no)/m.test(robots.cuerpo))
      fallas.push('/robots.txt: no trae la Content-Signal con ai-train');
    for (const agente of esperado.agentes)
      if (!robots.cuerpo.includes(`User-agent: ${agente}\n`))
        fallas.push(`/robots.txt: no tiene un grupo para ${agente}`);
  }

  const sitemap = await texto('/sitemap.xml');
  if (
    sitemap &&
    !/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(sitemap.cuerpo)
  )
    fallas.push('/sitemap.xml: no es un urlset de sitemaps.org');

  // Contenido: llms.txt, sus enlaces, los gemelos y la cabecera Link de cada página.
  const llms = await texto('/llms.txt');
  if (llms) {
    if (!llms.cuerpo.startsWith('# ')) fallas.push('/llms.txt: no empieza con un título «# »');
    const gemelos = [...llms.cuerpo.matchAll(/\]\((https?:\/\/[^)]+)\)/g)]
      .map((m) => m[1] ?? '')
      .filter((u) => u.startsWith(esperado.sitio));
    for (const url of gemelos) {
      const ruta = url.slice(esperado.sitio.length);
      const md = await texto(ruta);
      if (md && !md.cuerpo.startsWith('# ')) fallas.push(`${ruta}: no es Markdown con título`);
      const pagina = ruta.replace(/index\.md$/, '');
      if (pagina === ruta) continue;
      const html = await pedir(pagina);
      const link = html?.headers.get('link') ?? '';
      if (html && !(link.includes(`<${ruta}>`) && link.includes('text/markdown')))
        fallas.push(`${pagina}: la cabecera Link no anuncia ${ruta}`);
      // La negociación depende de una regla de la zona (docs/runbooks/agentes.md): solo avisa.
      const negociada = await pedir(pagina, { headers: { accept: 'text/markdown' } });
      if (negociada && !(negociada.headers.get('content-type') ?? '').includes('text/markdown'))
        avisos.push(
          `${pagina}: con «Accept: text/markdown» todavía responde HTML (regla de la zona pendiente)`,
        );
    }
  }

  // Capacidades: habilidades (CA2), catálogo de API y security.txt.
  const indice = await pedir('/.well-known/agent-skills/index.json');
  if (esperado.habilidades === null) {
    if (indice && indice.status === 200)
      fallas.push(
        '/.well-known/agent-skills/index.json: publicado, pero el build no tiene habilidades',
      );
  } else if (indice && indice.status !== 200) {
    fallas.push(
      `/.well-known/agent-skills/index.json: respondió ${indice.status}, se esperaba 200`,
    );
  } else if (indice) {
    let publicado: IndiceDeHabilidades = { skills: [] };
    try {
      publicado = (await indice.json()) as IndiceDeHabilidades;
    } catch {
      fallas.push('/.well-known/agent-skills/index.json: no es JSON');
    }
    for (const s of esperado.habilidades.skills) {
      const p = publicado.skills?.find((x) => x.name === s.name);
      if (!p) {
        fallas.push(`habilidad ${s.name}: está en el build y no en el índice publicado`);
        continue;
      }
      if (p.sha256 !== s.sha256)
        fallas.push(`habilidad ${s.name}: el sha256 publicado no es el del build`);
      const skill = await texto(local(p.url).slice(base.length));
      if (skill && sha256(skill.cuerpo) !== s.sha256)
        fallas.push(`habilidad ${s.name}: el SKILL.md publicado no coincide con su sha256`);
    }
    for (const p of publicado.skills ?? [])
      if (!esperado.habilidades.skills.some((s) => s.name === p.name))
        fallas.push(`habilidad ${p.name}: publicada, pero no está en el build`);
  }

  const catalogo = await pedir('/.well-known/api-catalog');
  if (catalogo && catalogo.status === 200)
    fallas.push('/.well-known/api-catalog: publicado sin una API pública para terceros (P1)');

  const seguridad = await texto('/.well-known/security.txt');
  if (seguridad) {
    if (!/^Contact: mailto:\S+@\S+$/m.test(seguridad.cuerpo))
      fallas.push('/.well-known/security.txt: sin Contact');
    const expira = Date.parse(seguridad.cuerpo.match(/^Expires: (\S+)$/m)?.[1] ?? '');
    if (!(expira > Date.now())) fallas.push('/.well-known/security.txt: Expires vencido o ausente');
  }

  return { fallas, avisos, noAplica: [...NO_APLICA] };
}

export function informeDeAgentes(i: InformeDeAgentes): string[] {
  return [
    ...(i.fallas.length > 0
      ? ['Fallas:', ...i.fallas.map((f) => `  ❌ ${f}`)]
      : ['  ✅ sin fallas']),
    ...(i.avisos.length > 0 ? ['Avisos:', ...i.avisos.map((a) => `  ⚠️ ${a}`)] : []),
    'No aplica todavía:',
    ...i.noAplica.map((n) => `  · ${n}`),
  ];
}

/** Lo esperado, del repositorio y del build de `apps/sitio/dist` (el que se acaba de subir). */
export function esperadoDelRepositorio(
  raiz: string,
  sitio: string,
  leer: (ruta: string) => string | null,
): Esperado {
  const agentes = JSON.parse(leer(`${raiz}/content/agentes.json`) ?? '{"familias":[]}') as {
    familias: { agentes: string[] }[];
  };
  const indice = leer(`${raiz}/apps/sitio/dist/.well-known/agent-skills/index.json`);
  return {
    sitio,
    agentes: agentes.familias.flatMap((f) => f.agentes),
    habilidades: indice ? (JSON.parse(indice) as IndiceDeHabilidades) : null,
  };
}
