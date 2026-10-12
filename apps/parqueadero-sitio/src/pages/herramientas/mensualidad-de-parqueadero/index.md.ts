// El gemelo en Markdown del liquidador de mensualidades (HU-Q11.6, HU-Q11.5).
import { gemelo, LIQUIDADOR } from '../../../sitio/contenido.ts';

export const GET = () =>
  new Response(gemelo(LIQUIDADOR), { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
