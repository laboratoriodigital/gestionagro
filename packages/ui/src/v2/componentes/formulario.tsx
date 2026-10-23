/**
 * Campos de formulario (HU-C6.3). Dos reglas que vienen de errores reales:
 * - el error va junto a su campo, y el campo lo anuncia (`aria-invalid`, `aria-describedby`);
 * - un formulario muestra **todos** sus errores en la misma vuelta (bitácora agro 16): si una
 *   validación sale antes, las demás quedan escondidas hasta el siguiente intento.
 */
import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';

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
 * HU-T18.12: lleva a un campo y lo deja listo para escribir: lo pone en el centro de la pantalla y
 * le da el foco. El `campo` de un error es el id del control o de su grupo; en un grupo, va al
 * primer control que tenga. Responde si lo encontró.
 */
export function irAlCampo(campo: string): boolean {
  if (typeof document === 'undefined') return false;
  const elemento = document.getElementById(campo);
  if (!elemento) return false;
  const control = elemento.matches('input, select, textarea, button, [tabindex]')
    ? elemento
    : (elemento.querySelector<HTMLElement>('input, select, textarea, button') ?? elemento);
  const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  control.scrollIntoView({ block: 'center', behavior: quieto ? 'auto' : 'smooth' });
  control.focus({ preventScroll: true });
  return true;
}

/**
 * Todos los errores del formulario arriba, cada uno con el enlace a su campo. Va además del error
 * junto a cada campo: el resumen dice cuántos hay; el campo dice dónde. HU-T18.12: cuando aparece
 * un error que no estaba, lleva solo al primer campo con error; si no lo encuentra, al resumen. Si
 * los errores solo bajan porque la persona los va corrigiendo, el foco se queda donde escribe
 * (bitácora tienda3 58). Cada enlace lleva a su campo con el foco puesto.
 */
export function ResumenDeErrores({
  errores,
}: {
  errores: readonly { campo: string; mensaje: string }[];
}) {
  const caja = useRef<HTMLDivElement>(null);
  const antes = useRef<ReadonlySet<string>>(new Set());
  const claves = errores.map((e) => `${e.campo}:${e.mensaje}`);
  const huella = claves.join('|');
  // Solo cuando cambian los errores (su huella), y en el mismo momento en que aparecen: si esperara
  // al siguiente cuadro, en un teléfono lento le quitaría el foco a quien ya empezó a escribir en
  // otro campo (bitácora tienda3 58).
  useLayoutEffect(() => {
    const previos = antes.current;
    antes.current = new Set(claves);
    const primero = errores[0];
    if (!primero || claves.every((c) => previos.has(c))) return;
    if (!irAlCampo(primero.campo)) caja.current?.focus();
  }, [huella]);
  if (errores.length === 0) return null;
  return (
    <div class="ed1-resumen-errores" role="alert" tabindex={-1} ref={caja}>
      <p class="ed1-resumen-errores__titulo">
        {errores.length === 1
          ? 'Falta corregir una cosa:'
          : `Falta corregir ${errores.length} cosas:`}
      </p>
      <ul>
        {errores.map((e) => (
          <li key={e.campo}>
            <a
              href={`#${e.campo}`}
              onClick={(ev) => {
                if (irAlCampo(e.campo)) ev.preventDefault();
              }}
            >
              {e.mensaje}
            </a>
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
