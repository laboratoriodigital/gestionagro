/**
 * `node scripts/generar-wrangler.ts`: genera `apps/sitio/wrangler.jsonc` (HU-E1.5, CA1) y
 * `apps/core/wrangler.jsonc` (HU-E4.1) desde `celdas.json`. No se editan a mano; una prueba exige
 * que sean los generados (P2).
 *
 * - El sitio es asset estático; solo `/api/*` ejecuta el Worker (ED1 [H3]).
 * - Ningún id de cuenta en el archivo: wrangler lo toma de `CLOUDFLARE_ACCOUNT_ID` (ADR-6).
 * - Producción en el dominio de ADR-19; staging en workers.dev, con su propio dataset de eventos.
 * - El CORE vive en workers.dev en los dos entornos, con una base D1 por entorno. El id de la base
 *   lo agrega el despliegue en un archivo fuera de git (ADR-6), como el del KV de flags.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type ConfigCeldas, cargarCeldas } from './lib/celdas.ts';
import { RAIZ } from './lib/repo.ts';

/** Fecha de compatibilidad del runtime de Workers. Cambiarla es una decisión, no un descuido. */
export const FECHA_COMPATIBILIDAD = '2026-09-30';

export const RUTA_WRANGLER_SITIO = join(RAIZ, 'apps', 'sitio', 'wrangler.jsonc');
export const RUTA_WRANGLER_CORE = join(RAIZ, 'apps', 'core', 'wrangler.jsonc');

/** Migraciones del CORE, relativas a apps/core (ARQUITECTURA §11: por base, en infrastructure/). */
export const MIGRACIONES_CORE = '../../infrastructure/migraciones/core';

export function wranglerDelSitio(config: ConfigCeldas): Record<string, unknown> {
  const { sitio } = config;
  return {
    $schema: 'node_modules/wrangler/config-schema.json',
    name: sitio.worker,
    main: 'src/worker.ts',
    compatibility_date: FECHA_COMPATIBILIDAD,
    assets: {
      directory: './dist',
      binding: 'ASSETS',
      run_worker_first: ['/api/*'],
    },
    workers_dev: false,
    routes: [{ pattern: sitio.dominio, custom_domain: true }],
    analytics_engine_datasets: [{ binding: 'EVENTOS', dataset: sitio.dataset_eventos }],
    observability: { enabled: true },
    env: {
      staging: {
        name: `${sitio.worker}-staging`,
        workers_dev: true,
        routes: [],
        analytics_engine_datasets: [
          { binding: 'EVENTOS', dataset: `${sitio.dataset_eventos}_staging` },
        ],
      },
    },
  };
}

export function wranglerDelCore(config: ConfigCeldas): Record<string, unknown> {
  const { core } = config;
  const base = (nombre: string) => [
    { binding: 'DB', database_name: nombre, migrations_dir: MIGRACIONES_CORE },
  ];
  return {
    $schema: 'node_modules/wrangler/config-schema.json',
    name: core.worker,
    main: 'src/worker.ts',
    compatibility_date: FECHA_COMPATIBILIDAD,
    workers_dev: true,
    d1_databases: base(core.d1),
    observability: { enabled: true },
    env: {
      staging: {
        name: `${core.worker}-staging`,
        workers_dev: true,
        d1_databases: base(`${core.d1}_staging`),
      },
    },
  };
}

const CABECERA =
  '// GENERADO por scripts/generar-wrangler.ts desde infrastructure/celdas.json. No editar a mano.\n';
const comoTexto = (config: Record<string, unknown>) =>
  `${CABECERA}${JSON.stringify(config, null, 2)}\n`;

export const textoWranglerDelSitio = (config: ConfigCeldas): string =>
  comoTexto(wranglerDelSitio(config));
export const textoWranglerDelCore = (config: ConfigCeldas): string =>
  comoTexto(wranglerDelCore(config));

if (process.argv[1]?.endsWith('generar-wrangler.ts')) {
  const config = cargarCeldas();
  writeFileSync(RUTA_WRANGLER_SITIO, textoWranglerDelSitio(config));
  writeFileSync(RUTA_WRANGLER_CORE, textoWranglerDelCore(config));
  console.log(`✅ ${RUTA_WRANGLER_SITIO}\n✅ ${RUTA_WRANGLER_CORE}`);
}
