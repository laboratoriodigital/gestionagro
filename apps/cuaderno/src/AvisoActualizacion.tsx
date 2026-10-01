/**
 * Aviso de versión nueva (HU-E3.1, CA2). Registra el service worker con `registerType: prompt`:
 * la versión nueva queda esperando y solo se aplica cuando la persona toca «Actualizar».
 */

import { registerSW } from 'virtual:pwa-register';
import { useEffect, useState } from 'preact/hooks';
import { actividadActual, decidirActualizacion, escucharActividad } from './actividad.ts';

export function AvisoActualizacion() {
  const [hayVersionNueva, setHayVersionNueva] = useState(false);
  const [actividad, setActividad] = useState(actividadActual());
  const [aplicar, setAplicar] = useState<((recargar: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const actualizar = registerSW({
      immediate: true,
      onNeedRefresh: () => setHayVersionNueva(true),
    });
    setAplicar(() => actualizar);
  }, []);

  useEffect(() => escucharActividad(setActividad), []);

  const decision = decidirActualizacion(hayVersionNueva, actividad);
  if (decision === 'nada') return null;

  return (
    <div class="aviso-actualizacion" role="status" data-prueba="aviso-actualizacion">
      {decision === 'esperar' ? (
        <p>Hay una actualización; podrás aplicarla cuando termines lo que estás registrando.</p>
      ) : (
        <>
          <p>Hay una versión nueva del cuaderno. Tus registros se conservan.</p>
          <button type="button" onClick={() => void aplicar?.(true)}>
            Actualizar ahora
          </button>
        </>
      )}
    </div>
  );
}
