import type { APIRoute } from 'astro';
import agentes from '../../../../content/agentes.json' with { type: 'json' };
import { type Agentes, robotsTxt } from '../lib/robots.ts';
import { SITIO } from '../lib/seo.ts';

// HU-C8.1: el robots.txt sale de content/agentes.json; la prueba de humo lo compara con lo publicado.
export const GET: APIRoute = () =>
  new Response(robotsTxt(agentes as Agentes, SITIO), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
