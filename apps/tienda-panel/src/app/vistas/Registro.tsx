/**
 * HU-T10.6: el registro, quién hizo qué. En frases, de la más nueva a la más vieja, con la hora de
 * Bogotá; de a 50, con «Ver más» (CA1). Lo que es personal o una llave nunca llega aquí: la API
 * lo guarda como huella (CA2).
 */
import type { EstadoDeContenido } from '@ed1/ui/v2/componentes';
import { Contenido } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';

export interface FilaDeRegistro {
  id: number;
  instante: string;
  frase: string;
}

const HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** «15 oct., 10:42 a. m.», en la hora de Bogotá aunque el teléfono esté en otra. */
export const horaDeBogota = (instante: string) => HORA.format(new Date(instante));

export function Registro({
  conexion,
  alVencer,
}: {
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  const [estado, setEstado] = useState<EstadoDeContenido<FilaDeRegistro>>({ tipo: 'cargando' });
  const [siguiente, setSiguiente] = useState<number | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);

  const cargar = useCallback(
    async (desde: number | null) => {
      const r = await pedirAlPanel<{ filas: FilaDeRegistro[]; siguiente: number | null }>(
        conexion,
        desde === null ? 'registro' : `registro?cursor=${desde}`,
      );
      if (r.tipo === 'sin-sesion') {
        alVencer(r.motivo);
        return;
      }
      if (r.tipo !== 'ok') {
        if (desde === null) setEstado({ tipo: 'error', causa: r.motivo });
        return;
      }
      setSiguiente(r.datos.siguiente);
      setEstado((antes) => ({
        tipo: 'listo',
        elementos: [
          ...(desde !== null && antes.tipo === 'listo' ? antes.elementos : []),
          ...r.datos.filas,
        ],
      }));
    },
    [conexion, alVencer],
  );

  useEffect(() => {
    void cargar(null);
  }, [cargar]);

  const verMas = async () => {
    setCargandoMas(true);
    await cargar(siguiente);
    setCargandoMas(false);
  };

  return (
    <main class="contenido">
      <h1>Registro</h1>
      <p class="nota">Lo que tu equipo cambió en la tienda, lo más nuevo primero.</p>
      <div class="registro">
        <Contenido
          titulo="Registro"
          estado={
            estado.tipo === 'error'
              ? {
                  ...estado,
                  reintentar: (
                    <button
                      class="ed1-boton ed1-boton--secundario"
                      type="button"
                      onClick={() => void cargar(null)}
                    >
                      Intentar otra vez
                    </button>
                  ),
                }
              : estado
          }
          vacio={{ porque: 'Todavía nadie ha cambiado nada desde el panel.' }}
          elemento={(f: FilaDeRegistro) => (
            <p class="registro__fila">
              <span class="registro__hora cifra">{horaDeBogota(f.instante)}</span>
              <span>{f.frase}</span>
            </p>
          )}
        />
      </div>
      {siguiente !== null ? (
        <button
          class="ed1-boton ed1-boton--secundario"
          type="button"
          disabled={cargandoMas}
          aria-busy={cargandoMas ? 'true' : undefined}
          onClick={() => void verMas()}
        >
          Ver más
        </button>
      ) : null}
    </main>
  );
}
