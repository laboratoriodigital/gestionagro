/**
 * Ver la foto de un monitoreo (HU-E3.11, revisión del dueño, 5 oct 2026: las fotos se guardaban y
 * no se podían ver).
 *
 * - Se carga al tocar «Ver foto», no al dibujar la lista: una página de historial con muchas fotos
 *   no debe leerlas todas.
 * - La foto vive en el teléfono donde se tomó; todavía no sube a la nube (espera HU-E8.4). Un
 *   registro que llegó de otro teléfono la nombra pero no la tiene: se dice así, no se muestra un
 *   cuadro roto (P1).
 */
import type { Registro } from '@ed1/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { type DatosMonitoreoGuardado, leerFoto } from '../almacen/monitoreo.ts';

type Estado =
  | { tipo: 'cerrada' }
  | { tipo: 'cargando' }
  | { tipo: 'lista'; url: string }
  | { tipo: 'no-esta' };

export function FotoDelRegistro(props: { registro: Registro; area: string }) {
  const d = props.registro.datos as Partial<DatosMonitoreoGuardado>;
  const fotoId = props.registro.tipo === 'monitoreo' ? d.foto_id : null;
  const [estado, setEstado] = useState<Estado>({ tipo: 'cerrada' });

  // La URL temporal de la imagen se libera al cerrarla o al salir de la pantalla.
  useEffect(
    () => () => {
      if (estado.tipo === 'lista') URL.revokeObjectURL(estado.url);
    },
    [estado],
  );

  if (!fotoId) return null;

  const abrir = async () => {
    setEstado({ tipo: 'cargando' });
    const foto = await leerFoto(cuaderno(), fotoId);
    setEstado(foto ? { tipo: 'lista', url: URL.createObjectURL(foto.datos) } : { tipo: 'no-esta' });
  };
  const abierta = estado.tipo !== 'cerrada';

  return (
    <div class="foto-del-registro" data-prueba="foto-del-registro">
      <button
        type="button"
        class="secundario"
        aria-expanded={abierta}
        onClick={() => (abierta ? setEstado({ tipo: 'cerrada' }) : void abrir())}
      >
        {abierta ? 'Ocultar foto' : 'Ver foto'}
      </button>
      {estado.tipo === 'cargando' && <p class="ayuda">Abriendo la foto…</p>}
      {estado.tipo === 'lista' && (
        <img
          src={estado.url}
          alt={`Foto de ${d.plaga ?? 'lo observado'} en ${props.area}`}
          data-prueba="foto-del-registro-imagen"
        />
      )}
      {estado.tipo === 'no-esta' && (
        <p class="ayuda" data-prueba="foto-en-otro-telefono">
          Esta foto se tomó en otro teléfono. Por ahora las fotos se quedan en el teléfono donde se
          toman.
        </p>
      )}
    </div>
  );
}
