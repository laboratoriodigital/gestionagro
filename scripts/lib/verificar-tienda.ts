/**
 * Lo legible por agentes de **cada tienda** (HU-T15.6, PLATAFORMA §5.8), contra lo desplegado y sin
 * un servicio externo: el mismo criterio de `verificar-agentes.ts` para el sitio, con lo que cada
 * tienda publica (TIENDA-3.0 §11.8). Corre contra los comercios de prueba de staging después de su
 * prueba de humo, con todas las fallas a la vez (P15); una falla detiene la salida a producción (P16).
 *
 * - **Descubrimiento:** `robots.txt` con su `Sitemap`, `Disallow: /api/`, la `Content-Signal` y un
 *   grupo por agente; la portada anuncia el catálogo de la API en `Link` (HU-T15.2).
 * - **Contenido:** `llms.txt` con título y cada enlace vivo.
 * - **API:** `/openapi.json` en OpenAPI 3.1 con la dirección de la tienda, y `/.well-known/api-catalog`
 *   (RFC 9727) que la nombra.
 * - **Habilidades:** la de comprar, en el índice, con su `sha256` igual al del `SKILL.md` publicado
 *   (CA2: quitarla o alterarla es una falla).
 * - **MCP:** si la tienda publica su tarjeta, `/mcp` responde `initialize` con una versión del
 *   protocolo y lista sus herramientas; si no, se dice que está apagado.
 * - `security.txt` vigente.
 */
import { createHash } from 'node:crypto';
import type { Fetch } from './despliegue.ts';
import type { InformeDeAgentes } from './verificar-agentes.ts';

/** Lo que una tienda tiene que ofrecer a un agente, siempre. */
export const HABILIDADES_DE_LA_TIENDA = ['comprar'] as const;
const HERRAMIENTAS_DEL_MCP = [
  'buscar_productos',
  'ver_producto',
  'consultar_disponibilidad',
  'preparar_pedido',
  'seguimiento_de_pedido',
];

const sha256 = (texto: string) => createHash('sha256').update(texto, 'utf8').digest('hex');

export async function verificarTienda(
  fetchFn: Fetch,
  base: string,
  agentes: readonly string[],
): Promise<InformeDeAgentes> {
  const fallas: string[] = [];
  const avisos: string[] = [];
  const noAplica: string[] = [];
  const pedir = async (ruta: string, init?: RequestInit) => {
    try {
      return await fetchFn(`${base}${ruta}`, { redirect: 'manual', ...init });
    } catch (e) {
      fallas.push(`${ruta}: no respondió (${(e as Error).message})`);
      return null;
    }
  };
  const texto = async (ruta: string) => {
    const r = await pedir(ruta);
    if (!r) return null;
    if (r.status !== 200) {
      fallas.push(`${ruta}: respondió ${r.status}, se esperaba 200`);
      return null;
    }
    return { r, cuerpo: await r.text() };
  };
  const json = async <T>(ruta: string): Promise<{ r: Response; datos: T } | null> => {
    const t = await texto(ruta);
    if (!t) return null;
    try {
      return { r: t.r, datos: JSON.parse(t.cuerpo) as T };
    } catch {
      fallas.push(`${ruta}: no es JSON`);
      return null;
    }
  };

  const robots = await texto('/robots.txt');
  if (robots) {
    if (!/^Sitemap: https:\/\/\S+\/sitemap\.xml$/m.test(robots.cuerpo))
      fallas.push('/robots.txt: no anuncia el sitemap');
    if (!/^Content-Signal: .*ai-train=(yes|no)/m.test(robots.cuerpo))
      fallas.push('/robots.txt: no trae la Content-Signal con ai-train');
    if (!robots.cuerpo.includes('Disallow: /api/')) fallas.push('/robots.txt: no cierra /api/');
    for (const agente of agentes)
      if (!robots.cuerpo.includes(`User-agent: ${agente}\n`))
        fallas.push(`/robots.txt: no tiene un grupo para ${agente}`);
  }

  const portada = await pedir('/');
  if (portada && !(portada.headers.get('link') ?? '').includes('rel="api-catalog"'))
    fallas.push('/: la cabecera Link no anuncia el catálogo de la API');

  const llms = await texto('/llms.txt');
  if (llms) {
    if (!llms.cuerpo.startsWith('# ')) fallas.push('/llms.txt: no empieza con un título «# »');
    for (const m of llms.cuerpo.matchAll(/\]\((\/[^)\s]*)\)/g)) {
      const ruta = m[1] ?? '';
      const r = await pedir(ruta);
      if (r && r.status !== 200)
        fallas.push(`/llms.txt enlaza a ${ruta}, que respondió ${r.status}`);
    }
  }

  const api = await json<{ openapi?: string; servers?: { url: string }[]; paths?: object }>(
    '/openapi.json',
  );
  if (api) {
    if (!/^3\.1\./.test(api.datos.openapi ?? '')) fallas.push('/openapi.json: no es OpenAPI 3.1');
    if (api.datos.servers?.[0]?.url !== base)
      fallas.push(`/openapi.json: su servidor no es ${base}`);
    if (Object.keys(api.datos.paths ?? {}).length === 0)
      fallas.push('/openapi.json: no describe ninguna ruta');
  }
  const catalogo = await json<{ linkset?: { 'service-desc'?: { href: string }[] }[] }>(
    '/.well-known/api-catalog',
  );
  if (catalogo) {
    if (!(catalogo.r.headers.get('content-type') ?? '').includes('application/linkset+json'))
      fallas.push('/.well-known/api-catalog: no es application/linkset+json');
    const href = catalogo.datos.linkset?.[0]?.['service-desc']?.[0]?.href;
    if (href !== `${base}/openapi.json`)
      fallas.push('/.well-known/api-catalog: no nombra /openapi.json de esta tienda');
  }

  const indice = await json<{ skills?: { name: string; url: string; sha256: string }[] }>(
    '/.well-known/agent-skills/index.json',
  );
  if (indice) {
    for (const nombre of HABILIDADES_DE_LA_TIENDA) {
      const s = indice.datos.skills?.find((x) => x.name === nombre);
      if (!s) {
        fallas.push(`habilidad ${nombre}: no está en el índice`);
        continue;
      }
      const ruta = s.url.startsWith(base) ? s.url.slice(base.length) : null;
      if (!ruta) {
        fallas.push(`habilidad ${nombre}: su dirección no es de esta tienda`);
        continue;
      }
      const skill = await texto(ruta);
      if (skill && sha256(skill.cuerpo) !== s.sha256)
        fallas.push(`habilidad ${nombre}: el SKILL.md publicado no coincide con su sha256`);
    }
  }

  const tarjeta = await pedir('/.well-known/mcp/server-card.json');
  if (tarjeta?.status === 200) {
    const rpc = async (method: string) => {
      const r = await pedir('/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params: { protocolVersion: '2025-06-18' },
        }),
      });
      if (!r) return null;
      if (r.status !== 200) {
        fallas.push(`/mcp: ${method} respondió ${r.status}`);
        return null;
      }
      return ((await r.json().catch(() => ({}))) as { result?: Record<string, unknown> }).result;
    };
    const ini = await rpc('initialize');
    if (ini && typeof ini['protocolVersion'] !== 'string')
      fallas.push('/mcp: initialize no dice la versión del protocolo');
    const lista = await rpc('tools/list');
    const nombres = ((lista?.['tools'] ?? []) as { name: string }[]).map((t) => t.name);
    for (const h of HERRAMIENTAS_DEL_MCP)
      if (lista && !nombres.includes(h)) fallas.push(`/mcp: no ofrece ${h}`);
  } else if (tarjeta) {
    noAplica.push('MCP: el comercio no lo encendió en Ajustes › Agentes');
  }

  const seguridad = await texto('/.well-known/security.txt');
  if (seguridad) {
    if (!/^Contact: mailto:\S+@\S+$/m.test(seguridad.cuerpo))
      fallas.push('/.well-known/security.txt: sin Contact');
    const expira = Date.parse(seguridad.cuerpo.match(/^Expires: (\S+)$/m)?.[1] ?? '');
    if (!(expira > Date.now())) fallas.push('/.well-known/security.txt: Expires vencido o ausente');
  }

  return { fallas, avisos, noAplica };
}
