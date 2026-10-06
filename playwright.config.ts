/**
 * Pruebas e2e (ARQUITECTURA §10): teléfono de 360 px, sin esperas por tiempo (P19).
 *
 * Navegador: en CI, el Chromium de Playwright; en Windows local, el Microsoft Edge del sistema
 * (mismo motor Chromium), porque la descarga de Chromium de Playwright no funciona en la máquina
 * del dueño (bitácora agro, «Lo que el terreno enseñó»). `PW_CANAL` lo fuerza; vacío cuenta como
 * no puesto, porque el flujo de CI lo pasa vacío en los equipos de GitHub y `msedge` en el runner
 * propio (`docs/runbooks/runner-propio.md`).
 */
import { defineConfig, devices } from '@playwright/test';

// Puerto propio de las e2e, distinto del 4321 que se usa para revisar a mano: nunca se prueba
// contra un servidor que alguien dejó abierto con otra configuración (P7).
const PUERTO = 4329;
const canal =
  process.env['PW_CANAL'] ||
  (process.env['CI'] ? undefined : process.platform === 'win32' ? 'msedge' : undefined);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  // En CI, 2 workers: el repositorio privado corre en equipos de GitHub de 2 núcleos, donde
  // Playwright tomaba 1 por defecto y las 204 pruebas iban en fila (~4 min, 5 oct 2026). Las
  // mediciones `@rendimiento` siguen con 1 worker (`--workers=1` en el script `e2e`). En local,
  // el valor por defecto: la mitad de los núcleos.
  ...(process.env['CI'] ? { workers: 2 } : {}),
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    ...devices['Galaxy S9+'],
    viewport: { width: 360, height: 740 },
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    ...(canal ? { channel: canal } : {}),
  },
  // Las mediciones con CPU ×4 (`@rendimiento`) corren después de las demás, sin otras pruebas
  // compitiendo por la CPU: emulan un teléfono lento, no una máquina ocupada (bitácora agro 20).
  projects: [
    { name: 'telefono-360', grepInvert: /@rendimiento/ },
    { name: 'rendimiento', grep: /@rendimiento/, dependencies: ['telefono-360'] },
  ],
  webServer: {
    command: `node scripts/servir-estatico.ts apps/sitio/dist ${PUERTO} /agro/app/=apps/cuaderno/dist`,
    url: `http://localhost:${PUERTO}/herramientas/agro/`,
    reuseExistingServer: false,
  },
});
