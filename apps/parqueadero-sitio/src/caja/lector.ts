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
