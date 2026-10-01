/**
 * Build de la PWA del cuaderno (HU-E3.1, ADR-11). Vive en `/agro/app/` del host de ADR-19.
 *
 * - `registerType: 'prompt'`: la versión nueva espera; la app nunca se recarga sola
 *   (ARQUITECTURA §5.3, regla 3).
 * - `injectManifest`: el service worker es nuestro (`src/sw.ts`), para decidir qué se guarda en
 *   caché y qué no: nada de `/api/*` (P7).
 */
import { readFileSync } from 'node:fs';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};

// Dónde vive el CORE (HU-E4.2). Un solo build sirve a staging y a producción: la app elige por
// host. Sale de celdas.json, la fuente única (P2); el despliegue falla si no coincide.
const { sitio, core } = JSON.parse(
  readFileSync(new URL('../../infrastructure/celdas.json', import.meta.url), 'utf8'),
) as { sitio: { dominio: string }; core: { url: string; url_staging: string } };

export default defineConfig({
  base: '/agro/app/',
  define: {
    __VERSION_APP__: JSON.stringify(version),
    __CORE__: JSON.stringify({
      dominio: sitio.dominio,
      url: core.url,
      url_staging: core.url_staging,
    }),
  },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  plugins: [
    preact(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      scope: '/agro/app/',
      injectManifest: { globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'] },
      manifest: {
        id: '/agro/app/',
        name: 'Cuaderno de campo · Gestión Agro',
        short_name: 'Cuaderno',
        description: 'Registra riego, clima, labores, aplicaciones y cosecha sin señal.',
        lang: 'es-CO',
        start_url: '/agro/app/',
        scope: '/agro/app/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1f6b3a',
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
