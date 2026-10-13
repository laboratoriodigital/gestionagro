/**
 * «Escanear» (HU-Q3.4 CA2): la cámara lee el QR del papel (forma corta) o el del teléfono del
 * conductor (forma completa) y abre la salida de esa estadía. Usa `BarcodeDetector` donde el
 * navegador lo tiene (Chrome en Android) y jsQR (Apache-2.0) donde no, como Chrome en Windows;
 * jsQR se carga solo entonces. Sin cámara, se escribe la placa en el inicio.
 *
 * En un teléfono sin los servicios de Google (los Huawei recientes), `BarcodeDetector` existe pero no
 * lee ningún formato: se pregunta antes con `getSupportedFormats` (bitácora parqueadero 19).
 *
 * Más sensible (bitácora parqueadero 39, en la puesta en marcha): la cámara a 1920×1080 con enfoque
 * continuo si lo tiene, una mirada cada 120 ms que alterna la imagen entera y el cuadro guía del
 * centro (donde un QR de papel pequeño pesa más), y la linterna si el teléfono la tiene.
 */

import { ORIGEN_DEL_RECIBO } from '@ed1/parqueadero-recibos';
import { useEffect, useRef, useState } from 'preact/hooks';
import { buscarPorLectura } from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';
import { origenDelRecibo } from './entorno.ts';
import { type ConstructorDeDetector, detectorQueLeeQr, recorteCentral } from './lector.ts';

/** Lee el QR de lo que ve la cámara: la imagen entera o solo el cuadro guía del centro. */
type Lector = (video: HTMLVideoElement, soloElCuadro: boolean) => Promise<string | null>;
type LeerQr = (
  datos: Uint8ClampedArray,
  ancho: number,
  alto: number,
  opciones?: { inversionAttempts?: 'attemptBoth' | 'dontInvert' },
) => { data: string } | null;

/** Lo más ancho que se le pasa a jsQR: una imagen más grande no lee mejor y tarda más. */
const ANCHO_PARA_JSQR = 800;
/** Entre una mirada y la siguiente: rápido para el cajero, sin calentar el teléfono. */
const ESPERA_MS = 120;

async function crearLector(): Promise<Lector> {
  const Detector = await detectorQueLeeQr(
    (globalThis as { BarcodeDetector?: ConstructorDeDetector }).BarcodeDetector,
  );
  const lienzo = document.createElement('canvas');
  const c = lienzo.getContext('2d', { willReadFrequently: true });
  /** Pasa al lienzo la imagen entera o el cuadro del centro, de a lo más `ancho` puntos. */
  const dibujar = (video: HTMLVideoElement, soloElCuadro: boolean, ancho: number) => {
    if (!c || video.videoWidth === 0) return false;
    const r = soloElCuadro
      ? recorteCentral(video.videoWidth, video.videoHeight)
      : { x: 0, y: 0, lado: 0 };
    const w = soloElCuadro ? r.lado : video.videoWidth;
    const h = soloElCuadro ? r.lado : video.videoHeight;
    const escala = Math.min(1, ancho / w);
    lienzo.width = Math.round(w * escala);
    lienzo.height = Math.round(h * escala);
    c.drawImage(video, r.x, r.y, w, h, 0, 0, lienzo.width, lienzo.height);
    return true;
  };
  if (Detector) {
    const d = new Detector({ formats: ['qr_code'] });
    return async (video, soloElCuadro) => {
      if (!soloElCuadro) return (await d.detect(video))[0]?.rawValue ?? null;
      return dibujar(video, true, Number.POSITIVE_INFINITY)
        ? ((await d.detect(lienzo))[0]?.rawValue ?? null)
        : null;
    };
  }
  // jsQR es CommonJS: según quien lo empaque, la función llega en `default` o en `default.default`.
  const m: { default: unknown } = await import('jsqr');
  const jsQR = (
    typeof m.default === 'function' ? m.default : (m.default as { default: unknown }).default
  ) as LeerQr;
  return async (video, soloElCuadro) => {
    if (!c || !dibujar(video, soloElCuadro, ANCHO_PARA_JSQR)) return null;
    const img = c.getImageData(0, 0, lienzo.width, lienzo.height);
    // El papel térmico gastado a veces sale más claro que el fondo: se prueba también invertido.
    return (
      jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null
    );
  };
}

/** Lo que el teléfono deja pedirle a la cámara, más allá de lo que tipa el navegador. */
type Capacidades = MediaTrackCapabilities & { focusMode?: string[]; torch?: boolean };

interface Props {
  readonly db: BaseDeLaCaja;
  readonly alEncontrar: (estadiaId: string) => void;
  readonly alVolver: () => void;
}

export function Escanear({ db, alEncontrar, alVolver }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [aviso, setAviso] = useState('Ponga el QR del recibo dentro del cuadro, a unos 15 cm.');
  const [sinCamara, setSinCamara] = useState(false);
  const [linterna, setLinterna] = useState<MediaStreamTrack | null>(null);
  const [encendida, setEncendida] = useState(false);

  useEffect(() => {
    let vivo = true;
    let flujo: MediaStream | undefined;
    let ultimo = '';
    void (async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({
          // Más resolución que la de fábrica (640×480): el QR del papel mide unos 3 cm.
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
      } catch {
        setSinCamara(true);
        setAviso('No hay cámara o no dio permiso. Busque la placa en el inicio.');
        return;
      }
      const pista = flujo.getVideoTracks()[0];
      const capacidades = pista?.getCapabilities?.() as Capacidades | undefined;
      if (pista && capacidades?.focusMode?.includes('continuous')) {
        await pista
          .applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
          .catch(() => undefined);
      }
      if (pista && capacidades?.torch) setLinterna(pista);
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
      let soloElCuadro = false;
      while (vivo) {
        soloElCuadro = !soloElCuadro;
        const texto = await leer(v, soloElCuadro).catch(() => null);
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
        await new Promise((r) => setTimeout(r, ESPERA_MS));
      }
    })();
    return () => {
      vivo = false;
      for (const pista of flujo?.getTracks() ?? []) pista.stop();
    };
  }, []);

  async function alternarLinterna() {
    if (!linterna) return;
    const luz = !encendida;
    await linterna
      .applyConstraints({ advanced: [{ torch: luz } as MediaTrackConstraintSet] })
      .then(() => setEncendida(luz))
      .catch(() => setAviso('La linterna no prendió. Acerque el recibo a una luz.'));
  }

  return (
    <section class="tarjeta" data-prueba="escanear">
      <h1>Escanear recibo</h1>
      {!sinCamara && (
        <div class="visor">
          <video ref={video} class="camara" muted playsInline aria-label="Lo que ve la cámara" />
          <div class="guia" aria-hidden="true" />
        </div>
      )}
      <p aria-live="polite" data-prueba="aviso-escaner">
        {aviso}
      </p>
      {linterna && (
        <button
          type="button"
          class="boton boton-secundario"
          aria-pressed={encendida}
          onClick={() => void alternarLinterna()}
        >
          {encendida ? 'Apagar la linterna' : 'Prender la linterna'}
        </button>
      )}
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        Volver al inicio
      </button>
    </section>
  );
}
