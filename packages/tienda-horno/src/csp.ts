/**
 * La política de contenido de la vitrina (HU-T3.6 CA2, TIENDA §11.4): una sola fuente para el
 * despacho, que la manda en cada página, y para las pruebas, que comparan lo declarado con lo que la
 * página carga de verdad. Sin nada en línea ni de terceros: el JavaScript, la hoja y las fuentes son
 * del mismo origen, y las fotos, de su host (`MEDIOS`, HU-T5.6).
 *
 * HU-T14.4 (D-T13): cuando una tienda mide con GA4 o con el píxel de Meta, sus orígenes se suman
 * aquí, solo para esa tienda (`terceros`, del manifiesto de su versión). El de Meta, nunca en una
 * dirección de la plataforma: su cookie compartiría al comprador entre tiendas. Los programas solo
 * cargan después de que el comprador acepta; la CSP es lo que nunca deja pasar lo demás.
 *
 * El carrito (`/carrito/`) y la confirmación de lo que preparó un asistente (`/pedido/confirmar/`,
 * HU-T15.5) son las únicas páginas que dejan cargar algo de afuera: el programa de Bold, que la isla
 * carga solo al tocar «Pagar en línea», y su pago embebido en un marco (HU-T11.4, TIENDA §9.3).
 * Ninguna otra página lo permite.
 *
 * El pago embebido de Bold pone su propia hoja en línea (`#boldEmbeddedCheckout{…position:fixed…}`,
 * dentro de su shadow DOM): sin ella, el marco queda de 300 × 150 al final de la página. Por eso
 * `/carrito/` deja también los estilos en línea. No un hash: Bold cambia su programa sin avisar y
 * un hash viejo rompería el pago en silencio. Los scripts en línea siguen prohibidos en todas.
 */
export const ORIGEN_DE_BOLD = 'https://checkout.bold.co';
export const RUTA_DEL_PAGO = '/carrito/';
/** HU-T15.5: las páginas que pagan con Bold. */
export const RUTAS_DEL_PAGO: readonly string[] = [RUTA_DEL_PAGO, '/pedido/confirmar/'];
const esDelPago = (ruta: string | undefined) => ruta !== undefined && RUTAS_DEL_PAGO.includes(ruta);

export type Tercero = 'ga4' | 'meta';
/** Lo que cada uno carga, pide y pinta. */
export const ORIGENES_DE_TERCEROS: Readonly<
  Record<Tercero, { script: string[]; connect: string[]; img: string[] }>
> = {
  ga4: {
    script: ['https://www.googletagmanager.com'],
    connect: [
      'https://www.googletagmanager.com',
      'https://*.google-analytics.com',
      'https://*.analytics.google.com',
    ],
    img: ['https://www.googletagmanager.com', 'https://*.google-analytics.com'],
  },
  meta: {
    script: ['https://connect.facebook.net'],
    connect: ['https://connect.facebook.net', 'https://www.facebook.com'],
    img: ['https://www.facebook.com'],
  },
};
export const ZONA_DE_LA_PLATAFORMA = 'laboratorio-digital.app';
export const esDeLaPlataforma = (host: string): boolean =>
  host === ZONA_DE_LA_PLATAFORMA || host.endsWith(`.${ZONA_DE_LA_PLATAFORMA}`);

/** Los terceros que una dirección deja medir: Meta nunca en una de la plataforma (D-T13). */
export const tercerosDeLaDireccion = (
  terceros: readonly Tercero[] | undefined,
  host: string,
): Tercero[] =>
  [...new Set(terceros ?? [])].filter(
    (t) => t === 'ga4' || (t === 'meta' && !esDeLaPlataforma(host)),
  );

const de = (terceros: readonly Tercero[], tipo: 'script' | 'connect' | 'img') =>
  terceros.flatMap((t) => ORIGENES_DE_TERCEROS[t][tipo]);
const lista = (o: string[]) => (o.length > 0 ? ` ${o.join(' ')}` : '');

export function cspDeLaVitrina(
  medios: string | undefined,
  ruta?: string,
  terceros: readonly Tercero[] = [],
): string {
  const pago = esDelPago(ruta);
  return [
    "default-src 'self'",
    `img-src 'self'${medios ? ` https://${medios}` : ''} data:${lista(de(terceros, 'img'))}`,
    `style-src 'self'${pago ? " 'unsafe-inline'" : ''}`,
    `script-src 'self'${pago ? ` ${ORIGEN_DE_BOLD}` : ''}${lista(de(terceros, 'script'))}`,
    ...(pago ? [`frame-src ${ORIGEN_DE_BOLD}`] : []),
    `connect-src 'self'${lista(de(terceros, 'connect'))}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** Lo que la CSP deja cargar, por tipo: lo usa la prueba que mira la página de verdad. */
export function origenesPermitidos(
  medios: string | undefined,
  propio: string,
  ruta?: string,
): Record<'script' | 'stylesheet' | 'font' | 'image' | 'fetch', readonly string[]> {
  return {
    script: [propio, ...(esDelPago(ruta) ? [ORIGEN_DE_BOLD] : [])],
    stylesheet: [propio],
    font: [propio],
    image: [propio, ...(medios ? [`https://${medios}`] : [])],
    fetch: [propio],
  };
}
