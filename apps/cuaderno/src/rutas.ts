/**
 * Rutas del cuaderno bajo `/agro/app/` (una sola fuente, P2). La usan el enrutador de la app y
 * `scripts/armar-despliegue.ts`, que deja un `index.html` en cada una: así abrir un enlace directo
 * funciona en producción aunque el service worker todavía no esté instalado, sin ejecutar el
 * Worker (ED1 [H3]).
 */
export const BASE_APP = '/agro/app/';

export const RUTAS_APP = [
  { segmento: '', titulo: 'Áreas' },
  { segmento: 'registrar', titulo: 'Registrar' },
  { segmento: 'historial', titulo: 'Historial' },
  { segmento: 'personas', titulo: 'Personas' },
  { segmento: 'insumos', titulo: 'Insumos' },
  { segmento: 'respaldo', titulo: 'Respaldo' },
  { segmento: 'cuenta', titulo: 'Cuenta' },
  // A «Unirme» se llega desde el enlace de una invitación (HU-E4.4); no va en el menú.
  { segmento: 'unirme', titulo: 'Unirme', enMenu: false },
] as const;

export const rutaDe = (segmento: string): string =>
  segmento ? `${BASE_APP}${segmento}/` : BASE_APP;
