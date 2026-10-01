/** Campo de texto con etiqueta y error junto al campo (P15: el aviso va donde se mira). */
export function Campo(props: {
  id: string;
  etiqueta: string;
  valor: string;
  error?: string | undefined;
  decimal?: boolean;
  ayuda?: string;
  alCambiar: (valor: string) => void;
}) {
  const idError = `${props.id}-error`;
  const idAyuda = `${props.id}-ayuda`;
  const descritoPor = [props.ayuda ? idAyuda : '', props.error ? idError : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div class="campo">
      <label for={props.id}>{props.etiqueta}</label>
      {props.ayuda && (
        <p id={idAyuda} class="ayuda">
          {props.ayuda}
        </p>
      )}
      <input
        id={props.id}
        type="text"
        inputMode={props.decimal ? 'decimal' : 'text'}
        autoComplete="off"
        value={props.valor}
        aria-invalid={props.error ? 'true' : 'false'}
        aria-describedby={descritoPor || undefined}
        onInput={(e) => props.alCambiar((e.currentTarget as HTMLInputElement).value)}
      />
      {props.error && (
        <p id={idError} class="error">
          {props.error}
        </p>
      )}
    </div>
  );
}

/** Grupo de opciones sin ninguna marcada al empezar: no hay valores de fábrica (HU-E3.3, CA2). */
export function Opciones<T extends string>(props: {
  nombre: string;
  leyenda: string;
  opciones: readonly { valor: T; texto: string }[];
  valor: T | '';
  error?: string | undefined;
  alCambiar: (valor: T) => void;
}) {
  const idError = `${props.nombre}-error`;
  return (
    <fieldset class="opciones" aria-describedby={props.error ? idError : undefined}>
      <legend>{props.leyenda}</legend>
      {props.opciones.map((o) => (
        <label class="opcion" key={o.valor}>
          <input
            type="radio"
            name={props.nombre}
            value={o.valor}
            checked={props.valor === o.valor}
            onChange={() => props.alCambiar(o.valor)}
          />
          {o.texto}
        </label>
      ))}
      {props.error && (
        <p id={idError} class="error">
          {props.error}
        </p>
      )}
    </fieldset>
  );
}
