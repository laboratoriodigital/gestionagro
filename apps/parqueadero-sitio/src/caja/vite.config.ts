/**
 * Build de la caja del parqueadero (HU-Q3.1, ADR-32). Vive en `/caja/` del sitio del parqueadero y
 * sale a `dist/caja/`, junto a lo que arma Astro.
 *
 * - `injectManifest`: el service worker es nuestro (`sw.ts`): precarga todo, también el
 *   codificador ESC/POS, que la caja importa al imprimir el primero (bitácora parqueadero 10).
 * - La versión nueva espera: nunca recarga la caja con un formulario abierto o una impresión en
 *   curso (CA3). La caja la aplica cuando el cajero toca «Actualizar».
 */
import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const raiz = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: raiz,
  base: '/caja/',
  publicDir: 'public',
  build: {
    outDir: fileURLToPath(new URL('../../dist/caja', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
  },
  plugins: [
    preact(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      scope: '/caja/',
      injectManifest: { globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest}'] },
      manifest: {
        id: '/caja/',
        name: 'Caja del parqueadero',
        short_name: 'Caja',
        description: 'Entradas, salidas y recibos en papel y por WhatsApp, sin internet.',
        lang: 'es-CO',
        start_url: '/caja/',
        scope: '/caja/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0b4fa0',
        background_color: '#ffffff',
        icons: [
          { src: 'iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'iconos/icono-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
