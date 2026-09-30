import type { APIRoute } from 'astro';
import { SITIO } from '../lib/seo.ts';

export const GET: APIRoute = () =>
  new Response(
    `User-agent: *\nDisallow: /api/\nDisallow: /agro/app/\n\nSitemap: ${SITIO}/sitemap.xml\n`,
    {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    },
  );
