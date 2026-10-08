// El gemelo en Markdown de la portada (HU-Q11.5, ADR-24).
import { gemelo, PORTADA } from '../sitio/contenido.ts';

export const GET = () =>
  new Response(gemelo(PORTADA), { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
