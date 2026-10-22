/**
 * La landing de TiendaPro por ambiente (HU-T18.5): sus cabeceras (`_headers` de Workers Static
 * Assets), su `robots.txt` y a qué panel lleva «Crear tienda». La arma `scripts/armar-tiendapro.ts`
 * para staging, y el despliegue a producción la vuelve a armar para producción.
 *
 * - **CSP:** solo lo propio. Sin `'unsafe-inline'`: las hojas y el único script van en archivo
 *   (CA3: ningún tercero, con o sin consentimiento, porque la landing no mide).
 * - **Staging** no se indexa y lleva al panel de staging; **producción**, al de `app.tiendapro.co`.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PANEL_DE_PRODUCCION } from '../../packages/tienda-schema/src/marca.ts';
import { type ConfigCeldas, cargarCeldas } from './celdas.ts';

export type AmbienteDeLaLanding = 'staging' | 'produccion';

export const CSP_DE_LA_LANDING = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** El panel de cada ambiente, de `celdas.json` (P2): el de la celda de la Tienda. */
export function panelDelAmbiente(
  ambiente: AmbienteDeLaLanding,
  config: ConfigCeldas = cargarCeldas(),
): string {
  const celda = config.celdas.find((c) => c.producto === 'tienda' && c.estado === 'activa');
  if (!celda) throw new Error('celdas.json no tiene una celda activa de la Tienda');
  const url = ambiente === 'staging' ? celda.api_staging : celda.api;
  return `${url.replace(/\/$/, '')}/`;
}

export function cabecerasDeLaLanding(ambiente: AmbienteDeLaLanding): string {
  const comunes = [
    `  Content-Security-Policy: ${CSP_DE_LA_LANDING}`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
    ...(ambiente === 'produccion'
      ? ['  Strict-Transport-Security: max-age=31536000']
      : ['  X-Robots-Tag: noindex, nofollow']),
  ];
  return [
    '/*',
    ...comunes,
    '',
    // Lo que lleva su huella en el nombre no cambia nunca.
    '/_astro/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n');
}

const ROBOTS_DE_STAGING = 'User-agent: *\nDisallow: /\n';

/** Los HTML del sitio armado, para cambiarles el panel. */
function htmlDe(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return htmlDe(ruta);
    return n.endsWith('.html') || n.endsWith('.txt') || n.endsWith('.md') ? [ruta] : [];
  });
}

/**
 * Deja `dist` listo para su ambiente: las cabeceras, el robots y el panel de «Crear tienda». Se
 * puede correr dos veces: cambia el panel que encuentre por el del ambiente.
 */
export function armarLaLandingPara(
  dist: string,
  ambiente: AmbienteDeLaLanding,
  config: ConfigCeldas = cargarCeldas(),
): void {
  writeFileSync(join(dist, '_headers'), cabecerasDeLaLanding(ambiente));
  const otros = (['staging', 'produccion'] as const)
    .filter((a) => a !== ambiente)
    .map((a) => panelDelAmbiente(a, config));
  const destino = panelDelAmbiente(ambiente, config);
  for (const archivo of htmlDe(dist)) {
    let texto = readFileSync(archivo, 'utf8');
    for (const otro of [...otros, PANEL_DE_PRODUCCION]) {
      if (otro !== destino) texto = texto.replaceAll(otro, destino);
    }
    writeFileSync(archivo, texto);
  }
  if (ambiente === 'staging') writeFileSync(join(dist, 'robots.txt'), ROBOTS_DE_STAGING);
}
