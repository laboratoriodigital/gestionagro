/**
 * La foto del estado del vehículo, comprimida en el navegador (PARQUEADERO §5.5, ADR-15): WebP
 * de unos 100 KB, o JPEG donde el navegador no produce WebP. Safari devuelve PNG cuando se le
 * pide WebP (bitácora tienda3 2): se mira el tipo real del resultado, nunca el pedido (HU-Q3.3 CA4).
 */

export type FormatoDeFoto = 'image/webp' | 'image/jpeg';

/** Lo mínimo de un lienzo: el de verdad en el navegador, uno falso en las pruebas. */
export interface Lienzo {
  toBlob(alTerminar: (b: Blob | null) => void, tipo: string, calidad: number): void;
}

const aBlob = (lienzo: Lienzo, tipo: string, calidad: number) =>
  new Promise<Blob>((resolver, rechazar) =>
    lienzo.toBlob(
      (b) => (b ? resolver(b) : rechazar(new Error('No se pudo comprimir'))),
      tipo,
      calidad,
    ),
  );

const OBJETIVO = 120_000;

/**
 * Comprime lo que ya está dibujado en el lienzo. Prueba WebP; si el navegador da otra cosa, JPEG.
 * Baja la calidad hasta quedar cerca de 100 KB.
 */
export async function comprimir(lienzo: Lienzo): Promise<{ tipo: FormatoDeFoto; datos: Blob }> {
  let ultimo: { tipo: FormatoDeFoto; datos: Blob } | undefined;
  for (const calidad of [0.7, 0.5, 0.35]) {
    const webp = await aBlob(lienzo, 'image/webp', calidad);
    const datos = webp.type === 'image/webp' ? webp : await aBlob(lienzo, 'image/jpeg', calidad);
    const tipo: FormatoDeFoto = datos.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    if (datos.type !== tipo) throw new Error(`El navegador dio ${datos.type} y no ${tipo}`);
    ultimo = { tipo, datos };
    if (datos.size <= OBJETIVO) break;
  }
  if (!ultimo) throw new Error('No se pudo comprimir');
  return ultimo;
}

/** De la cámara al formato guardado: lado mayor de 1280 px, sin metadatos. */
export async function comprimirFoto(archivo: Blob): Promise<{ tipo: FormatoDeFoto; datos: Blob }> {
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, 1280 / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext('2d')?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();
  return comprimir(lienzo);
}
