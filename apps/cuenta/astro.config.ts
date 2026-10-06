import preact from '@astrojs/preact';
import { defineConfig } from 'astro/config';

// Todo estático (static-first): el Worker del CORE sirve estas páginas como assets y solo corre
// en /api/core/*, /oauth/* y /.well-known/* (HU-C7.2). Los componentes de Preact se usan sin
// `client:*`: llegan como HTML, sin JavaScript. Las hojas de estilo van siempre en archivo, nunca
// en línea, porque la CSP es `style-src 'self'`.
export default defineConfig({
  site: 'https://cuenta.laboratorio-digital.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never' },
  integrations: [preact()],
});
