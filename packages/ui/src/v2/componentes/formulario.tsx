/**
 * Campos de formulario (HU-C6.3). Dos reglas que vienen de errores reales:
 * - el error va junto a su campo, y el campo lo anuncia (`aria-invalid`, `aria-describedby`);
 * - un formulario muestra **todos** sus errores en la misma vuelta (bitácora agro 16): si una
 *   validación sale antes, las demás quedan escondidas hasta el siguiente intento.
 */
import type { ComponentChildren } from 'preact';

export interface PropsDeCampo {
  id: string;
  nombre: string;
  etiqueta: string;
  tipo?: 'text' | 'email' | 'tel' | 'number' | 'date';
  valor?: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  /** Lo que el navegador puede completar solo (`email`, `name`…). */
  autocompletar?: string;
}

export function Campo(p: PropsDeCampo) {
  const describe = [p.ayuda ? `${p.id}-ayuda` : null, p.error ? `${p.id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div class={`ed1-campo${p.error ? ' ed1-campo--con-error' : ''}`}>
      <label class="ed1-campo__etiqueta" for={p.id}>
        {p.etiqueta}
        {p.requerido ? null : <span class="ed1-campo__opcional"> (opcional)</span>}
      </label>
      <input
        class="ed1-campo__control"
        id={p.id}
        name={p.nombre}
        type={p.tipo ?? 'text'}
        value={p.valor}
        required={p.requerido}
        autocomplete={p.autocompletar}
        aria-invalid={p.error ? 'true' : undefined}
        aria-describedby={describe || undefined}
      />
      {p.ayuda ? (
        <p class="ed1-campo__ayuda" id={`${p.id}-ayuda`}>
          {p.ayuda}
        </p>
      ) : null}
      {p.error ? (
        <p class="ed1-campo__error" id={`${p.id}-error`}>
          {p.error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Todos los errores del formulario arriba, cada uno con el enlace a su campo. Va además del error
 * junto a cada campo: el resumen dice cuántos hay; el campo dice dónde.
 */
export function ResumenDeErrores({
  errores,
}: {
  errores: readonly { campo: string; mensaje: string }[];
}) {
  if (errores.length === 0) return null;
  return (
    <div class="ed1-resumen-errores" role="alert" tabindex={-1}>
      <p class="ed1-resumen-errores__titulo">
        {errores.length === 1
          ? 'Falta corregir una cosa:'
          : `Falta corregir ${errores.length} cosas:`}
      </p>
      <ul>
        {errores.map((e) => (
          <li key={e.campo}>
            <a href={`#${e.campo}`}>{e.mensaje}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Un grupo de campos con su título. */
export function Grupo({ titulo, children }: { titulo: string; children: ComponentChildren }) {
  return (
    <fieldset class="ed1-grupo">
      <legend class="ed1-grupo__titulo">{titulo}</legend>
      {children}
    </fieldset>
  );
}
