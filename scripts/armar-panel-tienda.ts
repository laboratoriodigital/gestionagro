/**
 * `node scripts/armar-panel-tienda.ts`: arma el panel de la Tienda (HU-T2.4) en
 * `apps/tienda-panel/dist`: sus páginas, los tokens del sistema de diseño (`@ed1/ui` v2, P2) y sus
 * cabeceras. Solo código y estilos propios (TIENDA-3.0 §11.4); las conexiones, al mismo origen,
 * donde `/api/*` pasa a la API de la celda. Nada de esto se indexa mientras el panel se construye.
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './lib/repo.ts';

const fuente = join(RAIZ, 'apps', 'tienda-panel', 'public');
const dist = join(RAIZ, 'apps', 'tienda-panel', 'dist');

export const CABECERAS_DEL_PANEL = [
  '/*',
  "  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: no-referrer',
  '  X-Robots-Tag: noindex',
  '',
].join('\n');

if (process.argv[1]?.endsWith('armar-panel-tienda.ts')) {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  for (const archivo of readdirSync(fuente))
    copyFileSync(join(fuente, archivo), join(dist, archivo));
  copyFileSync(join(RAIZ, 'packages', 'ui', 'src', 'v2', 'tokens.css'), join(dist, 'tokens.css'));
  writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  writeFileSync(join(dist, '_headers'), CABECERAS_DEL_PANEL);
  console.log('✅ Panel de la Tienda armado en apps/tienda-panel/dist');
}
