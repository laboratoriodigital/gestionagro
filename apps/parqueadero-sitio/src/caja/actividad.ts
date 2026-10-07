/**
 * Lo que una versión nueva no puede interrumpir (HU-Q3.1 CA3): un formulario abierto o una
 * impresión en curso. Mismo contrato que el del cuaderno (HU-E3.1), con impresiones en vez de
 * escrituras: si un tercer producto lo necesita, pasa a un paquete (regla de tres, ADR-39).
 */
export interface Actividad {
  readonly formulariosAbiertos: number;
  readonly impresionesEnCurso: number;
}

type Oyente = (a: Actividad) => void;

let estado: Actividad = { formulariosAbiertos: 0, impresionesEnCurso: 0 };
const oyentes = new Set<Oyente>();

function cambiar(cambio: Partial<Actividad>): void {
  estado = { ...estado, ...cambio };
  for (const o of oyentes) o(estado);
}

export const actividadActual = (): Actividad => estado;

export function escucharActividad(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/** Lo llama cada formulario al abrirse; la función devuelta, al cerrarse (una sola vez). */
export function abrirFormulario(): () => void {
  cambiar({ formulariosAbiertos: estado.formulariosAbiertos + 1 });
  let cerrado = false;
  return () => {
    if (cerrado) return;
    cerrado = true;
    cambiar({ formulariosAbiertos: estado.formulariosAbiertos - 1 });
  };
}

/** Una impresión cuenta como «en curso» hasta que termina, bien o mal. */
export async function conImpresion<T>(trabajo: () => Promise<T>): Promise<T> {
  cambiar({ impresionesEnCurso: estado.impresionesEnCurso + 1 });
  try {
    return await trabajo();
  } finally {
    cambiar({ impresionesEnCurso: estado.impresionesEnCurso - 1 });
  }
}

export type DecisionDeActualizacion = 'nada' | 'esperar' | 'ofrecer';

export function decidirActualizacion(
  hayVersionNueva: boolean,
  a: Actividad,
): DecisionDeActualizacion {
  if (!hayVersionNueva) return 'nada';
  return a.formulariosAbiertos > 0 || a.impresionesEnCurso > 0 ? 'esperar' : 'ofrecer';
}
