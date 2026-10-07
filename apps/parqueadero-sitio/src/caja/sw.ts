/// <reference lib="webworker" />
/**
 * Service worker de la caja (HU-Q3.1, PARQUEADERO §5.3).
 *
 * - Precarga todo lo de `/caja/`, también el codificador ESC/POS: con la caja abierta una vez,
 *   abre e imprime en modo avión.
 * - Las navegaciones dentro de `/caja/` responden con el `index.html` precargado.
 * - La versión nueva espera: `skipWaiting` solo cuando la caja lo pide (CA3).
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
  new NavigationRoute(createHandlerBoundToURL('/caja/index.html'), { allowlist: [/^\/caja\//] }),
);

self.addEventListener('message', (evento) => {
  if ((evento.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});
