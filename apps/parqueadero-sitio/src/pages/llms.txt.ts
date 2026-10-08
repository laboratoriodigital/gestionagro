// `llms.txt` del sitio del parqueadero (HU-Q11.5, ADR-24): qué es y adónde leer.
import { llmsTxt } from '../sitio/contenido.ts';

export const GET = () =>
  new Response(llmsTxt(), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
