/**
 * SEO derivado del contrato (HU-E1.6, ED1 §12): nada se escribe a mano en la página. Título,
 * descripción, canonical, Open Graph, migas y JSON-LD salen de `product.yaml`.
 *
 * Solo un producto `activo` se indexa. Un borrador se construye (para revisarlo en staging) pero
 * lleva `noindex` y no entra al sitemap.
 */
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
