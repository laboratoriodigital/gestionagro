/**
 * `node scripts/armar-ensayo.ts`: arma la app del producto de ensayo (HU-C3.7) en
 * `apps/ensayo/dist`. Pone la URL del CORE de staging y la versión de su política, y escribe sus
 * cabeceras: solo código propio, y conexiones solo a su origen y al CORE de staging (P2: las dos
 * salen de los archivos de siempre).
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cargarCeldas } from './lib/celdas.ts';
import { RAIZ } from './lib/repo.ts';

const fuente = join(RAIZ, 'apps', 'ensayo', 'src');
const dist = join(RAIZ, 'apps', 'ensayo', 'dist');
const core = cargarCeldas().core.url_staging;
const politica = (
  JSON.parse(
    readFileSync(join(RAIZ, 'content', 'ensayo', 'privacidad', 'politica.json'), 'utf8'),
  ) as { version: string }
).version;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
writeFileSync(
  join(dist, 'index.html'),
  readFileSync(join(fuente, 'index.html'), 'utf8')
    .replaceAll('{{CORE}}', core)
    .replaceAll('{{POLITICA}}', politica),
);
copyFileSync(join(fuente, 'ensayo.js'), join(dist, 'ensayo.js'));
copyFileSync(join(fuente, 'ensayo.css'), join(dist, 'ensayo.css'));
writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(
  join(dist, '_headers'),
  [
    '/*',
    `  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ${core}; form-action ${core} https://accounts.google.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: no-referrer',
    '  X-Robots-Tag: noindex',
    '',
  ].join('\n'),
);
console.log(`✅ Ensayo armado en apps/ensayo/dist, contra ${core}`);
