/**
 * «Escanear» (HU-Q3.4 CA2): la cámara lee el QR del papel (forma corta) o el del teléfono del
 * conductor (forma completa) y abre la salida de esa estadía. Usa `BarcodeDetector` donde el
 * navegador lo tiene (Chrome en Android) y jsQR (Apache-2.0) donde no, como Chrome en Windows;
 * jsQR se carga solo entonces. Sin cámara, se escribe la placa en el inicio.
 *
 * En un teléfono sin los servicios de Google (los Huawei recientes), `BarcodeDetector` existe pero no
 * lee ningún formato: se pregunta antes con `getSupportedFormats` (bitácora parqueadero 19).
 */

import { ORIGEN_DEL_RECIBO } from '@ed1/parqueadero-recibos';
import { useEffect, useRef, useState } from 'preact/hooks';
import { buscarPorLectura } from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';
import { origenDelRecibo } from './entorno.ts';
import { type ConstructorDeDetector, detectorQueLeeQr } from './lector.ts';

type Lector = (video: HTMLVideoElement) => Promise<string | null>;
type LeerQr = (datos: Uint8ClampedArray, ancho: number, alto: number) => { data: string } | null;

/** Lo más ancho que se le pasa a jsQR: una imagen más grande no lee mejor y tarda más. */
const ANCHO_PARA_JSQR = 800;

async function crearLector(): Promise<Lector> {
  const Detector = await detectorQueLeeQr(
    (globalThis as { BarcodeDetector?: ConstructorDeDetector }).BarcodeDetector,
  );
  if (Detector) {
    const d = new Detector({ formats: ['qr_code'] });
    return async (video) => (await d.detect(video))[0]?.rawValue ?? null;
  }
  // jsQR es CommonJS: según quien lo empaque, la función llega en `default` o en `default.default`.
  const m: { default: unknown } = await import('jsqr');
  const jsQR = (
    typeof m.default === 'function' ? m.default : (m.default as { default: unknown }).default
  ) as LeerQr;
  const lienzo = document.createElement('canvas');
  const c = lienzo.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    if (!c || video.videoWidth === 0) return null;
    const escala = Math.min(1, ANCHO_PARA_JSQR / video.videoWidth);
    lienzo.width = Math.round(video.videoWidth * escala);
    lienzo.height = Math.round(video.videoHeight * escala);
    c.drawImage(video, 0, 0, lienzo.width, lienzo.height);
    const img = c.getImageData(0, 0, lienzo.width, lienzo.height);
    return jsQR(img.data, img.width, img.height)?.data ?? null;
  };
}

interface Props {
  readonly db: BaseDeLaCaja;
  readonly alEncontrar: (estadiaId: string) => void;
  readonly alVolver: () => void;
}

export function Escanear({ db, alEncontrar, alVolver }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [aviso, setAviso] = useState('Apunte la cámara al QR del recibo.');
  const [sinCamara, setSinCamara] = useState(false);

  useEffect(() => {
    let vivo = true;
    let flujo: MediaStream | undefined;
    let ultimo = '';
    void (async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({
          // Más resolución que la de fábrica (640×480): el QR del papel mide unos 25 mm.
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        setSinCamara(true);
        setAviso('No hay cámara o no dio permiso. Busque la placa en el inicio.');
        return;
      }
      const v = video.current;
      if (!vivo || !v) return;
      v.srcObject = flujo;
      try {
        await v.play();
      } catch (e) {
        setAviso(`La cámara no arrancó (${String(e)}). Busque la placa en el inicio.`);
        return;
      }
      const leer = await crearLector();
      while (vivo) {
        const texto = await leer(v).catch(() => null);
        if (texto && texto !== ultimo) {
          ultimo = texto;
          try {
            const h = await buscarPorLectura(db, texto, [
              ORIGEN_DEL_RECIBO,
              origenDelRecibo(location),
            ]);
            if (h.encontrada) {
              alEncontrar(h.estadiaId);
              return;
            }
            setAviso(h.motivo);
          } catch (e) {
            // Un QR raro no apaga el escáner: lo dice y sigue mirando (P15).
            setAviso(`No se pudo leer este QR: ${String(e)}`);
          }
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    })();
    return () => {
      vivo = false;
      for (const pista of flujo?.getTracks() ?? []) pista.stop();
    };
  }, []);

  return (
    <section class="tarjeta" data-prueba="escanear">
      <h1>Escanear recibo</h1>
      {!sinCamara && (
        <video ref={video} class="camara" muted playsInline aria-label="Lo que ve la cámara" />
      )}
      <p aria-live="polite" data-prueba="aviso-escaner">
        {aviso}
      </p>
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        Volver al inicio
      </button>
    </section>
  );
}
