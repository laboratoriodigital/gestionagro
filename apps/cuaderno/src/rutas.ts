/**
 * Rutas del cuaderno bajo `/agro/app/` (una sola fuente, P2). La usan el enrutador de la app y
 * `scripts/armar-despliegue.ts`, que deja un `index.html` en cada una: así abrir un enlace directo
 * funciona en producción aunque el service worker todavía no esté instalado, sin ejecutar el
 * Worker (ED1 [H3]).
 */
export const BASE_APP = '/agro/app/';

/**
 * Los grupos de «Más» (HU-E0.11): la barra de abajo lleva Inicio, Carencias, Anotar, Historial y
 * Más; el resto de las secciones se encuentra en «Más», agrupado por lo que se hace con él.
 */
export const GRUPOS_DEL_MENU = [
  'Tu finca',
  'Anotar y consultar',
  'Venta',
  'Números',
  'Tus datos',
] as const;

export const RUTAS_APP = [
  { segmento: '', titulo: 'Áreas', grupo: 'Tu finca' },
  { segmento: 'registrar', titulo: 'Registrar', grupo: 'Anotar y consultar' },
  { segmento: 'historial', titulo: 'Historial', grupo: 'Anotar y consultar' },
  { segmento: 'carencias', titulo: 'Carencias', grupo: 'Anotar y consultar' },
  { segmento: 'lotes', titulo: 'Lotes', grupo: 'Venta' },
  // Solo con la finca creada (pedido del dueño, 5 oct 2026): antes no hay nada que medir.
  { segmento: 'rendimiento', titulo: 'Rendimiento', grupo: 'Números', requiereFinca: true },
  { segmento: 'costos', titulo: 'Costos', grupo: 'Números', requiereFinca: true },
  { segmento: 'personas', titulo: 'Personas', grupo: 'Tu finca' },
  { segmento: 'insumos', titulo: 'Insumos', grupo: 'Tu finca' },
  { segmento: 'respaldo', titulo: 'Respaldo', grupo: 'Tus datos' },
  { segmento: 'cuenta', titulo: 'Cuenta', grupo: 'Tus datos' },
  // «Más» es la lista de todas las secciones; se llega desde la barra de abajo (HU-E0.11).
  { segmento: 'mas', titulo: 'Más', enMenu: false },
  // A «Unirme» se llega desde el enlace de una invitación (HU-E4.4); no va en el menú.
  { segmento: 'unirme', titulo: 'Unirme', enMenu: false },
  // A «Planes» se llega por enlaces, nunca como ventana durante el registro (HU-E0.6, CA4).
  { segmento: 'planes', titulo: 'Planes', enMenu: false },
] as const;

export const rutaDe = (segmento: string): string =>
  segmento ? `${BASE_APP}${segmento}/` : BASE_APP;
