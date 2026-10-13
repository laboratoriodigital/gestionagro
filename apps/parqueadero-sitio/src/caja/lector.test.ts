import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type ConstructorDeDetector,
  detectorQueLeeQr,
  FRACCION_DEL_CUADRO,
  recorteCentral,
} from './lector.ts';

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

describe('el cuadro guía que lee el escáner (bitácora parqueadero 39)', () => {
  it('es el 60 % central del lado menor, el mismo que la pantalla muestra', () => {
    expect(FRACCION_DEL_CUADRO).toBe(0.6);
    expect(recorteCentral(1920, 1080)).toEqual({ x: 636, y: 216, lado: 648 });
    expect(recorteCentral(1080, 1920)).toEqual({ x: 216, y: 636, lado: 648 });
  });

  it('en la pantalla, el cuadro deja 20 % a cada lado: lo que el cajero ve es lo que se lee', () => {
    const css = readFileSync(join(import.meta.dirname, 'estilos.css'), 'utf8');
    const guia = css.slice(css.indexOf('.guia {'), css.indexOf('}', css.indexOf('.guia {')));
    expect(guia).toContain(`inset: ${((1 - FRACCION_DEL_CUADRO) / 2) * 100}%;`);
  });
});
