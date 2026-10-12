// El gemelo en Markdown de los cupos para vehículos eléctricos (HU-Q11.7, HU-Q11.5).
import { CUPOS, gemelo } from '../../../sitio/contenido.ts';

export const GET = () =>
  new Response(gemelo(CUPOS), { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
