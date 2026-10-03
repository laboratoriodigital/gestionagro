/**
 * Una tabla ancha en un teléfono: se desliza de lado dentro de su caja, sin hacer la página más
 * ancha que la pantalla, con la primera columna fija (`estilos.css`, `.tabla-desliza`).
 *
 * La caja recibe el foco del teclado: si no, quien no usa el dedo no puede desplazarla (axe,
 * «scrollable-region-focusable»; Safari no lo hace solo). Su nombre lo lee el lector de pantalla.
 */
import type { ComponentChildren } from 'preact';

export function TablaDeslizable(props: { nombre: string; children: ComponentChildren }) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: una región que se desliza tiene que poder desplazarse con el teclado.
    <section class="tabla-desliza" aria-label={props.nombre} tabIndex={0}>
      {props.children}
    </section>
  );
}
