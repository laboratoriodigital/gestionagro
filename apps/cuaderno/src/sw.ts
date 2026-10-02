/// <reference lib="webworker" />
/**
 * Service worker del cuaderno (HU-E3.1, ARQUITECTURA §5.3).
 *
 * - Precache del shell: con la app abierta una vez, abre completa sin señal (CA1).
 * - Navegaciones dentro de `/agro/app/` responden con el `index.html` precacheado.
 * - `/api/*` NO se intercepta: va siempre a la red y ninguna respuesta suya, ni buena ni de error,
 *   queda en caché (CA3, P7). Los datos viven en IndexedDB, no en la caché HTTP.
 * - La versión nueva espera (`skipWaiting` solo cuando la app lo pide, HU-E3.1 CA2).
 * - El generador de la carpeta en PDF (HU-E9.2) no se precarga: se guarda la primera vez que se
 *   usa y desde ahí funciona sin señal. Solo se conserva su última versión.
 */

import type { WorkboxPlugin } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/agro/app/index.html'), {
    allowlist: [/^\/agro\/app\//],
    denylist: [/^\/api\//],
  }),
);

registerRoute(
  ({ url }) => /^\/agro\/app\/assets\/carpeta-pdf-[\w-]+\.js$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'carpeta-pdf',
    // Los tipos de workbox no declaran `| undefined` en sus opcionales (exactOptionalPropertyTypes).
    plugins: [new ExpirationPlugin({ maxEntries: 1 }) as unknown as WorkboxPlugin],
  }),
);

self.addEventListener('message', (evento) => {
  if ((evento.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});
