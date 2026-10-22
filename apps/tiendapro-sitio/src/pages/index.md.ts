// El gemelo en Markdown de la portada (HU-T18.5 CA2, ADR-24): lo mismo que `llms.txt`, para un
// agente que pide la página en Markdown.
import { llmsTxt } from '../contenido.ts';

export const GET = () =>
  new Response(llmsTxt(), { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
