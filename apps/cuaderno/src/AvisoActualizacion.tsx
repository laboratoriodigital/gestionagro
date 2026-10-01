/**
 * Aviso de versión nueva (HU-E3.1, CA2). Registra el service worker con `registerType: prompt`:
 * la versión nueva queda esperando y solo se aplica cuando la persona toca «Actualizar».
 *
 * También dice cuando la celda pidió actualizar porque esta versión ya es vieja (HU-E5.5, CA2):
 * lo registrado se envía igual, el aviso es para que la persona actualice cuando pueda.
 */

import { registerSW } from 'virtual:pwa-register';
import { useEffect, useState } from 'preact/hooks';
import { actividadActual, decidirActualizacion, escucharActividad } from './actividad.ts';
import { escucharSincronizacion } from './sincronizacion.ts';

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

  const [pedido, setPedido] = useState<string | null>(null);
  useEffect(
    () =>
      escucharSincronizacion((e) => {
        if (e.tipo === 'resultado' && e.resultado.estado === 'al-dia') {
          setPedido(e.resultado.actualizar ?? null);
        }
      }),
    [],
  );

  const decision = decidirActualizacion(hayVersionNueva, actividad);
  if (decision === 'nada' && !pedido) return null;

  return (
    <div class="aviso-actualizacion" role="status" data-prueba="aviso-actualizacion">
      {pedido && <p data-prueba="pedido-actualizar">{pedido}</p>}
      {decision === 'nada' ? (
        <p>Para actualizar, abre el cuaderno con señal: la versión nueva se descarga sola.</p>
      ) : decision === 'esperar' ? (
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
