import { estadoDePedido } from './estados.ts';

/** El estado de un pedido: el texto dice lo mismo que el color (HU-T3.5 CA1). */
export function Estado({ id }: { id: string }) {
  const { texto, tono } = estadoDePedido(id);
  return <span class={`estado estado--${tono}`}>{texto}</span>;
}
