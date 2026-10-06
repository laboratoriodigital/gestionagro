/**
 * Lo que se lee de algún lado (HU-C6.3): «cargando», «vacío» y «error» son estados distintos y la
 * pantalla los dice distinto. Una lista que arranca como `[]` dice «no hay» mientras todavía no
 * sabe, y quien la lee cree que perdió sus datos (bitácora agro 17).
 *
 * Por eso el estado es una unión con su etiqueta: mientras se carga **no se puede** construir un
 * «vacío», porque no hay elementos que mirar. El compilador lo impide, y la prueba también.
 */
import type { ComponentChildren } from 'preact';

export type EstadoDeContenido<T> =
  | { tipo: 'cargando' }
  | { tipo: 'error'; causa: string; reintentar?: ComponentChildren }
  | { tipo: 'listo'; elementos: readonly T[] };

export function Contenido<T>({
  estado,
  vacio,
  elemento,
  titulo,
}: {
  estado: EstadoDeContenido<T>;
  /** Por qué no hay nada y qué hacer: «vacío» siempre dice las dos cosas. */
  vacio: { porque: string; accion?: ComponentChildren };
  elemento: (e: T) => ComponentChildren;
  /** El nombre de la lista, para el lector de pantalla. */
  titulo: string;
}) {
  if (estado.tipo === 'cargando') {
    return (
      <p class="ed1-contenido ed1-contenido--cargando" role="status" aria-live="polite">
        Cargando {titulo.toLowerCase()}…
      </p>
    );
  }
  if (estado.tipo === 'error') {
    return (
      <div class="ed1-contenido ed1-contenido--error" role="alert">
        <p>{estado.causa}</p>
        {estado.reintentar ?? null}
      </div>
    );
  }
  if (estado.elementos.length === 0) {
    return (
      <div class="ed1-contenido ed1-contenido--vacio">
        <p>{vacio.porque}</p>
        {vacio.accion ?? null}
      </div>
    );
  }
  return (
    <ul class="ed1-lista" aria-label={titulo}>
      {estado.elementos.map((e, i) => (
        <li class="ed1-lista__elemento" key={i}>
          {elemento(e)}
        </li>
      ))}
    </ul>
  );
}
