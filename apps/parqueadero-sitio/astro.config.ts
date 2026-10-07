import preact from '@astrojs/preact';
import { defineConfig } from 'astro/config';

// Todo estático (ADR-32): el Worker solo sirve assets. Las hojas nunca van en línea: la CSP es
// `style-src 'self'` y un <style> en línea se ignoraría en silencio (bitácora agro, terreno).
// La caja (/caja/) es otra compilación, con Vite: src/caja/vite.config.ts.
export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never' },
  integrations: [preact()],
});
