/**
 * El marco de una página (HU-C6.3): encabezado, pie, la confirmación de lo irreversible y las
 * páginas de error. Todo sin JavaScript: el menú del teléfono y la confirmación son `<details>`.
 */
import type { ComponentChildren } from 'preact';

export interface Enlace {
  texto: string;
  href: string;
  /** La página en la que está la persona (`aria-current`). */
  actual?: boolean;
}

/** Marca a la izquierda y navegación mínima; en el teléfono, la navegación se pliega. */
export function Encabezado({
  marca,
  inicio,
  enlaces,
}: {
  marca: string;
  inicio: string;
  enlaces: readonly Enlace[];
}) {
  const lista = (
    <ul class="ed1-encabezado__enlaces">
      {enlaces.map((e) => (
        <li key={e.href}>
          <a href={e.href} aria-current={e.actual ? 'page' : undefined}>
            {e.texto}
          </a>
        </li>
      ))}
    </ul>
  );
  return (
    <header class="ed1-encabezado">
      <a class="ed1-encabezado__marca" href={inicio}>
        {marca}
      </a>
      <nav class="ed1-encabezado__nav" aria-label="Principal">
        <details class="ed1-encabezado__menu">
          <summary>Menú</summary>
          {lista}
        </details>
        <div class="ed1-encabezado__fijo">{lista}</div>
      </nav>
    </header>
  );
}

export function Pie({ enlaces, nota }: { enlaces: readonly Enlace[]; nota: string }) {
  return (
    <footer class="ed1-pie">
      <ul class="ed1-pie__enlaces">
        {enlaces.map((e) => (
          <li key={e.href}>
            <a href={e.href}>{e.texto}</a>
          </li>
        ))}
      </ul>
      <p class="ed1-pie__nota">{nota}</p>
    </footer>
  );
}

/**
 * Lo que no se puede deshacer pide un segundo paso: el primero abre la explicación de qué va a
 * pasar, y el botón de confirmar envía el formulario. Sin modal y sin JavaScript.
 */
export function Confirmacion({
  abrir,
  consecuencia,
  confirmar,
  accion,
  metodo = 'post',
  children,
}: {
  /** El texto del primer paso: la acción, con su verbo («Cerrar todas las sesiones»). */
  abrir: string;
  /** Qué va a pasar, en palabras, antes de confirmar. */
  consecuencia: string;
  /** El texto del botón que confirma. */
  confirmar: string;
  accion: string;
  metodo?: 'post';
  /** Campos ocultos del formulario. */
  children?: ComponentChildren;
}) {
  return (
    <details class="ed1-confirmacion">
      <summary class="ed1-boton ed1-boton--secundario">{abrir}</summary>
      <form class="ed1-confirmacion__formulario" action={accion} method={metodo}>
        <p class="ed1-confirmacion__consecuencia">{consecuencia}</p>
        {children}
        <button class="ed1-boton ed1-boton--peligro" type="submit">
          {confirmar}
        </button>
      </form>
    </details>
  );
}

/** Una página de error como pieza editorial: el código en grande, qué pasó y por dónde seguir. */
export function PaginaDeError({
  codigo,
  titulo,
  texto,
  volver,
}: {
  codigo: string;
  titulo: string;
  texto: string;
  volver: Enlace;
}) {
  return (
    <main class="ed1-error">
      <p class="ed1-error__codigo" aria-hidden="true">
        {codigo}
      </p>
      <h1 class="ed1-error__titulo">{titulo}</h1>
      <p class="ed1-error__texto">{texto}</p>
      <a class="ed1-boton ed1-boton--primario" href={volver.href}>
        {volver.texto}
      </a>
    </main>
  );
}
