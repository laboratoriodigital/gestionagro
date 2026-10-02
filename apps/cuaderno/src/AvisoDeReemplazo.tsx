/**
 * Aviso bajo la cabecera cuando un cambio de este teléfono perdió un conflicto en la nube
 * (HU-E5.4, CA2). Se revisa al terminar cada sincronización. «Volver a poner mi cambio» lo escribe
 * como una edición nueva; «Dejar el de la nube» cierra el aviso. Ninguna versión se pierde.
 */
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from './almacen/abierto.ts';
import {
  type AvisoParaMostrar,
  avisosDeReemplazo,
  dejarComoEsta,
  reaplicar,
} from './almacen/reemplazos.ts';
import { escucharSincronizacion, sincronizarAhora } from './sincronizacion.ts';

export function AvisoDeReemplazo() {
  const [avisos, setAvisos] = useState<AvisoParaMostrar[]>([]);
  const cargar = () => void avisosDeReemplazo(cuaderno()).then(setAvisos);
  useEffect(() => {
    cargar();
    return escucharSincronizacion((e) => {
      if (e.tipo === 'resultado') cargar();
    });
  }, []);

  if (avisos.length === 0) return null;
  return (
    <div class="aviso-actualizacion" role="status" data-prueba="aviso-reemplazo">
      {avisos.map(({ aviso, texto }) => (
        <div key={aviso.id}>
          <p>{texto}</p>
          <div class="acciones">
            <button
              type="button"
              class="secundario"
              onClick={() => void dejarComoEsta(cuaderno(), aviso.id).then(cargar)}
            >
              Dejar el de la nube
            </button>
            <button
              type="button"
              onClick={() =>
                void reaplicar(cuaderno(), aviso.id).then(() => {
                  cargar();
                  void sincronizarAhora();
                })
              }
            >
              Volver a poner mi cambio
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
