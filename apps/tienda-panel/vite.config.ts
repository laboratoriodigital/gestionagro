/**
 * Build del panel de la Tienda (HU-T3.5 y HU-T8.1, TIENDA-3.0 §3.1 y §12): una PWA de Preact en la
 * raíz de `panel.`, solo assets. El Worker corre únicamente en `/api/*`.
 *
 * - `injectManifest`: el service worker es nuestro (`src/app/sw.ts`); nada de `/api/*` se guarda.
 * - `registerType: 'prompt'`: la versión nueva espera y la persona decide cuándo (P10), como el
 *   cuaderno.
 * - Un solo build sirve a staging y a producción: el panel elige el CORE por su host. Los dos
 *   salen de `celdas.json` (P2).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const { core, celdas } = JSON.parse(
  readFileSync(new URL('../../infrastructure/celdas.json', import.meta.url), 'utf8'),
) as {
  core: { url: string; url_staging: string };
  celdas: { id: string; api: string }[];
};
const panel = celdas.find((c) => c.id === 'c1');
if (!panel) throw new Error('celdas.json no tiene la celda c1 de la Tienda');
const { version } = JSON.parse(
  readFileSync(new URL('../tienda-api/package.json', import.meta.url), 'utf8'),
) as { version: string };

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/',
  publicDir: 'public',
  define: {
    __VERSION_PANEL__: JSON.stringify(version),
    __CORE_DEL_PANEL__: JSON.stringify({
      panel: new URL(panel.api).hostname,
      url: core.url,
      url_staging: core.url_staging,
    }),
  },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  plugins: [
    preact(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/app',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      scope: '/',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,woff2,webmanifest}'] },
      manifest: {
        id: '/',
        name: 'TiendaPro · El panel de tu tienda',
        short_name: 'TiendaPro',
        description: 'Tus pedidos, tus productos y tu tienda, desde el teléfono.',
        lang: 'es-CO',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#9c4a1a',
        background_color: '#ffffff',
        icons: [{ src: 'icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
});
