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
    },
    null,
    2,
  )}\n`;
}
