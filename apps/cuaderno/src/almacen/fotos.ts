/**
 * Comprimir una foto en el teléfono (HU-E3.11, CA2; ADR-15, «browser-first»): lado mayor de
 * 1.280 px como máximo y ≤ 150 KB. WebP cuando el navegador sabe codificarlo; si no (Safari),
 * JPEG, que todos saben. Baja la calidad y, si no alcanza, el tamaño, hasta caber. Si ni así cabe,
 * lo dice: nunca guarda una foto más pesada que la cuota.
 */
import { ErrorDeValidacion } from '@ed1/agro-schema';
import configFotos from '../../../../content/agro/cuaderno/fotos.json' with { type: 'json' };
import { TAMANO_MAXIMO_FOTO } from './monitoreo.ts';

const CALIDADES = [0.82, 0.7, 0.58, 0.46];

function comoBlob(lienzo: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((resolver) => lienzo.toBlob(resolver, tipo, calidad));
}

export async function comprimirFoto(
  archivo: Blob,
  { maximo = TAMANO_MAXIMO_FOTO, ladoMaximo = configFotos.lado_maximo_px } = {},
): Promise<{ datos: Blob; tipo: string }> {
  let imagen: ImageBitmap;
  try {
    imagen = await createImageBitmap(archivo);
  } catch {
    throw new ErrorDeValidacion('Foto', [{ campo: 'foto', motivo: 'ese archivo no es una foto' }]);
  }
  const mayor = Math.max(imagen.width, imagen.height);
  for (let lado = Math.min(ladoMaximo, mayor); lado >= 320; lado = Math.round(lado * 0.75)) {
    const escala = lado / mayor;
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(imagen.width * escala));
    lienzo.height = Math.max(1, Math.round(imagen.height * escala));
    lienzo.getContext('2d')?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    for (const calidad of CALIDADES) {
      let blob = await comoBlob(lienzo, 'image/webp', calidad);
      // Un navegador que no codifica WebP devuelve PNG: entonces JPEG.
      if (blob?.type !== 'image/webp') blob = await comoBlob(lienzo, 'image/jpeg', calidad);
      if (blob && blob.size <= maximo) return { datos: blob, tipo: blob.type };
    }
  }
  throw new ErrorDeValidacion('Foto', [
    { campo: 'foto', motivo: 'no se pudo dejar la foto en 150 KB; toma otra más simple' },
  ]);
}
