/**
 * La marca y los dominios de la Tienda (D-T15, HU-T18.1 y HU-T18.2): TiendaPro. Una sola fuente para
 * el panel, la API, el horno y el despliegue (P2).
 *
 * - `tiendapro.co` es la marca: la landing, el panel (`app.`), el MCP del comercio (`mcp.`) y los
 *   correos. Nunca sirve nada de un comercio.
 * - `mitiendapro.co` es de las tiendas: `<nombre>.mitiendapro.co`, y `<nombre>--staging.mitiendapro.co`
 *   en staging. Va inscrito en la Public Suffix List (HU-T18.7): cada tienda cuenta como un sitio
 *   aparte, y una tienda mala no arrastra a las demás ni a la marca.
 * - `laboratorio-digital.app` queda como dominio técnico de la empresa (las fotos siguen en `img.`).
 *   Las direcciones de tienda que tuvo llevan a las nuevas con un 301 (HU-T18.1 CA2).
 */
export const MARCA = 'TiendaPro';
export const DOMINIO_DE_LA_MARCA = 'tiendapro.co';
export const ZONA_DE_LAS_TIENDAS = 'mitiendapro.co';
/** Donde vivieron las tiendas hasta el 22 oct 2026: solo staging tuvo tiendas ahí. */
export const ZONA_ANTERIOR = 'laboratorio-digital.app';
/** A dónde van los reportes de una tienda (HU-T13.6): el Email Routing de la marca. */
export const CORREO_DE_REPORTES = `abuse@${DOMINIO_DE_LA_MARCA}`;
/**
 * Quien manda los correos de producción por Resend (HU-T18.4): `tiendapro.co` está verificado con
 * SPF, DKIM y DMARC. La respuesta va al comercio (`Reply-To`), nunca aquí.
 */
export const REMITENTE_DE_LOS_CORREOS = `avisos@${DOMINIO_DE_LA_MARCA}`;
/** El panel de producción; el de staging vive en workers.dev. */
export const PANEL_DE_PRODUCCION = `https://app.${DOMINIO_DE_LA_MARCA}/`;

/**
 * La dirección nueva de una que una tienda tuvo en la zona anterior: el mismo nombre de un nivel en
 * `mitiendapro.co`. Null si no es de la zona anterior o tiene más de un nivel (P1).
 */
export function direccionNueva(host: string): string | null {
  const sufijo = `.${ZONA_ANTERIOR}`;
  if (!host.endsWith(sufijo)) return null;
  const nombre = host.slice(0, -sufijo.length);
  return /^[a-z0-9]+(-+[a-z0-9]+)*$/.test(nombre) ? `${nombre}.${ZONA_DE_LAS_TIENDAS}` : null;
}
