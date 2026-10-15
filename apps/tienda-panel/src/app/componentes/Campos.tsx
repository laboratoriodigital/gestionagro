/**
 * Un campo de texto y una casilla del panel, con el error junto al campo y anunciado
 * (`aria-invalid`, `aria-describedby`), como el `Campo` de `@ed1/ui` v2 pero controlados.
 */
import type { ComponentChildren } from 'preact';

export function Texto({
  id,
  etiqueta,
  valor,
  alCambiar,
  error,
  ayuda,
  opcional,
  numerico,
  deshabilitado,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  error?: string | undefined;
  ayuda?: string;
  opcional?: boolean;
  numerico?: boolean;
  deshabilitado?: boolean;
}) {
  const describe = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div class={`ed1-campo${error ? ' ed1-campo--con-error' : ''}`}>
      <label class="ed1-campo__etiqueta" for={id}>
        {etiqueta}
        {opcional ? <span class="ed1-campo__opcional"> (opcional)</span> : null}
      </label>
      <input
        class="ed1-campo__control"
        id={id}
        type="text"
        inputMode={numerico ? 'numeric' : undefined}
        value={valor}
        disabled={deshabilitado}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describe || undefined}
        onInput={(e) => alCambiar((e.target as HTMLInputElement).value)}
      />
      {ayuda ? (
        <p class="ed1-campo__ayuda" id={`${id}-ayuda`}>
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p class="ed1-campo__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Casilla({
  id,
  etiqueta,
  marcada,
  alCambiar,
}: {
  id: string;
  etiqueta: ComponentChildren;
  marcada: boolean;
  alCambiar: (v: boolean) => void;
}) {
  return (
    <label class="casilla" for={id}>
      <input
        id={id}
        type="checkbox"
        checked={marcada}
        onChange={(e) => alCambiar((e.target as HTMLInputElement).checked)}
      />
      {etiqueta}
    </label>
  );
}
