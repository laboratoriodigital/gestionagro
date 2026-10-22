import { defineConfig } from 'astro/config';

// La landing de TiendaPro (HU-T18.5): todo estático, servido como assets. Las hojas y el único
// script van en archivo, nunca en línea, porque la CSP es `'self'` (bitácora agro, terreno).
export default defineConfig({
  site: 'https://tiendapro.co',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never' },
  // Sin esto, Vite mete en línea un script o una fuente pequeños, y la CSP los bloquearía.
  vite: { build: { assetsInlineLimit: 0 } },
});
