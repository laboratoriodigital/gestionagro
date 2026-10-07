/**
 * `node scripts/armar-parqueadero.ts`: termina `apps/parqueadero-sitio/dist` después de Astro y
 * de la caja (HU-Q5.1). Escribe las cabeceras y el robots.txt de staging; el despliegue a
 * producción los cambia por los suyos (HU-Q5.2). Se detiene si falta una pieza: un despliegue sin
 * la caja o sin su service worker no se publica (P16).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { escribirCabecerasDelParqueadero } from './lib/cabeceras-parqueadero.ts';
import { RAIZ } from './lib/repo.ts';

const dist = join(RAIZ, 'apps', 'parqueadero-sitio', 'dist');
const faltan = ['index.html', 'caja/index.html', 'caja/sw.js', 'caja/manifest.webmanifest'].filter(
  (f) => !existsSync(join(dist, f)),
);
if (faltan.length > 0) {
  console.error(`❌ Al sitio del parqueadero le falta: ${faltan.join(', ')}`);
  process.exit(1);
}
escribirCabecerasDelParqueadero(dist, 'staging');
console.log('✅ Sitio del parqueadero armado en apps/parqueadero-sitio/dist (staging)');
