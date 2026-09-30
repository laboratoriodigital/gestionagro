import preact from '@astrojs/preact';
import { defineConfig } from 'astro/config';
import { SITIO } from './src/lib/seo.ts';

// Todo estático (ADR-11, static-first): el Worker solo atiende /api/* (src/worker.ts).
export default defineConfig({
  site: SITIO,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [preact()],
});
