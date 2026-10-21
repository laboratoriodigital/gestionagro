/**
 * La capa estática para agentes de cada tienda (HU-T15.1, TIENDA-3.0 §11.8, PLATAFORMA §5.3):
 * `robots.txt`, `llms.txt` y `manifest.webmanifest`. Puras, como el horno.
 *
 * - Las familias de agentes salen de `content/agentes.json` (P2), las mismas del sitio; lo que
 *   decide si cada familia entra son las señales de la sección `agentes` de **esa** tienda.
 * - `llms.txt` (llmstxt.org) enlaza a los gemelos `.md`: un agente lee la tienda sin ejecutar
 *   JavaScript. La compuerta exige que cada enlace exista en lo horneado (CA3).
 * - `security.txt` no se hornea: su `Expires` depende del día, y el horno no tiene reloj. Lo sirve
 *   el despacho (`apps/tienda-sitio`).
 */
import agentesDelEcosistema from '../../../content/agentes.json' with { type: 'json' };

export type SenalDeAgentes = 'search' | 'ai-input' | 'ai-train';

export interface SenalesDeLaTienda {
  search: 'yes' | 'no';
  aiInput: 'yes' | 'no';
  aiTrain: 'yes' | 'no';
}

interface Familia {
  id: string;
  descripcion: string;
  agentes: readonly string[];
  segun: SenalDeAgentes;
}

export const FAMILIAS_DE_AGENTES: readonly Familia[] = agentesDelEcosistema.familias as Familia[];

/** Lo que nadie lee: la API, el carrito y el pedido de cada comprador. */
export const CERRADO_EN_LA_TIENDA = ['/api/', '/carrito/', '/pedido/'] as const;

const valorDe = (s: SenalesDeLaTienda, senal: SenalDeAgentes) =>
  senal === 'search' ? s.search : senal === 'ai-input' ? s.aiInput : s.aiTrain;

export function robotsDeLaTienda(senales: SenalesDeLaTienda, sitio: string): string {
  const cerrado = CERRADO_EN_LA_TIENDA.map((r) => `Disallow: ${r}`);
  const grupos = FAMILIAS_DE_AGENTES.map((f) => {
    const valor = valorDe(senales, f.segun);
    return [
      `# ${f.descripcion} (${f.segun}=${valor})`,
      ...f.agentes.map((a) => `User-agent: ${a}`),
      ...(valor === 'yes' ? ['Allow: /', ...cerrado] : ['Disallow: /']),
    ].join('\n');
  });
  const senal = `search=${senales.search}, ai-input=${senales.aiInput}, ai-train=${senales.aiTrain}`;
  return `${[
    ...grupos,
    ['# Todos los demás', 'User-agent: *', 'Allow: /', ...cerrado, `Content-Signal: ${senal}`].join(
      '\n',
    ),
    `Sitemap: ${sitio}/sitemap.xml`,
  ].join('\n\n')}\n`;
}

export interface EnlaceDeLlms {
  titulo: string;
  ruta: string;
  nota?: string;
}

/** `llms.txt`: el nombre, la frase y las secciones con sus enlaces a los gemelos `.md`. */
export function llmsTxt(datos: {
  nombre: string;
  frase?: string;
  secciones: readonly { titulo: string; enlaces: readonly EnlaceDeLlms[] }[];
}): string {
  const partes = [`# ${datos.nombre}`];
  if (datos.frase) partes.push(`> ${datos.frase}`);
  for (const s of datos.secciones.filter((x) => x.enlaces.length > 0)) {
    partes.push(
      `## ${s.titulo}\n\n${s.enlaces
        .map((e) => `- [${e.titulo}](${e.ruta})${e.nota ? `: ${e.nota}` : ''}`)
        .join('\n')}`,
    );
  }
  return `${partes.join('\n\n')}\n`;
}

/** Las rutas internas que enlaza un `llms.txt`, para que la compuerta las busque (CA3). */
export const enlacesDeLlms = (texto: string): string[] =>
  [...texto.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1] ?? '');

/** El manifiesto de la app web: el teléfono la guarda con su nombre y su color. */
export function manifiestoWeb(datos: {
  nombre: string;
  frase?: string;
  color: string;
  fondo: string;
  /** HU-T5.13: el ícono de la tienda, si lo subió. */
  icono?: { src: string; tamano: string; tipo: string };
}): string {
  return `${JSON.stringify(
    {
      name: datos.nombre,
      short_name: datos.nombre.length > 12 ? datos.nombre.slice(0, 12).trim() : datos.nombre,
      ...(datos.frase ? { description: datos.frase } : {}),
      lang: 'es-CO',
      start_url: '/',
      scope: '/',
      display: 'browser',
      theme_color: datos.color,
      background_color: datos.fondo,
      ...(datos.icono
        ? { icons: [{ src: datos.icono.src, sizes: datos.icono.tamano, type: datos.icono.tipo }] }
        : {}),
    },
    null,
    2,
  )}\n`;
}

/** HU-T15.2: el catálogo de la API (RFC 9727), con la OpenAPI de esta tienda. */
export const RUTA_DEL_CATALOGO_DE_LA_API = '/.well-known/api-catalog';
export function catalogoDeLaApi(sitio: string): string {
  return `${JSON.stringify(
    {
      linkset: [
        {
          anchor: `${sitio}/api/v1/`,
          'service-desc': [{ href: `${sitio}/openapi.json`, type: 'application/openapi+json' }],
          'service-doc': [
            { href: `${sitio}${RUTA_DE_LAS_HABILIDADES}comprar/SKILL.md`, type: 'text/markdown' },
          ],
        },
      ],
    },
    null,
    2,
  )}\n`;
}

/**
 * HU-T15.3: las habilidades de la tienda, en el mismo lugar y con el mismo índice que las del sitio
 * (`scripts/lib/habilidades.ts`, P2): `index.json` con `name`, `type`, `description`, `url` y la
 * `sha256` de cada `SKILL.md`.
 */
export const RUTA_DE_LAS_HABILIDADES = '/.well-known/agent-skills/';

export interface DatosDeLaHabilidad {
  nombre: string;
  frase?: string;
  /** Si el MCP público está encendido (`agentes.mcp`): cambia cómo se prepara el pedido. */
  mcp: boolean;
  /** Las formas de pago que ofrece, en palabras. */
  formas: readonly string[];
  /** Los textos legales publicados, con su ruta. */
  legales: readonly { titulo: string; ruta: string }[];
}

/** El `SKILL.md` de comprar en esta tienda: dónde está todo y qué hace siempre la persona. */
export function habilidadDeCompra(d: DatosDeLaHabilidad): { texto: string; descripcion: string } {
  const descripcion = `Cómo comprar en ${d.nombre}: dónde está el catálogo, cómo cotizar y preparar un pedido, y que la aceptación y el pago los hace la persona.`;
  const preparar = d.mcp
    ? [
        'Con el MCP de la tienda: `POST /mcp` (Streamable HTTP, sin sesión), con su tarjeta en `/.well-known/mcp/server-card.json`.',
        '',
        '- `buscar_productos` y `ver_producto` leen el catálogo publicado.',
        '- `consultar_disponibilidad` cotiza unas combinaciones, como `/api/v1/cotizar`.',
        '- `preparar_pedido` deja el pedido pendiente, sin datos de la persona, y devuelve un enlace. **Entrégale ese enlace a la persona**: ella revisa el pedido, acepta los términos y elige cómo pagar.',
        '- `seguimiento_de_pedido` dice en qué va, con el código y el secreto de su enlace.',
      ]
    : [
        'Esta tienda no tiene encendido su MCP. Dale a la persona la dirección de cada producto (`/p/<producto>/`): ella lo agrega a su pedido y lo envía desde la tienda.',
      ];
  const texto = `${[
    '---',
    'name: comprar',
    `description: "${descripcion.replace(/"/g, "'")}"`,
    '---',
    '',
    `# Comprar en ${d.nombre}`,
    ...(d.frase ? ['', d.frase] : []),
    '',
    '## El catálogo',
    '',
    '- `/catalogo.json`: cada producto con su dirección y sus combinaciones (`variantes`), cada una con su `id`, su precio en pesos colombianos (IVA incluido) y si hay disponibles.',
    '- `/catalogo.md` y `/llms.txt`: lo mismo, para leer. La ficha de cada producto está en `/p/<producto>/index.md`, con lo que hay que saber antes de comprar: envío, retracto y garantía.',
    '',
    '## Cotizar',
    '',
    '`POST /api/v1/cotizar` con `{"lineas":[{"variante":"<id>","cantidad":1}]}`, y `envio` o `cupon` si los hay. Responde el total, los avisos de lo que cambió y el carrito corregido. No aparta unidades. La API está descrita en `/openapi.json`.',
    '',
    '## Preparar el pedido',
    '',
    ...preparar,
    '',
    '## Lo que hace siempre la persona, nunca el agente',
    '',
    '- Aceptar los términos de la tienda y escribir sus datos de entrega.',
    `- Pagar${d.formas.length > 0 ? `: ${d.formas.join(', ').toLowerCase()}` : ''}.`,
    '- Un pedido preparado que nadie confirma se cancela solo a las 48 horas. Los agentes no apartan unidades: se apartan cuando la persona paga.',
    ...(d.legales.length > 0
      ? ['', '## Políticas', '', ...d.legales.map((l) => `- [${l.titulo}](${l.ruta}index.md)`)]
      : []),
    '',
  ].join('\n')}`;
  return { texto, descripcion };
}

export interface Habilidad {
  name: string;
  type: 'skill-md';
  description: string;
  url: string;
  sha256: string;
}

/** HU-T15.4: la tarjeta del MCP público (PLATAFORMA §5.5): quién es y dónde, sin sus herramientas. */
export function tarjetaDelMcp(d: { nombre: string; sitio: string }): string {
  return `${JSON.stringify(
    {
      name: 'tienda',
      title: d.nombre,
      description: `Busca productos de ${d.nombre}, consulta disponibilidad y prepara un pedido para que la persona lo confirme y lo pague. Ninguna herramienta mueve dinero.`,
      version: '1.0.0',
      documentation: `${d.sitio}${RUTA_DE_LAS_HABILIDADES}comprar/SKILL.md`,
      protocolVersions: ['2025-06-18', '2025-03-26'],
      remotes: [{ type: 'streamable-http', url: `${d.sitio}/mcp` }],
      authentication: { type: 'none' },
    },
    null,
    2,
  )}\n`;
}
