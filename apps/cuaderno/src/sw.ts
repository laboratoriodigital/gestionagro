/// <reference lib="webworker" />
/**
 * Service worker del cuaderno (HU-E3.1, ARQUITECTURA §5.3).
 *
 * - Precache del shell: con la app abierta una vez, abre completa sin señal (CA1).
 * - Navegaciones dentro de `/agro/app/` responden con el `index.html` precacheado.
 * - `/api/*` NO se intercepta: va siempre a la red y ninguna respuesta suya, ni buena ni de error,
 *   queda en caché (CA3, P7). Los datos viven en IndexedDB, no en la caché HTTP.
 * - La versión nueva espera (`skipWaiting` solo cuando la app lo pide, HU-E3.1 CA2).
 */
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/agro/app/index.html'), {
    allowlist: [/^\/agro\/app\//],
    denylist: [/^\/api\//],
  }),
);

self.addEventListener('message', (evento) => {
  if ((evento.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});
