/**
 * La política de contenido de la vitrina (HU-T3.6 CA2, TIENDA §11.4): una sola fuente para el
 * despacho, que la manda en cada página, y para las pruebas, que comparan lo declarado con lo que la
 * página carga de verdad. Sin nada en línea ni de terceros: el JavaScript, la hoja y las fuentes son
 * del mismo origen, y las fotos, de su host (`MEDIOS`, HU-T5.6).
 *
 * Cuando una tienda con dominio propio mida con GA4 o Meta (D-T13), sus orígenes se suman aquí, por
 * tienda, y la prueba lo exige igual.
 *
 * El carrito (`/carrito/`) es la única página que deja cargar algo de afuera: el programa de Bold,
 * que la isla carga solo al tocar «Pagar en línea», y su pago embebido en un marco (HU-T11.4,
 * TIENDA §9.3). Ninguna otra página lo permite.
 */
export const ORIGEN_DE_BOLD = 'https://checkout.bold.co';
export const RUTA_DEL_PAGO = '/carrito/';

export function cspDeLaVitrina(medios: string | undefined, ruta?: string): string {
  const pago = ruta === RUTA_DEL_PAGO;
  return [
    "default-src 'self'",
    `img-src 'self'${medios ? ` https://${medios}` : ''} data:`,
    "style-src 'self'",
    `script-src 'self'${pago ? ` ${ORIGEN_DE_BOLD}` : ''}`,
    ...(pago ? [`frame-src ${ORIGEN_DE_BOLD}`] : []),
    "connect-src 'self'",
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
    script: [propio, ...(ruta === RUTA_DEL_PAGO ? [ORIGEN_DE_BOLD] : [])],
    stylesheet: [propio],
    font: [propio],
    image: [propio, ...(medios ? [`https://${medios}`] : [])],
    fetch: [propio],
  };
}
