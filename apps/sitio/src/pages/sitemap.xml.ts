import type { APIRoute } from 'astro';
import { productos } from '../lib/contenido.ts';
import { sitemapXml } from '../lib/sitemap.ts';

export const GET: APIRoute = () =>
  new Response(sitemapXml(productos), {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
