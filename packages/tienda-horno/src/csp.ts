/**
 * La política de contenido de la vitrina (HU-T3.6 CA2, TIENDA §11.4): una sola fuente para el
 * despacho, que la manda en cada página, y para las pruebas, que comparan lo declarado con lo que la
 * página carga de verdad. Sin nada en línea ni de terceros: el JavaScript, la hoja y las fuentes son
 * del mismo origen, y las fotos, de su host (`MEDIOS`, HU-T5.6).
 *
 * Cuando una tienda con dominio propio mida con GA4 o Meta (D-T13), sus orígenes se suman aquí, por
 * tienda, y la prueba lo exige igual.
 */
export function cspDeLaVitrina(medios: string | undefined): string {
  return [
    "default-src 'self'",
    `img-src 'self'${medios ? ` https://${medios}` : ''} data:`,
    "style-src 'self'",
    "script-src 'self'",
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
): Record<'script' | 'stylesheet' | 'font' | 'image' | 'fetch', readonly string[]> {
  return {
    script: [propio],
    stylesheet: [propio],
    font: [propio],
    image: [propio, ...(medios ? [`https://${medios}`] : [])],
    fetch: [propio],
  };
}
