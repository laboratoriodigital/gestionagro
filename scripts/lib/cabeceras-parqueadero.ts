/**
 * Cabeceras del sitio del parqueadero (HU-Q5.1, PARQUEADERO §13): `_headers` de Workers Static
 * Assets, escrito por `scripts/armar-parqueadero.ts`.
 *
 * La caja solo carga código propio y solo se conecta a su origen: en M0 no hay cuenta ni API
 * (ADR-32). WhatsApp se abre con un enlace, que es una navegación y no una conexión. Sin
 * `'unsafe-inline'` en ningún lado: los estilos van en hojas (bitácora agro, terreno).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const CSP_DEL_PARQUEADERO = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Lo que nunca se indexa, tampoco en producción: la caja y los recibos de los conductores. */
export const RUTAS_SIN_INDEXAR = ['/caja/*', '/r/*'] as const;

/**
 * `staging`: nada se indexa. Producción (HU-Q5.2): HSTS, y la página del parqueadero se puede
 * encontrar, pero la caja y los recibos no.
 */
export function textoDeCabecerasDelParqueadero(entorno: 'staging' | 'produccion'): string {
  const cabeceras: [string, string][] = [
    ['Content-Security-Policy', CSP_DEL_PARQUEADERO],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'no-referrer'],
    ...(entorno === 'staging'
      ? ([['X-Robots-Tag', 'noindex']] as [string, string][])
      : ([['Strict-Transport-Security', 'max-age=31536000']] as [string, string][])),
  ];
  const bloque = (ruta: string, filas: [string, string][]) =>
    `${ruta}\n${filas.map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n`;
  const privadas =
    entorno === 'produccion'
      ? RUTAS_SIN_INDEXAR.map((r) => bloque(r, [['X-Robots-Tag', 'noindex']])).join('')
      : '';
  return `# Generado por scripts/armar-parqueadero.ts. No editar a mano.\n${bloque('/*', cabeceras)}${privadas}`;
}

/** Escribe `_headers` y `robots.txt` del entorno en el `dist` ya armado. */
export function escribirCabecerasDelParqueadero(
  dist: string,
  entorno: 'staging' | 'produccion',
): void {
  writeFileSync(join(dist, '_headers'), textoDeCabecerasDelParqueadero(entorno));
  writeFileSync(join(dist, 'robots.txt'), robotsDelParqueadero(entorno));
}

/** `robots.txt`: staging cerrado entero; producción, solo la caja y los recibos. */
export function robotsDelParqueadero(entorno: 'staging' | 'produccion'): string {
  return entorno === 'staging'
    ? 'User-agent: *\nDisallow: /\n'
    : 'User-agent: *\nDisallow: /caja/\nDisallow: /r/\n';
}
