/**
 * La elección de una variante en la ficha (HU-T3.4, TIENDA-3.0 §5.4): qué dice el botón principal
 * según lo que la persona eligió. Pura, para probarla sin navegador; `vitrina.ts` la conecta al
 * HTML. La elección vale solo mientras la ficha está abierta: nada de esto se guarda (CA3,
 * bitácora ecommerce 53).
 */

export interface OpcionDeLaFicha {
  nombre: string;
  valores: string[];
}

export interface VarianteDeLaFicha {
  id: string;
  /** Los valores de las opciones en orden, unidos por «|» (anexo A). */
  clave: string;
  precioCop: number;
  disponible: boolean;
}

export type EstadoDelBoton =
  | { tipo: 'falta'; opcion: string; texto: string }
  | { tipo: 'no-existe'; texto: string }
  | { tipo: 'agotada'; variante: VarianteDeLaFicha; texto: string }
  | { tipo: 'lista'; variante: VarianteDeLaFicha; texto: string };

const claveDe = (opciones: readonly OpcionDeLaFicha[], elegidas: Record<string, string>) =>
  opciones.map((o) => elegidas[o.nombre] ?? '').join('|');

/**
 * El botón dice qué falta, en palabras («Elige talla»), y nunca se apaga sin decir por qué
 * (bitácora ecommerce, crítico «El botón de WhatsApp se apagaba sin decir por qué»).
 */
export function estadoDeLaEleccion(
  opciones: readonly OpcionDeLaFicha[],
  variantes: readonly VarianteDeLaFicha[],
  elegidas: Record<string, string>,
): EstadoDelBoton {
  const falta = opciones.find((o) => !o.valores.includes(elegidas[o.nombre] ?? ''));
  if (falta)
    return { tipo: 'falta', opcion: falta.nombre, texto: `Elige ${falta.nombre.toLowerCase()}` };
  const variante = variantes.find((v) => v.clave === claveDe(opciones, elegidas));
  if (!variante) return { tipo: 'no-existe', texto: 'Esa combinación no está disponible' };
  if (!variante.disponible) return { tipo: 'agotada', variante, texto: 'Agotada' };
  return { tipo: 'lista', variante, texto: 'Agregar al pedido' };
}

/**
 * Si un valor ya no lleva a nada que se pueda pedir, con lo demás que eligió: se muestra tachado,
 * con «Avísame» (CA1). Mira solo lo ya elegido en las otras opciones.
 */
export function valorAgotado(
  opciones: readonly OpcionDeLaFicha[],
  variantes: readonly VarianteDeLaFicha[],
  elegidas: Record<string, string>,
  opcion: string,
  valor: string,
): boolean {
  const i = opciones.findIndex((o) => o.nombre === opcion);
  return !variantes.some((v) => {
    const partes = v.clave.split('|');
    if (partes[i] !== valor || !v.disponible) return false;
    return opciones.every(
      (o, j) => j === i || !elegidas[o.nombre] || partes[j] === elegidas[o.nombre],
    );
  });
}
