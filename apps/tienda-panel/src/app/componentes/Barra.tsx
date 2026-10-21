import type { ComponentChildren } from 'preact';

/**
 * Arriba, siempre: de qué tienda es lo que se ve y con qué rol (HU-T8.1, el boceto), y el acceso a
 * publicar para quien puede.
 */
export function Barra({
  tienda,
  rol,
  children,
}: {
  tienda: string;
  rol: string;
  children?: ComponentChildren;
}) {
  return (
    <header class="barra">
      <span class="barra__tienda">{tienda}</span>
      <span class="etiqueta">{rol}</span>
      {children ?? null}
    </header>
  );
}
