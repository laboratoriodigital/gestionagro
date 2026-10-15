/**
 * Los estados de un pedido en palabras y con su tono (HU-T3.5 CA1: «estados con texto y color»).
 * El color nunca va solo: el texto dice lo mismo. Un estado que el panel no conoce se muestra tal
 * cual y en tono neutro: nunca se esconde ni se pinta como si estuviera bien (P1).
 */
export type Tono = 'pendiente' | 'en-curso' | 'bien' | 'neutro' | 'mal';

export const ESTADOS_DE_PEDIDO: Readonly<Record<string, { texto: string; tono: Tono }>> = {
  pendiente: { texto: 'Por confirmar', tono: 'pendiente' },
  por_pagar: { texto: 'Por pagar', tono: 'pendiente' },
  confirmado: { texto: 'Confirmado', tono: 'en-curso' },
  pagado: { texto: 'Pagado', tono: 'bien' },
  despachado: { texto: 'Despachado', tono: 'neutro' },
  entregado: { texto: 'Entregado', tono: 'bien' },
  cancelado: { texto: 'Cancelado', tono: 'mal' },
  devuelto: { texto: 'Devuelto', tono: 'mal' },
};

export const estadoDePedido = (id: string): { texto: string; tono: Tono } =>
  ESTADOS_DE_PEDIDO[id] ?? { texto: id, tono: 'neutro' };
