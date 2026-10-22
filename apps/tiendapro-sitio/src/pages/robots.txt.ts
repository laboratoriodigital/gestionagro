// `robots.txt` de producción (HU-T18.5 CA2): todo se puede leer, y el sitemap dice qué hay. En
// staging, `scripts/armar-tiendapro.ts` lo cambia por uno que no deja indexar nada.
import { ORIGEN } from '../contenido.ts';

export const GET = () =>
  new Response(
    [
      'User-agent: *',
      'Allow: /',
      `Content-Signal: search=yes, ai-input=yes, ai-train=no`,
      '',
      `Sitemap: ${ORIGEN}/sitemap.xml`,
      '',
    ].join('\n'),
    { headers: { 'content-type': 'text/plain; charset=utf-8' } },
  );
