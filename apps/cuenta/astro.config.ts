import preact from '@astrojs/preact';
import { defineConfig } from 'astro/config';

// Todo estático (static-first): el Worker del CORE sirve estas páginas como assets y solo corre
// en /api/core/*, /oauth/* y /.well-known/* (HU-C7.2). Los componentes de Preact se usan sin
// `client:*`: llegan como HTML, sin JavaScript. Las hojas de estilo y el único script (la sesión,
// HU-C7.3) van siempre en archivo, nunca en línea, porque la CSP es `'self'`.
export default defineConfig({
  site: 'https://cuenta.laboratorio-digital.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never' },
  integrations: [preact()],
  // Sin esto, Vite mete en línea un script pequeño, y la CSP lo bloquearía.
  vite: { build: { assetsInlineLimit: 0 } },
});
