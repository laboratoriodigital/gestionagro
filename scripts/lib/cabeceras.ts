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
 */
import politica from '../../content/agro/privacidad/politica.json' with { type: 'json' };
import type { ConfigCeldas } from './celdas.ts';

/** Orígenes con los que el cuaderno habla, además del propio. */
export function conexionesDelCuaderno(config: ConfigCeldas): string[] {
  return [
    ...new Set([
      config.core.url,
      config.core.url_staging,
      ...config.celdas.flatMap((c) => [c.api, c.api_staging]),
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

export function textoDeCabeceras(config: ConfigCeldas): string {
  const bloque = (ruta: string) =>
    [
      ruta,
      `  Content-Security-Policy: ${cspDelCuaderno(config)}`,
      '  X-Content-Type-Options: nosniff',
      '  Referrer-Policy: no-referrer',
    ].join('\n');
  // El comodín también cubre /agro/app/ (la prueba de humo del despliegue lo comprueba, P16).
  return `# Generado por scripts/armar-despliegue.ts desde infrastructure/celdas.json. No editar a mano.\n${bloque('/agro/app/*')}\n`;
}
