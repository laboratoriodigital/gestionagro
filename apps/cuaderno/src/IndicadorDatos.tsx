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
  const conRechazos = resumen.rechazados > 0;

  return (
    <div class="indicador-datos">
      <button
        type="button"
        class={pendientes || conRechazos ? 'indicador pendiente' : 'indicador'}
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
          {pendientes &&
            (resumen.vinculada ? (
              <p>Tu finca está en la nube: lo pendiente se envía solo cuando hay señal.</p>
            ) : (
              <p>
                <strong>Todavía no se envían a la nube.</strong> Si pierdes el teléfono o borras los
                datos del navegador, se pierden. En «Cuenta» puedes subir tu finca a la nube.
              </p>
            ))}
          {resumen.rechazados > 0 && (
            <p class="error" data-prueba="datos-rechazados">
              {resumen.rechazados === 1
                ? '1 dato no fue aceptado por la nube.'
                : `${resumen.rechazados} datos no fueron aceptados por la nube.`}{' '}
              Siguen en este teléfono; en «Cuenta» ves por qué.
            </p>
          )}
          {!resumen.vinculada && (
            <p>
              Mientras tanto, haz una copia cada semana en «Respaldo» y guárdala fuera del teléfono.
            </p>
          )}
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
