/**
 * `node scripts/armar-parqueadero.ts`: termina `apps/parqueadero-sitio/dist` después de Astro y
 * de la caja (HU-Q5.1). Escribe las cabeceras y el robots.txt de staging, que es el único entorno
 * hasta HU-Q5.2, y se detiene si falta una pieza: un despliegue sin la caja o sin su service
 * worker no se publica (P16).
 */
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { textoDeCabecerasDelParqueadero } from './lib/cabeceras-parqueadero.ts';
import { RAIZ } from './lib/repo.ts';

const dist = join(RAIZ, 'apps', 'parqueadero-sitio', 'dist');
const faltan = ['index.html', 'caja/index.html', 'caja/sw.js', 'caja/manifest.webmanifest'].filter(
  (f) => !existsSync(join(dist, f)),
);
if (faltan.length > 0) {
  console.error(`❌ Al sitio del parqueadero le falta: ${faltan.join(', ')}`);
  process.exit(1);
}
writeFileSync(join(dist, '_headers'), textoDeCabecerasDelParqueadero('staging'));
writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log('✅ Sitio del parqueadero armado en apps/parqueadero-sitio/dist (staging)');
