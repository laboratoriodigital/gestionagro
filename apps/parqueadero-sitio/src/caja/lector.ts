/**
 * Qué lee los QR en este teléfono (HU-Q3.4 CA2). En un teléfono sin los servicios de Google (los
 * Huawei recientes), `BarcodeDetector` existe pero no lee ningún formato: se pregunta antes y, si
 * no lee QR, el escáner usa jsQR (bitácora parqueadero 19).
 */
export interface DetectorDeCodigos {
  detect(fuente: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
export type ConstructorDeDetector = (new (o: {
  formats: string[];
}) => DetectorDeCodigos) & {
  getSupportedFormats?: () => Promise<string[]>;
};

/** El detector del navegador, solo si dice que lee QR; si no, `null` y se usa jsQR. */
export async function detectorQueLeeQr(
  Detector: ConstructorDeDetector | undefined,
): Promise<ConstructorDeDetector | null> {
  if (!Detector?.getSupportedFormats) return null;
  const formatos = await Detector.getSupportedFormats().catch(() => [] as string[]);
  return formatos.includes('qr_code') ? Detector : null;
}

/** Qué parte del lado menor de la imagen ocupa el cuadro guía de la pantalla (`.guia`, 60 %). */
export const FRACCION_DEL_CUADRO = 0.6;

/**
 * El cuadrado central de la imagen de la cámara, donde la caja pide poner el QR. La pantalla
 * muestra el cuadrado central del video (`object-fit: cover`) y el cuadro guía es su 60 %: leer
 * solo esa parte hace que un QR de papel pequeño pese más en la imagen que se le da al detector.
 */
export function recorteCentral(
  ancho: number,
  alto: number,
  fraccion = FRACCION_DEL_CUADRO,
): { x: number; y: number; lado: number } {
  const lado = Math.round(Math.min(ancho, alto) * fraccion);
  return { x: Math.round((ancho - lado) / 2), y: Math.round((alto - lado) / 2), lado };
}
