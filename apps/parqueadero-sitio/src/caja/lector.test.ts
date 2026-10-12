import { describe, expect, it } from 'vitest';
import { type ConstructorDeDetector, detectorQueLeeQr } from './lector.ts';

/** Un `BarcodeDetector` falso que dice leer `formatos`. */
const detector = (formatos: string[] | Error): ConstructorDeDetector =>
  Object.assign(
    class {
      detect = async () => [];
    },
    {
      getSupportedFormats: () =>
        formatos instanceof Error ? Promise.reject(formatos) : Promise.resolve(formatos),
    },
  );

describe('qué lee los QR (bitácora parqueadero 19)', () => {
  it('el del navegador, si dice que lee QR', async () => {
    const D = detector(['ean_13', 'qr_code']);
    expect(await detectorQueLeeQr(D)).toBe(D);
  });

  it('jsQR en un teléfono sin los servicios de Google: el detector existe y no lee nada', async () => {
    expect(await detectorQueLeeQr(detector([]))).toBeNull();
    expect(await detectorQueLeeQr(detector(new Error('sin servicios')))).toBeNull();
  });

  it('jsQR si el navegador no tiene detector', async () => {
    expect(await detectorQueLeeQr(undefined)).toBeNull();
  });
});
