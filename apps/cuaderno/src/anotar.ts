/**
 * «Anotar» (HU-E0.11): el botón del centro de la barra abre los seis registros del día y lleva a
 * Registrar con el elegido ya abierto. Una sola lista de tipos para la barra y para Registrar (P2).
 *
 * El pedido viaja en la memoria de la página y en un evento, no en la dirección: si Registrar ya
 * está abierto, cambia de formulario sin recargar; si no, lo toma al abrirse. Un enlace de afuera
 * puede pedir lo mismo con `#tipo=riego`.
 */

export const TIPOS = [
  { id: 'clima', titulo: 'Clima' },
  { id: 'riego', titulo: 'Riego' },
  { id: 'labor', titulo: 'Labores' },
  { id: 'aplicacion', titulo: 'Aplicaciones' },
  { id: 'cosecha', titulo: 'Cosecha' },
  { id: 'monitoreo', titulo: 'Monitoreo' },
] as const;
export type TipoRegistro = (typeof TIPOS)[number]['id'];

const EVENTO = 'cuaderno:anotar';
let pedido: TipoRegistro | null = null;

const esTipo = (t: string | null | undefined): t is TipoRegistro => TIPOS.some((x) => x.id === t);

/** Pide abrir Registrar en `tipo`: lo toma Registrar al abrirse, o al vuelo si ya está abierto. */
export function pedirAnotar(tipo: TipoRegistro): void {
  pedido = tipo;
  window.dispatchEvent(new CustomEvent(EVENTO));
}

/** El tipo pedido (de la barra o de `#tipo=` en la dirección), una sola vez. */
export function tomarPedido(fragmento: string): TipoRegistro | null {
  const delFragmento = new URLSearchParams(fragmento.replace(/^#/, '')).get('tipo');
  const tipo = pedido ?? (esTipo(delFragmento) ? delFragmento : null);
  pedido = null;
  return tipo;
}

/** Avisa cada vez que se pide anotar mientras Registrar está abierto. */
export function escucharPedidos(alPedir: () => void): () => void {
  window.addEventListener(EVENTO, alPedir);
  return () => window.removeEventListener(EVENTO, alPedir);
}

/**
 * Los tipos con lo más anotado primero: cuenta los registros recientes de cada tipo y deja el
 * orden de siempre para los empates y para un cuaderno vacío.
 */
export function porUso(recientes: readonly { tipo: string }[]): (typeof TIPOS)[number][] {
  const cuenta = new Map<string, number>();
  for (const r of recientes) cuenta.set(r.tipo, (cuenta.get(r.tipo) ?? 0) + 1);
  return TIPOS.map((t, i) => ({ t, i, n: cuenta.get(t.id) ?? 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.t);
}
