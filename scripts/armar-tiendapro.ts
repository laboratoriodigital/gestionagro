/**
 * `node scripts/armar-tiendapro.ts`: termina `apps/tiendapro-sitio/dist` después de Astro
 * (HU-T18.5), para staging. El despliegue a producción lo vuelve a armar para producción. Se
 * detiene si falta una página: una landing sin sus textos legales no se publica (P16).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { armarLaLandingPara } from './lib/cabeceras-tiendapro.ts';
import { RAIZ } from './lib/repo.ts';

const dist = join(RAIZ, 'apps', 'tiendapro-sitio', 'dist');
const necesarias = [
  'index.html',
  'index.md',
  'legal/datos/index.html',
  'legal/terminos/index.html',
  '404.html',
  'llms.txt',
  'robots.txt',
  'sitemap.xml',
  'icono.svg',
];
const faltan = necesarias.filter((f) => !existsSync(join(dist, f)));
if (faltan.length > 0) {
  console.error(`❌ A la landing de TiendaPro le falta: ${faltan.join(', ')}`);
  process.exit(1);
}
// CA3: nada en línea ni de terceros llega al HTML.
const portada = readFileSync(join(dist, 'index.html'), 'utf8');
if (
  /<style[\s>]|<script(?![^>]*\bsrc=)[^>]*>\s*\S/.test(portada) ||
  /https?:\/\/(?!tiendapro\.co|app\.tiendapro\.co|www\.sic\.gov\.co)[^"'\s>]+\.(js|css)/.test(
    portada,
  )
) {
  console.error(
    '❌ La portada de TiendaPro trae algo en línea o de un tercero: la CSP lo bloquearía',
  );
  process.exit(1);
}
armarLaLandingPara(dist, 'staging');
console.log('✅ Landing de TiendaPro armada en apps/tiendapro-sitio/dist (staging)');
