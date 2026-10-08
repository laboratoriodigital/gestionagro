/**
 * Cabeceras de seguridad del cuaderno (ARQUITECTURA §9, HU-E0.5): `_headers` de Workers Static
 * Assets, generado desde `celdas.json` (P2) por `scripts/armar-despliegue.ts`.
 *
 * La CSP del cuaderno solo deja cargar código propio y solo deja conectarse a su origen, al CORE
 * y a la API de cada celda, en producción y staging. Es lo mismo que la política de datos dice:
 * ningún script ni conexión de terceros. Una prueba ata las tres cosas (P18).
 *
 * La única excepción es el programa de pago de Bold (HU-E0.7), que la política declara en
 * `scripts_al_pagar`: se carga solo al tocar «Pagar», y la CSP lo permite solo como script.
 *
 * Conexiones de terceros: solo las que la política declara en `conexiones_de_terceros`. Hoy, la
 * API de Google Drive, para la copia que la persona guarda en su propio Drive (HU-E8.4, etapa 1).
 * No carga ningún script de Google.
 */
import politica from '../../content/agro/privacidad/politica.json' with { type: 'json' };
import type { ConfigCeldas } from './celdas.ts';

/** Orígenes con los que el cuaderno habla, además del propio. */
export function conexionesDelCuaderno(config: ConfigCeldas): string[] {
  return [
    ...new Set([
      config.core.url,
      config.core.url_staging,
      // Solo las celdas del agro: el cuaderno no habla con la API de otro producto (HU-Q7.2).
      ...config.celdas.filter((c) => c.producto === 'agro').flatMap((c) => [c.api, c.api_staging]),
      // Las de terceros solo si la política las declara (HU-E8.4: Google Drive).
      ...(politica.conexiones_de_terceros ?? []),
    ]),
  ].sort();
}

export function cspDelCuaderno(config: ConfigCeldas): string {
  return [
    "default-src 'self'",
    ["script-src 'self'", ...politica.scripts_al_pagar].join(' '),
    "style-src 'self'",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${conexionesDelCuaderno(config).join(' ')}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * Páginas públicas del sitio (revisión de seguridad, 3 oct 2026: se servían sin cabeceras).
 * Las calculadoras traen scripts en línea de Astro (las islas), así que su CSP no limita los
 * scripts todavía: impide que otra página las enmarque y cierra object, base y formularios.
 */
export const CSP_PUBLICA = [
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * La página del QR muestra datos que trae el código escaneado: CSP estricta. Solo su script
 * propio (lo empaqueta Astro aparte) y ninguna conexión: verifica la firma ahí mismo.
 */
export const CSP_QR = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

/** Un año de HTTPS obligatorio para el dominio del sitio. */
export const HSTS = 'max-age=31536000';

export function textoDeCabeceras(config: ConfigCeldas): string {
  const bloque = (ruta: string, cabeceras: [string, string][]) =>
    [ruta, ...cabeceras.map(([k, v]) => `  ${k}: ${v}`)].join('\n');
  const comunes = (csp: string, referrer: string): [string, string][] => [
    ['Content-Security-Policy', csp],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', referrer],
    ['Strict-Transport-Security', HSTS],
  ];
  // Reglas que no se pisan entre sí: Workers Static Assets junta las cabeceras de todas las que
  // coinciden, y un Referrer-Policy repetido dejaría el último, más laxo, en el cuaderno.
  // El comodín del cuaderno también cubre /agro/app/ (la prueba de humo lo comprueba, P16).
  return `# Generado por scripts/armar-despliegue.ts desde infrastructure/celdas.json. No editar a mano.\n${[
    bloque('/agro/app/*', comunes(cspDelCuaderno(config), 'no-referrer')),
    bloque('/agro/t/*', comunes(CSP_QR, 'no-referrer')),
    bloque('/agro/privacidad/*', comunes(CSP_PUBLICA, 'strict-origin-when-cross-origin')),
    bloque('/agro/guia/*', comunes(CSP_PUBLICA, 'strict-origin-when-cross-origin')),
    bloque('/agro/vendedores/*', comunes(CSP_PUBLICA, 'strict-origin-when-cross-origin')),
    bloque('/herramientas/*', comunes(CSP_PUBLICA, 'strict-origin-when-cross-origin')),
  ].join('\n')}\n`;
}
