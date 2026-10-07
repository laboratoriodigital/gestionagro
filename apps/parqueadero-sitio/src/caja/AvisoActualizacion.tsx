/**
 * La versión nueva espera (HU-Q3.1 CA3): con un formulario abierto o una impresión en curso, la
 * caja no se recarga; avisa y ofrece actualizar cuando el cajero termine.
 */
import { useEffect, useState } from 'preact/hooks';
import { Workbox } from 'workbox-window';
import { actividadActual, decidirActualizacion, escucharActividad } from './actividad.ts';

export function AvisoActualizacion() {
  const [wb, setWb] = useState<Workbox | null>(null);
  const [hayNueva, setHayNueva] = useState(false);
  const [actividad, setActividad] = useState(actividadActual());

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const w = new Workbox('/caja/sw.js', { scope: '/caja/' });
    w.addEventListener('waiting', () => setHayNueva(true));
    void w.register();
    setWb(w);
  }, []);

  useEffect(() => escucharActividad(setActividad), []);

  const decision = decidirActualizacion(hayNueva, actividad);
  if (decision === 'nada') return null;

  const actualizar = () => {
    if (!wb) return;
    wb.addEventListener('controlling', () => window.location.reload());
    wb.messageSkipWaiting();
  };

  return (
    <div class="aviso-actualizacion" role="status" data-prueba="aviso-actualizacion">
      {decision === 'esperar' ? (
        <p>
          Hay una versión nueva de la caja. Se podrá actualizar al terminar lo que está haciendo.
        </p>
      ) : (
        <>
          <p>Hay una versión nueva de la caja. Lo registrado se conserva.</p>
          <button type="button" class="boton" onClick={actualizar}>
            Actualizar
          </button>
        </>
      )}
    </div>
  );
}
