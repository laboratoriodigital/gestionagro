/**
 * Cabeceras del sitio del parqueadero (HU-Q5.1, PARQUEADERO §13): `_headers` de Workers Static
 * Assets, escrito por `scripts/armar-parqueadero.ts`.
 *
 * La caja solo carga código propio y solo se conecta a su origen: en M0 no hay cuenta ni API
 * (ADR-32). WhatsApp se abre con un enlace, que es una navegación y no una conexión. Sin
 * `'unsafe-inline'` en ningún lado: los estilos van en hojas (bitácora agro, terreno).
 */
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

export type EntornoDelParqueadero = 'staging' | 'produccion';

/**
 * `staging`: nada se indexa. Producción (HU-Q5.2) suma HSTS, y la caja y los recibos tampoco se
 * indexan: son una herramienta y copias de recibos, no páginas para buscadores.
 */
export function textoDeCabecerasDelParqueadero(entorno: EntornoDelParqueadero): string {
  const linea = ([k, v]: [string, string]) => `  ${k}: ${v}`;
  const todas: [string, string][] = [
    ['Content-Security-Policy', CSP_DEL_PARQUEADERO],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'no-referrer'],
    entorno === 'staging'
      ? ['X-Robots-Tag', 'noindex']
      : ['Strict-Transport-Security', 'max-age=31536000'],
  ];
  const bloques = [`/*\n${todas.map(linea).join('\n')}`];
  if (entorno === 'produccion') {
    for (const ruta of ['/caja/*', '/r/*'])
      bloques.push(`${ruta}\n${linea(['X-Robots-Tag', 'noindex'])}`);
  }
  return `# Generado por scripts/armar-parqueadero.ts. No editar a mano.\n${bloques.join('\n')}\n`;
}

/** El robots.txt: staging no deja pasar nada; producción, todo menos la caja y los recibos. */
export const textoDeRobotsDelParqueadero = (entorno: EntornoDelParqueadero): string =>
  entorno === 'staging'
    ? 'User-agent: *\nDisallow: /\n'
    : 'User-agent: *\nDisallow: /caja/\nDisallow: /r/\n';
