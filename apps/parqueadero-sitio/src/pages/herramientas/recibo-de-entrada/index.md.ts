// El gemelo en Markdown del generador de recibo de entrada (HU-Q11.4, HU-Q11.5).
import { GENERADOR, gemelo } from '../../../sitio/contenido.ts';

export const GET = () =>
  new Response(gemelo(GENERADOR), { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
