/**
 * La versión nueva del panel (HU-T8.1, P10): espera a que la persona toque «Actualizar», como el
 * cuaderno. Nunca recarga sola: lo que está escribiendo se queda.
 */

import { registerSW } from 'virtual:pwa-register';
import { useEffect, useState } from 'preact/hooks';

export function AvisoActualizacion() {
  const [aplicar, setAplicar] = useState<((recargar: boolean) => Promise<void>) | null>(null);
  const [hayNueva, setHayNueva] = useState(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const actualizar = registerSW({ immediate: true, onNeedRefresh: () => setHayNueva(true) });
    setAplicar(() => actualizar);
  }, []);
  if (!hayNueva) return null;
  return (
    <div class="aviso-actualizacion" role="status">
      <p>Hay una versión nueva del panel. Lo que estás escribiendo se guarda.</p>
      <button
        class="ed1-boton ed1-boton--secundario"
        type="button"
        onClick={() => void aplicar?.(true)}
      >
        Actualizar
      </button>
    </div>
  );
}
