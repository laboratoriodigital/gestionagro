/**
 * HU-P5.1 (sprint PF1): el enlace a la guía de la ayuda de TiendaPro que explica esta pantalla.
 * Abre aparte, para no perder lo que se está llenando.
 */
import { type GuiaDeAyuda, guiaDeAyuda } from '@ed1/tienda-schema/marca';

export function Guia({ guia }: { guia: GuiaDeAyuda }) {
  return (
    <p class="nota">
      <a href={guiaDeAyuda(guia)} target="_blank" rel="noopener">
        Ver la guía paso a paso
      </a>
    </p>
  );
}
