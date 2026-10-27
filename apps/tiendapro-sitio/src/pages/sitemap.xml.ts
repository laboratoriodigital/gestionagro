// El sitemap de TiendaPro (HU-T18.5 CA2): la portada, los dos textos legales y la ayuda (HU-P5.1).
import { GUIAS } from '../ayuda.ts';
import { ORIGEN } from '../contenido.ts';

export const RUTAS = [
  '/',
  '/legal/datos/',
  '/legal/terminos/',
  '/ayuda/',
  ...GUIAS.map((g) => `/ayuda/${g.slug}/`),
];

export const GET = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${RUTAS.map((r) => `<url><loc>${ORIGEN}${r}</loc></url>`).join('\n')}\n</urlset>\n`,
    { headers: { 'content-type': 'application/xml; charset=utf-8' } },
  );
