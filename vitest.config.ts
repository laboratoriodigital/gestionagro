import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Node no tiene el módulo de workerd que usa la entrada de servicio del CORE (HU-C5.6).
    alias: {
      'cloudflare:workers': fileURLToPath(
        new URL('./tests/stubs/cloudflare-workers.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // En CI, 2 procesos. Vitest usa «núcleos − 1», y los equipos de GitHub de un repositorio
    // privado tienen 2: corría los 205 archivos de uno en uno. Medido el 12 oct 2026 fijando el
    // proceso a 2 núcleos: 1 proceso 109 s, 2 procesos 95 s, 4 procesos 94 s (bitácora core 11).
    ...(process.env['CI'] ? { maxWorkers: 2 } : {}),
    coverage: {
      provider: 'v8',
      include: [
        'scripts/**/*.ts',
        'packages/*/src/**/*.ts',
        'packages/*/src/**/*.tsx',
        'apps/*/src/**/*.ts',
      ],
      reporter: ['text', 'json-summary'],
    },
  },
});
