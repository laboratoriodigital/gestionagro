/**
 * La medición propia de la tienda (HU-T14.1, TIENDA-3.0 §11.6): cinco eventos que la vitrina cuenta
 * en el teléfono y manda en un lote a `/_m` al salir de la página. Sin cookies, sin identificadores
 * y sin la IP: el lote es solo cuántas veces pasó cada evento (CA2). La API lo escribe en Analytics
 * Engine con la tienda como índice.
 *
 * Lo comparten la vitrina (que cuenta y manda) y la API (que valida): una sola lista cerrada.
 */
export const EVENTOS_DE_LA_TIENDA = [
  'ver_producto',
  'agregar_al_carrito',
  'iniciar_pedido',
  'pagar_en_linea',
  'pago_confirmado',
] as const;
export type EventoDeLaTienda = (typeof EVENTOS_DE_LA_TIENDA)[number];

export const VERSION_DE_LA_MEDICION = 1;
/** Un lote de una página no llega a esto: lo que pase es otra cosa. */
export const MAXIMO_POR_EVENTO = 100;
export const TAMANO_MAXIMO_DEL_LOTE = 1024;

export interface LoteDeMedicion {
  v: typeof VERSION_DE_LA_MEDICION;
  conteos: Partial<Record<EventoDeLaTienda, number>>;
}

/** El motivo para rechazar un lote, o `null` si se escribe. Una clave fuera de la lista lo rechaza entero. */
export function motivoDeRechazoDeLaMedicion(lote: unknown): string | null {
  if (!lote || typeof lote !== 'object') return 'el lote no es un objeto';
  const l = lote as Record<string, unknown>;
  if (l['v'] !== VERSION_DE_LA_MEDICION) return 'versión desconocida';
  const otras = Object.keys(l).filter((k) => k !== 'v' && k !== 'conteos');
  if (otras.length > 0) return `campos de más: ${otras.join(', ')}`;
  const conteos = l['conteos'];
  if (!conteos || typeof conteos !== 'object' || Array.isArray(conteos))
    return 'faltan los conteos';
  const entradas = Object.entries(conteos as Record<string, unknown>);
  if (entradas.length === 0) return 'el lote está vacío';
  for (const [k, v] of entradas) {
    if (!(EVENTOS_DE_LA_TIENDA as readonly string[]).includes(k)) return `evento desconocido: ${k}`;
    if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > MAXIMO_POR_EVENTO)
      return `conteo inválido en ${k}`;
  }
  return null;
}

// ── En el teléfono ──────────────────────────────────────────────────────────────────────────

const pendientes = new Map<EventoDeLaTienda, number>();
let escuchando = false;

/** Manda lo contado y empieza de cero. `sendBeacon` sobrevive al cierre de la página. */
export function enviarMedicion(): void {
  if (pendientes.size === 0) return;
  const lote: LoteDeMedicion = {
    v: VERSION_DE_LA_MEDICION,
    conteos: Object.fromEntries(pendientes),
  };
  pendientes.clear();
  try {
    // Como texto: la API lo lee así, y no pide una consulta previa.
    navigator.sendBeacon?.('/_m', JSON.stringify(lote));
  } catch {
    // Medir nunca rompe la tienda.
  }
}

/** Cuenta un evento; el lote sale cuando la página se esconde o se cierra. */
export function contar(evento: EventoDeLaTienda): void {
  pendientes.set(evento, Math.min(MAXIMO_POR_EVENTO, (pendientes.get(evento) ?? 0) + 1));
  if (escuchando || typeof addEventListener !== 'function') return;
  escuchando = true;
  addEventListener('pagehide', enviarMedicion);
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') enviarMedicion();
  });
}
