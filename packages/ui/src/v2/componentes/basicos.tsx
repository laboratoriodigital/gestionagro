/**
 * Componentes básicos del sistema de diseño v2 (HU-C6.3, BACKLOG_CORE §4.5, ADR-29).
 *
 * Se escriben en Preact para que Astro los entregue como HTML estático, sin enviar JavaScript
 * (static-first), y para que las pruebas los rendericen a texto. Ningún componente lleva estilos
 * en línea: la CSP `'self'` los bloquearía (bitácora agro, «Lo que el terreno enseñó»). Todo el
 * estilo está en `../componentes.css`, solo con tokens.
 */
import type { ComponentChildren } from 'preact';

/**
 * Lo exacto en monoespaciada: fechas, montos, códigos, radicados y plazos. No es un adorno sobre un
 * título (una «etiqueta encima del titular» está prohibida por el piso de calidad): acompaña un dato.
 */
export function Etiqueta({ children }: { children: ComponentChildren }) {
  return <span class="ed1-etiqueta">{children}</span>;
}

export type VarianteDeBoton = 'primario' | 'secundario' | 'texto';

interface BotonComun {
  variante?: VarianteDeBoton;
  children: ComponentChildren;
  /** Mientras la acción corre: el botón lo dice y no se puede tocar dos veces. */
  ocupado?: boolean;
  /**
   * Un botón deshabilitado dice por qué (P15): sin motivo, la persona cree que la app no sirve.
   * El motivo queda junto al botón y el lector de pantalla lo asocia.
   */
  deshabilitado?: { motivo: string; id: string };
}

export type PropsDeBoton = BotonComun &
  (
    | { href: string; tipo?: never; nombre?: never; valor?: never }
    | { href?: never; tipo?: 'submit' | 'button'; nombre?: string; valor?: string }
  );

export function Boton(props: PropsDeBoton) {
  const clase = `ed1-boton ed1-boton--${props.variante ?? 'primario'}`;
  const motivo = props.deshabilitado;
  const inactivo = Boolean(motivo || props.ocupado);
  const contenido = props.ocupado ? (
    <span class="ed1-boton__ocupado">{props.children}</span>
  ) : (
    props.children
  );
  const control =
    props.href !== undefined && !inactivo ? (
      <a class={clase} href={props.href}>
        {contenido}
      </a>
    ) : (
      <button
        class={clase}
        type={props.tipo ?? 'button'}
        name={props.nombre}
        value={props.valor}
        disabled={inactivo}
        aria-busy={props.ocupado ? 'true' : undefined}
        aria-describedby={motivo?.id}
      >
        {contenido}
      </button>
    );
  if (!motivo) return control;
  return (
    <span class="ed1-boton-con-motivo">
      {control}
      <span class="ed1-boton__motivo" id={motivo.id}>
        {motivo.motivo}
      </span>
    </span>
  );
}

export type TonoDeAviso = 'info' | 'exito' | 'aviso' | 'peligro';

/**
 * Lo que responde a una acción, en la vista de esa acción: un aviso lejos del botón es un botón que
 * no hace nada (bitácora agro, «Lo que el terreno enseñó»). Los de peligro interrumpen al lector de
 * pantalla (`alert`); los demás esperan su turno (`status`).
 */
export function Aviso({
  tono = 'info',
  titulo,
  children,
}: {
  tono?: TonoDeAviso;
  titulo: string;
  children?: ComponentChildren;
}) {
  return (
    <div class={`ed1-aviso ed1-aviso--${tono}`} role={tono === 'peligro' ? 'alert' : 'status'}>
      <p class="ed1-aviso__titulo">{titulo}</p>
      {children ? <div class="ed1-aviso__texto">{children}</div> : null}
    </div>
  );
}

/** Un bloque con un solo propósito. Nunca dentro de otra tarjeta. */
export function Tarjeta({
  titulo,
  children,
  pie,
}: {
  titulo: string;
  children: ComponentChildren;
  pie?: ComponentChildren;
}) {
  return (
    <section class="ed1-tarjeta">
      <h3 class="ed1-tarjeta__titulo">{titulo}</h3>
      <div class="ed1-tarjeta__cuerpo">{children}</div>
      {pie ? <div class="ed1-tarjeta__pie">{pie}</div> : null}
    </section>
  );
}
