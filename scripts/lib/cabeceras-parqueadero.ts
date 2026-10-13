/**
 * Cabeceras del sitio del parqueadero (HU-Q5.1, PARQUEADERO §13): `_headers` de Workers Static
 * Assets, escrito por `scripts/armar-parqueadero.ts`.
 *
 * La caja solo carga código propio y solo se conecta a su origen y a la API de las celdas del
 * parqueadero del entorno, con la que sincroniza (HU-Q7.5), al CORE de las cuentas (HU-Q7.6) y a
 * Google Drive para su copia (HU-Q10.1). WhatsApp se abre con un enlace, que es
 * una navegación y no una conexión. Sin `'unsafe-inline'` en ningún lado: los estilos van en hojas
 * (bitácora agro, terreno).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import politica from '../../content/parqueadero/privacidad/politica.json' with { type: 'json' };
import { ORIGEN_DRIVE } from '../../packages/drive/src/index.ts';
import { celdasDelDirectorio } from './celda-parqueadero.ts';
import { type ConfigCeldas, cargarCeldas } from './celdas.ts';

export type EntornoDelParqueadero = 'staging' | 'produccion';

/**
 * Las APIs con que la caja sincroniza: las de las celdas del parqueadero en `celdas.json` (P2). En
 * producción ninguna mientras esas celdas esperan su publicación (HU-Q7.12), como en el directorio
 * del CORE: una caja de producción no se conecta a una celda que no existe.
 */
export function conexionesDeLaCaja(
  entorno: EntornoDelParqueadero,
  config: ConfigCeldas = cargarCeldas(),
): string[] {
  return celdasDelDirectorio(config.celdas, entorno)
    .filter((c) => c.producto === 'parqueadero')
    .map((c) => (entorno === 'staging' ? c.api_staging : c.api))
    .sort();
}

/**
 * El CORE de las cuentas, con que la caja entra y renueva su sesión (HU-Q7.6). Solo en staging:
 * en producción la caja no ofrece la cuenta hasta HU-Q7.12.
 */
export const coreDeLaCaja = (
  entorno: EntornoDelParqueadero,
  config: ConfigCeldas = cargarCeldas(),
): string[] => (entorno === 'staging' ? [config.core.url_staging] : []);

/**
 * Google Drive, donde la caja guarda y trae su copia con el permiso que pide el CORE (HU-Q10.1).
 * Va con el CORE: solo en staging hasta que el CORE de producción la publique.
 */
export const driveDeLaCaja = (entorno: EntornoDelParqueadero): string[] =>
  entorno === 'staging' ? [ORIGEN_DRIVE] : [];

/**
 * El programa de pago de Bold, para pagar el plan desde «Cuenta y nube» (HU-Q7.10): el que la
 * política de la cuenta declara en `scripts_al_pagar`, solo como script y solo en staging, como la
 * cuenta, hasta HU-Q7.12. Se carga al tocar «Pagar», nunca al abrir la caja.
 */
export const pagoDeLaCaja = (entorno: EntornoDelParqueadero): string[] =>
  entorno === 'staging' ? [...politica.scripts_al_pagar] : [];

export function cspDelParqueadero(
  entorno: EntornoDelParqueadero,
  config: ConfigCeldas = cargarCeldas(),
): string {
  return [
    "default-src 'self'",
    ["script-src 'self'", ...pagoDeLaCaja(entorno)].join(' '),
    "style-src 'self'",
    "img-src 'self' data: blob:",
    [
      "connect-src 'self'",
      ...conexionesDeLaCaja(entorno, config),
      ...coreDeLaCaja(entorno, config),
      ...driveDeLaCaja(entorno),
    ].join(' '),
    "worker-src 'self'",
    "manifest-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** Lo que nunca se indexa, tampoco en producción: la caja y los recibos de los conductores. */
export const RUTAS_SIN_INDEXAR = ['/caja/*', '/r/*'] as const;

/**
 * `staging`: nada se indexa. Producción (HU-Q5.2): HSTS, y la página del parqueadero se puede
 * encontrar, pero la caja y los recibos no.
 */
export function textoDeCabecerasDelParqueadero(entorno: EntornoDelParqueadero): string {
  const cabeceras: [string, string][] = [
    ['Content-Security-Policy', cspDelParqueadero(entorno)],
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
  entorno: EntornoDelParqueadero,
): void {
  writeFileSync(join(dist, '_headers'), textoDeCabecerasDelParqueadero(entorno));
  writeFileSync(join(dist, 'robots.txt'), robotsDelParqueadero(entorno));
}

/** `robots.txt`: staging cerrado entero; producción, solo la caja y los recibos. */
export function robotsDelParqueadero(entorno: EntornoDelParqueadero): string {
  return entorno === 'staging'
    ? 'User-agent: *\nDisallow: /\n'
    : 'User-agent: *\nDisallow: /caja/\nDisallow: /r/\n';
}
