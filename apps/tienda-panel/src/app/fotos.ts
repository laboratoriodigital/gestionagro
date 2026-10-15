/**
 * HU-T8.3: las fotos se comprimen en el teléfono. El navegador hace las derivadas de 400, 800 y
 * 1600 px (las que alcanza el original) y solo esas salen del teléfono; el original no (CA1).
 *
 * CA2 y CA3: se pide WebP, pero Safari no lo codifica en `canvas.toBlob` y devuelve PNG sin avisar
 * (bitácora tienda3 2). Entonces todas las derivadas salen en JPEG, y se mandan como JPEG: nunca un
 * PNG con nombre `.webp`.
 */
import { ANCHOS_DE_DERIVADAS, type FormatoDeFoto, TIPO_DE_FOTO } from '@ed1/tienda-schema/medios';

/** Pinta el original en `ancho`×`alto` y lo codifica; el navegador puede devolver otro tipo. */
export type Codificar = (
  ancho: number,
  alto: number,
  tipo: string,
  calidad: number,
) => Promise<Blob | null>;

export interface Derivadas {
  formato: FormatoDeFoto;
  derivadas: { ancho: number; alto: number; blob: Blob }[];
}

export class FotoInvalida extends Error {
  override name = 'FotoInvalida';
}

const CALIDAD: Readonly<Record<FormatoDeFoto, number>> = { webp: 0.82, jpeg: 0.85 };

export async function derivar(
  original: { ancho: number; alto: number },
  codificar: Codificar,
): Promise<Derivadas> {
  const anchos = ANCHOS_DE_DERIVADAS.filter((a) => a <= original.ancho);
  if (anchos.length === 0) {
    throw new FotoInvalida(
      `La foto mide ${original.ancho} px de ancho: necesita al menos 400. Elige una más grande.`,
    );
  }
  const medidas = anchos.map((ancho) => ({
    ancho,
    alto: Math.max(1, Math.round((original.alto * ancho) / original.ancho)),
  }));
  const hacer = async (formato: FormatoDeFoto) => {
    const derivadas: Derivadas['derivadas'] = [];
    for (const m of medidas) {
      const blob = await codificar(m.ancho, m.alto, TIPO_DE_FOTO[formato], CALIDAD[formato]);
      // El tipo que devolvió el navegador manda: si no es el pedido, este formato no sirve aquí.
      if (!blob || blob.type !== TIPO_DE_FOTO[formato]) return null;
      derivadas.push({ ...m, blob });
    }
    return derivadas;
  };
  const webp = await hacer('webp');
  if (webp) return { formato: 'webp', derivadas: webp };
  const jpeg = await hacer('jpeg');
  if (jpeg) return { formato: 'jpeg', derivadas: jpeg };
  throw new FotoInvalida(
    'Este teléfono no pudo comprimir la foto. Prueba con otra o desde otro navegador.',
  );
}

/** La huella del original (SHA-256): el nombre de la foto, calculado en el teléfono. */
export async function huellaDe(archivo: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await archivo.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** El formulario de `medios/subir`: los datos de la foto y un archivo por derivada (`d400`…). */
export function formularioDeFoto(datos: {
  producto: string;
  huella: string;
  alt: string;
  original: { ancho: number; alto: number };
  derivadas: Derivadas;
}): FormData {
  const f = new FormData();
  f.set('producto', datos.producto);
  f.set('huella', datos.huella);
  f.set('alt', datos.alt);
  f.set('formato', datos.derivadas.formato);
  f.set('ancho', String(datos.original.ancho));
  f.set('alto', String(datos.original.alto));
  for (const d of datos.derivadas.derivadas) {
    f.set(`d${d.ancho}`, d.blob, `${d.ancho}.${datos.derivadas.formato}`);
  }
  return f;
}

/** En el navegador: lee la foto derecha (EXIF) y la codifica en un `canvas`. */
export async function abrirFoto(
  archivo: Blob,
): Promise<{ ancho: number; alto: number; codificar: Codificar; cerrar: () => void }> {
  let imagen: ImageBitmap;
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    throw new FotoInvalida(
      'No pudimos abrir esa foto. Prueba con una JPG, PNG o HEIC del teléfono.',
    );
  }
  return {
    ancho: imagen.width,
    alto: imagen.height,
    cerrar: () => imagen.close(),
    codificar: (ancho, alto, tipo, calidad) =>
      new Promise((listo) => {
        const lienzo = document.createElement('canvas');
        lienzo.width = ancho;
        lienzo.height = alto;
        const ctx = lienzo.getContext('2d');
        if (!ctx) return listo(null);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(imagen, 0, 0, ancho, alto);
        lienzo.toBlob(listo, tipo, calidad);
      }),
  };
}
