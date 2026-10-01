/**
 * `node scripts/generar-wrangler.ts`: genera `apps/sitio/wrangler.jsonc` desde `celdas.json`
 * (HU-E1.5, CA1). El archivo no se edita a mano; una prueba exige que sea el generado (P2).
 *
 * - El sitio es asset estático; solo `/api/*` ejecuta el Worker (ED1 [H3]).
 * - Ningún id de cuenta en el archivo: wrangler lo toma de `CLOUDFLARE_ACCOUNT_ID` (ADR-6).
 * - Producción en el dominio de ADR-19; staging en workers.dev, con su propio dataset de eventos.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type ConfigCeldas, cargarCeldas } from './lib/celdas.ts';
import { RAIZ } from './lib/repo.ts';

/** Fecha de compatibilidad del runtime de Workers. Cambiarla es una decisión, no un descuido. */
export const FECHA_COMPATIBILIDAD = '2026-09-30';

export const RUTA_WRANGLER_SITIO = join(RAIZ, 'apps', 'sitio', 'wrangler.jsonc');

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

export function textoWranglerDelSitio(config: ConfigCeldas): string {
  const cabecera =
    '// GENERADO por scripts/generar-wrangler.ts desde infrastructure/celdas.json. No editar a mano.\n';
  return `${cabecera}${JSON.stringify(wranglerDelSitio(config), null, 2)}\n`;
}

if (process.argv[1]?.endsWith('generar-wrangler.ts')) {
  writeFileSync(RUTA_WRANGLER_SITIO, textoWranglerDelSitio(cargarCeldas()));
  console.log(`✅ ${RUTA_WRANGLER_SITIO}`);
}
