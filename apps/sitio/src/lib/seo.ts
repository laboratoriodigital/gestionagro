/**
 * SEO derivado del contrato (HU-E1.6, ED1 §12): nada se escribe a mano en la página. Título,
 * descripción, canonical, Open Graph, migas y JSON-LD salen de `product.yaml`.
 *
 * Solo un producto `activo` se indexa. Un borrador se construye (para revisarlo en staging) pero
 * lleva `noindex` y no entra al sitemap.
 */
import type { PaginaDeHerramienta } from '../../../../scripts/lib/calidad.ts';
import type { Producto } from '../../../../scripts/lib/productos.ts';

/** Host de ADR-19. Cambiarlo es el único paso para mudar a otro dominio. */
export const SITIO = 'https://agro.laboratorio-digital.com';
export const NOMBRE_DEL_SITIO = 'Gestión Agro';

export interface Miga {
  nombre: string;
  url: string;
}

export interface Seo {
  title: string;
  description: string;
  canonical: string;
  indexable: boolean;
  og: {
    type: 'website';
    title: string;
    description: string;
    url: string;
    site_name: string;
    locale: 'es_CO';
  };
  migas: Miga[];
  jsonLd: Record<string, unknown>;
}

export const MIGAS_DE_HERRAMIENTAS: readonly Miga[] = [
  { nombre: 'Inicio', url: `${SITIO}/` },
  { nombre: 'Herramientas agro', url: `${SITIO}/herramientas/agro/` },
];

export function urlDe(slug: string): string {
  if (!slug.startsWith('/') || !slug.endsWith('/')) {
    throw new Error(`El slug «${slug}» debe empezar y terminar con «/»`);
  }
  return `${SITIO}${slug}`;
}

export function seoDeProducto(p: Producto): Seo {
  const canonical = urlDe(p.slug);
  const migas = [...MIGAS_DE_HERRAMIENTAS, { nombre: p.nombre, url: canonical }];
  return {
    title: `${p.seo.title} | ${NOMBRE_DEL_SITIO}`,
    description: p.seo.description,
    canonical,
    indexable: p.estado === 'activo',
    og: {
      type: 'website',
      title: p.seo.title,
      description: p.seo.description,
      url: canonical,
      site_name: NOMBRE_DEL_SITIO,
      locale: 'es_CO',
    },
    migas,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: migas.map((m, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: m.nombre,
        item: m.url,
      })),
    },
  };
}

/** Herramientas públicas: utilidades del sitio (el cuaderno vive en /agro/app/ y no se indexa). */
export const esHerramienta = (p: Producto): boolean =>
  p.tipo === 'utility' && p.slug.startsWith('/herramientas/agro/');

/** Parte del slug bajo `/herramientas/agro/`, para las rutas de Astro. */
export const segmentoDe = (p: Producto): string =>
  p.slug.replace(/^\/herramientas\/agro\//, '').replace(/\/$/, '');

/**
 * JSON-LD de una herramienta: migas, preguntas frecuentes (FAQPage) y pasos de uso (HowTo),
 * todo derivado del contrato y de `pagina.yaml` (P2). Google ya no muestra resultados enriquecidos
 * de HowTo y limita los de FAQ, pero otros buscadores y asistentes sí leen ese marcado.
 */
export function jsonLdDeHerramienta(
  p: Producto,
  pagina: PaginaDeHerramienta | null,
): Record<string, unknown> {
  const migas = seoDeProducto(p).jsonLd;
  const { '@context': _contexto, ...migasSinContexto } = migas;
  const grafo: Record<string, unknown>[] = [migasSinContexto];
  if (pagina) {
    grafo.push({
      '@type': 'FAQPage',
      mainEntity: pagina.preguntas.map((q) => ({
        '@type': 'Question',
        name: q.pregunta,
        acceptedAnswer: { '@type': 'Answer', text: q.respuesta },
      })),
    });
    grafo.push({
      '@type': 'HowTo',
      name: `Cómo usar la ${p.nombre.toLowerCase()}`,
      step: pagina.pasos.map((paso, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: paso.nombre,
        text: paso.texto,
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': grafo };
}
