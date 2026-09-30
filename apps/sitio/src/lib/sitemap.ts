/**
 * Sitemap derivado de los contratos: solo lo que está `activo` (HU-E1.6, HU-E2.6).
 * Un borrador en el sitemap sería pedirle a Google que indexe algo sin revisión agronómica.
 */
import type { Producto } from '../../../../scripts/lib/productos.ts';
import { esHerramienta, SITIO, urlDe } from './seo.ts';

const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function urlsDelSitemap(productos: readonly Producto[]): string[] {
  const activos = productos.filter((p) => esHerramienta(p) && p.estado === 'activo');
  if (activos.length === 0) return [];
  return [`${SITIO}/herramientas/agro/`, ...activos.map((p) => urlDe(p.slug)).sort()];
}

export function sitemapXml(productos: readonly Producto[]): string {
  const urls = urlsDelSitemap(productos)
    .map((u) => `  <url><loc>${escapar(u)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}${urls ? '\n' : ''}</urlset>\n`;
}
