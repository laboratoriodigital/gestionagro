/**
 * Indicador de la cabecera: cuántos registros están solo en este teléfono (HU-E3.14, CA1).
 * Al tocarlo explica qué significa y qué hacer (CA2, P15: el aviso dice la causa y la acción).
 * Se actualiza solo cuando termina una escritura (escucha `actividad.ts`).
 */
import { useEffect, useState } from 'preact/hooks';
import { escucharActividad } from './actividad.ts';
import { cuaderno } from './almacen/abierto.ts';
import { type ResumenDeDatos, resumenDeDatos, textoIndicador } from './almacen/estado-datos.ts';

export function IndicadorDatos() {
  const [resumen, setResumen] = useState<ResumenDeDatos | null>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const contar = () => void resumenDeDatos(cuaderno()).then(setResumen);
    contar();
    return escucharActividad((a) => {
      if (a.escriturasEnCurso === 0) contar();
    });
  }, []);

  if (!resumen) return null;
  const pendientes = resumen.soloAqui > 0 || resumen.cambiosSoloAqui > 0;

  return (
    <div class="indicador-datos">
      <button
        type="button"
        class={pendientes ? 'indicador pendiente' : 'indicador'}
        aria-expanded={abierto}
        aria-controls="explicacion-datos"
        onClick={() => setAbierto(!abierto)}
        data-prueba="indicador-datos"
      >
        {textoIndicador(resumen)}
      </button>
      {abierto && (
        <div id="explicacion-datos" class="explicacion-datos" data-prueba="explicacion-datos">
          <p>
            Tus registros se guardan primero en este teléfono. Así puedes trabajar sin señal y nada
            se pierde mientras el teléfono esté bien.
          </p>
          {pendientes && (
            <p>
              <strong>Todavía no se envían a la nube.</strong> Si pierdes el teléfono o borras los
              datos del navegador, se pierden. Cuando exista la sincronización, se enviarán solos.
            </p>
          )}
          <p>
            Mientras tanto, haz una copia cada semana con «Exportar». La exportación llega en la
            próxima versión; hasta entonces, no borres los datos del navegador.
          </p>
          {resumen.almacenamientoEnRiesgo && (
            <p class="aviso-ecologico">
              Este navegador no garantizó guardar los datos de forma permanente: si el teléfono se
              queda sin espacio, podría borrarlos. Instala la app desde el menú del navegador y
              libera espacio.
            </p>
          )}
          {resumen.cambiosSoloAqui > 0 && (
            <p class="ayuda">
              Además hay {resumen.cambiosSoloAqui} cambios de configuración (finca, áreas, insumos…)
              en este teléfono.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
