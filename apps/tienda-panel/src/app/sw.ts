/// <reference lib="webworker" />
/**
 * El service worker del panel (HU-T8.1, «lo publicado»): precarga la app para que abra rápido y
 * avisa de la versión nueva sin aplicarla sola.
 *
 * - `/api/*` nunca se intercepta ni se guarda: ninguna respuesta con datos de la tienda queda en la
 *   caché del navegador (P7).
 * - Las navegaciones del panel responden con el `index.html` precargado.
 * - La versión nueva espera hasta que la persona toca «Actualizar».
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
  new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }),
);

self.addEventListener('message', (evento) => {
  if ((evento.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});
