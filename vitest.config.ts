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
