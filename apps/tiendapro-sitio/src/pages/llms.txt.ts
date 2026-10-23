// `llms.txt` de TiendaPro (HU-T18.5 CA2, ADR-24): qué es, cuánto cuesta y adónde leer.
import { llmsTxt } from '../contenido.ts';

export const GET = () =>
  new Response(llmsTxt(), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
