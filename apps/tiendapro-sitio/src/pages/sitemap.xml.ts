// El sitemap de TiendaPro (HU-T18.5 CA2): la portada y los dos textos legales.
import { ORIGEN } from '../contenido.ts';

export const RUTAS = ['/', '/legal/datos/', '/legal/terminos/'];

export const GET = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${RUTAS.map((r) => `<url><loc>${ORIGEN}${r}</loc></url>`).join('\n')}\n</urlset>\n`,
    { headers: { 'content-type': 'application/xml; charset=utf-8' } },
  );
