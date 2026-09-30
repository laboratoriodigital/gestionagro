import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      include: ['scripts/**/*.ts', 'packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
});
