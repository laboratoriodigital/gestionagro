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

/** `staging`: nada se indexa. Producción (HU-Q5.2) suma HSTS cuando tenga su dominio. */
export function textoDeCabecerasDelParqueadero(entorno: 'staging' | 'produccion'): string {
  const cabeceras: [string, string][] = [
    ['Content-Security-Policy', CSP_DEL_PARQUEADERO],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'no-referrer'],
    ...(entorno === 'staging'
      ? ([['X-Robots-Tag', 'noindex']] as [string, string][])
      : ([['Strict-Transport-Security', 'max-age=31536000']] as [string, string][])),
  ];
  return `# Generado por scripts/armar-parqueadero.ts. No editar a mano.\n/*\n${cabeceras
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n')}\n`;
}
