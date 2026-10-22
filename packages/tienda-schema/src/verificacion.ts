/**
 * La verificación de la tienda en Google Search Console (HU-T14.8, TIENDA-3.0 §11.7).
 *
 * Una tienda en un subdominio de la plataforma (`<nombre>.mitiendapro.co`) no se puede
 * verificar como propiedad de **dominio**: Google pide un registro DNS en una zona que el comercio
 * no controla (así falló en la 2.0). Se verifica como propiedad de **prefijo de URL** con el método
 * **etiqueta HTML**: el comercio pega lo que Google le da, se guarda solo el código, y el horno pone
 * la etiqueta en el `<head>` de la portada.
 */

/** Lo que Google usa como código: letras, dígitos, `_` y `-`. Nada que pueda romper el HTML. */
export const CODIGO_DE_GOOGLE = /^[A-Za-z0-9_-]{20,100}$/;

const ETIQUETA = /^<meta\s+([^<>]*?)\s*\/?>$/i;
const ATRIBUTO = /([a-z-]+)\s*=\s*"([^"]*)"/gi;

/**
 * El código, de lo que pegó el comercio: el código solo o la etiqueta `<meta>` entera que muestra
 * Search Console. `null` si no es una etiqueta de verificación de Google con un código válido: se
 * dice, nunca se guarda a medias (P1).
 */
export function codigoDeVerificacionGoogle(pegado: string): string | null {
  const texto = pegado.trim();
  if (CODIGO_DE_GOOGLE.test(texto)) return texto;
  const etiqueta = ETIQUETA.exec(texto);
  if (!etiqueta) return null;
  const atributos = new Map(
    [...(etiqueta[1] ?? '').matchAll(ATRIBUTO)].map((m) => [
      (m[1] ?? '').toLowerCase(),
      m[2] ?? '',
    ]),
  );
  if (atributos.get('name') !== 'google-site-verification') return null;
  const codigo = atributos.get('content') ?? '';
  return CODIGO_DE_GOOGLE.test(codigo) ? codigo : null;
}

/** La etiqueta para el `<head>` de la portada. Lanza con un código inválido: nunca HTML crudo. */
export function etiquetaDeVerificacionGoogle(codigo: string): string {
  if (!CODIGO_DE_GOOGLE.test(codigo)) {
    throw new Error('el código de verificación de Google no es válido');
  }
  return `<meta name="google-site-verification" content="${codigo}">`;
}
