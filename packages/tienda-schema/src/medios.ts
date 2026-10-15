/**
 * Las fotos de un producto (HU-T8.3, TIENDA-3.0 §11.5). El navegador genera las derivadas y sube
 * solo esas; el original no sale del teléfono. Una sola fuente para el panel, la API y el horno (P2).
 *
 * CA2: Safari no codifica WebP en `canvas.toBlob` y devuelve PNG (bitácora tienda3 2). Entonces las
 * derivadas salen en JPEG, y la ruta (`<org>/<huella>/<ancho>.jpeg`) y `medio.formatos` lo dicen.
 */

/** Los anchos de las derivadas. Los que no alcanza el original no se generan. */
export const ANCHOS_DE_DERIVADAS = [400, 800, 1600] as const;
export const FORMATOS_DE_FOTO = ['webp', 'jpeg'] as const;
export type FormatoDeFoto = (typeof FORMATOS_DE_FOTO)[number];
export const TIPO_DE_FOTO: Readonly<Record<FormatoDeFoto, string>> = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
};
/** Una derivada de 1600 px bien comprimida pesa unos cientos de KB; esto es el techo. */
export const BYTES_POR_DERIVADA = 2_000_000;
export const FOTOS_POR_PRODUCTO = 12;

/**
 * `medio.formatos`: `{"webp": {"400": bytes, …}}` o `{"jpeg": {…}}`. Las filas de antes de HU-T8.3
 * (`{"400": bytes}`) eran WebP.
 */
export function leerFormatos(texto: string): { formato: FormatoDeFoto; anchos: number[] } {
  let v: unknown;
  try {
    v = JSON.parse(texto);
  } catch {
    return { formato: 'webp', anchos: [] };
  }
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const formato = FORMATOS_DE_FOTO.find((f) => o[f] && typeof o[f] === 'object');
  const anchos = Object.keys(formato ? (o[formato] as object) : o)
    .map(Number)
    .filter((a) => Number.isInteger(a) && a > 0)
    .sort((a, b) => a - b);
  return { formato: formato ?? 'webp', anchos };
}

export const escribirFormatos = (formato: FormatoDeFoto, bytes: Readonly<Record<number, number>>) =>
  JSON.stringify({ [formato]: bytes });

/**
 * CA3: los primeros bytes dicen qué es el archivo, diga lo que diga su nombre o su tipo. Un PNG
 * con nombre `.webp` no pasa.
 */
export function esDelFormato(bytes: Uint8Array, formato: FormatoDeFoto): boolean {
  if (formato === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const texto = (i: number, n: number) => String.fromCharCode(...bytes.subarray(i, i + n));
  return bytes.length >= 12 && texto(0, 4) === 'RIFF' && texto(8, 4) === 'WEBP';
}
