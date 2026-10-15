/**
 * `node scripts/armar-panel-tienda.ts`: termina el panel de la Tienda (HU-T2.4, HU-T3.5 y HU-T8.1)
 * en `apps/tienda-panel/dist`, después de `vite build`: sus cabeceras y su `robots.txt`. Solo código
 * y estilos propios (TIENDA-3.0 §11.4). Las conexiones van al mismo origen, donde `/api/*` pasa a la
 * API de la celda, y a los dos CORE de `celdas.json` (P2): entrar es canjear el código y renovar la
 * sesión contra la cuenta. Nada del panel se indexa.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MEDIOS_DE_LA_TIENDA } from './generar-wrangler.ts';
import { RAIZ } from './lib/repo.ts';

const dist = join(RAIZ, 'apps', 'tienda-panel', 'dist');

/** Los orígenes de los dos CORE, de `infrastructure/celdas.json`. */
export function origenesDelCore(): string[] {
  const { core } = JSON.parse(
    readFileSync(join(RAIZ, 'infrastructure', 'celdas.json'), 'utf8'),
  ) as { core: { url: string; url_staging: string } };
  return [...new Set([new URL(core.url).origin, new URL(core.url_staging).origin])];
}

/**
 * HU-T8.3: las miniaturas de las fotos vienen de su host público (el de producción o el de
 * staging), y la vista previa de una foto recién elegida es un `blob:` del mismo teléfono.
 */
const FOTOS = Object.values(MEDIOS_DE_LA_TIENDA)
  .map((h) => `https://${h}`)
  .join(' ');

export function cabecerasDelPanel(core: readonly string[]): string {
  return [
    '/*',
    `  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: ${FOTOS}; font-src 'self'; connect-src 'self' ${core.join(' ')}; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: no-referrer',
    '  X-Robots-Tag: noindex',
    // El service worker y su registro se revisan en cada visita: la versión nueva se ofrece (P10).
    '/sw.js',
    '  Cache-Control: no-cache',
    '',
  ].join('\n');
}

if (process.argv[1]?.endsWith('armar-panel-tienda.ts')) {
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('❌ Falta apps/tienda-panel/dist/index.html: corre antes «vite build».');
    process.exit(1);
  }
  writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  writeFileSync(join(dist, '_headers'), cabecerasDelPanel(origenesDelCore()));
  console.log('✅ Panel de la Tienda armado en apps/tienda-panel/dist');
}
