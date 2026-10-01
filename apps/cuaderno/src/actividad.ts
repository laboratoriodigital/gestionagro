/**
 * Actividad en curso que una actualización no puede interrumpir (HU-E3.1, CA2):
 * formularios abiertos y escrituras a IndexedDB sin terminar.
 *
 * «Operaciones pendientes» aquí son las que están **en curso**, no la cola de salida (outbox):
 * esa cola vive en IndexedDB y sobrevive a la actualización. Si contara, antes de que exista la
 * sincronización (E5) la app no podría actualizarse nunca.
 */

export interface Actividad {
  formulariosAbiertos: number;
  escriturasEnCurso: number;
}

type Oyente = (a: Actividad) => void;

const estado: Actividad = { formulariosAbiertos: 0, escriturasEnCurso: 0 };
const oyentes = new Set<Oyente>();

const avisar = () => {
  for (const o of oyentes) o({ ...estado });
};

export function actividadActual(): Actividad {
  return { ...estado };
}

export function escucharActividad(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/** Lo llama cada formulario al abrirse; la función devuelta, al cerrarse. */
export function abrirFormulario(): () => void {
  estado.formulariosAbiertos++;
  avisar();
  let cerrado = false;
  return () => {
    if (cerrado) return;
    cerrado = true;
    estado.formulariosAbiertos--;
    avisar();
  };
}

/** Envuelve una escritura para que cuente como «en curso» hasta terminar, bien o mal. */
export async function conEscritura<T>(trabajo: () => Promise<T>): Promise<T> {
  estado.escriturasEnCurso++;
  avisar();
  try {
    return await trabajo();
  } finally {
    estado.escriturasEnCurso--;
    avisar();
  }
}

export type DecisionDeActualizacion = 'nada' | 'esperar' | 'ofrecer';

/**
 * Nunca «recargar»: como mucho se ofrece el botón (ARQUITECTURA §5.3, regla 3).
 * Con actividad en curso solo se avisa; el botón aparece cuando termina.
 */
export function decidirActualizacion(
  hayVersionNueva: boolean,
  a: Actividad,
): DecisionDeActualizacion {
  if (!hayVersionNueva) return 'nada';
  return a.formulariosAbiertos > 0 || a.escriturasEnCurso > 0 ? 'esperar' : 'ofrecer';
}
