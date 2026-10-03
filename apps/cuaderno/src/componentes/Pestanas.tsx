/**
 * Pestañas de una pantalla larga (revisión del dueño, 3 oct 2026: «Lotes y Costos siguen extensos;
 * las opciones internas en botones, como en Registrar»). Mismo aspecto que las de Registrar: botones
 * de 48 px con `aria-pressed`, y solo se muestra el contenido de la elegida.
 */
export interface Pestana<T extends string> {
  id: T;
  titulo: string;
}

export function Pestanas<T extends string>(props: {
  etiqueta: string;
  opciones: readonly Pestana<T>[];
  actual: T;
  alCambiar: (id: T) => void;
  prueba?: string;
}) {
  return (
    <fieldset class="pestanas" data-prueba={props.prueba}>
      <legend class="solo-lectores">{props.etiqueta}</legend>
      {props.opciones.map((o) => (
        <button
          type="button"
          key={o.id}
          class={props.actual === o.id ? '' : 'secundario'}
          aria-pressed={props.actual === o.id}
          onClick={() => props.alCambiar(o.id)}
        >
          {o.titulo}
        </button>
      ))}
    </fieldset>
  );
}
