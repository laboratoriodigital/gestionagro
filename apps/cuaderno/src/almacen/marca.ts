/**
 * El logo de la finca para la etiqueta QR (revisión del dueño, 3 oct 2026), del plan Finca en
 * adelante (interruptor `marca_en_etiqueta`). Vive en este teléfono, como las fotos: no viaja a la
 * nube todavía, así que cada teléfono que imprime etiquetas lo pone una vez.
 *
 * Se guarda achicado a 240 px por lado como imagen PNG (unos KB): una etiqueta de 5 × 5 cm no
 * necesita más, y un logo pesado no debe llenar el teléfono.
 */
import type { CuadernoDb } from './db.ts';

const CLAVE = 'logo-finca';
export const LADO_MAXIMO_LOGO = 240;
/** Un logo más pesado que esto, ya achicado, es una foto: se rechaza. */
export const TAMANO_MAXIMO_LOGO = 150 * 1024;

export async function leerLogo(db: CuadernoDb): Promise<string | null> {
  const fila = await db.meta.get(CLAVE);
  const valor = fila?.valor as { dataUrl?: unknown } | undefined;
  return typeof valor?.dataUrl === 'string' ? valor.dataUrl : null;
}

export async function guardarLogo(db: CuadernoDb, dataUrl: string): Promise<void> {
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) {
    throw new Error('El logo debe ser una imagen PNG, JPG o WebP.');
  }
  if (dataUrl.length > TAMANO_MAXIMO_LOGO * 1.4) {
    throw new Error('El logo pesa demasiado: usa una imagen más sencilla.');
  }
  await db.meta.put({ clave: CLAVE, valor: { dataUrl }, actualizado: new Date().toISOString() });
}

export async function quitarLogo(db: CuadernoDb): Promise<void> {
  await db.meta.delete(CLAVE);
}

/** Achica la imagen elegida a 240 px por lado, en el teléfono (browser-first). */
export async function prepararLogo(archivo: Blob): Promise<string> {
  const mapa = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAXIMO_LOGO / Math.max(mapa.width, mapa.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.max(1, Math.round(mapa.width * escala));
  lienzo.height = Math.max(1, Math.round(mapa.height * escala));
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no puede preparar la imagen.');
  ctx.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
  return lienzo.toDataURL('image/png');
}
