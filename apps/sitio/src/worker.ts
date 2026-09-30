/**
 * Worker del sitio (ARQUITECTURA §5.1). Todo lo público es asset estático y no ejecuta este
 * script; solo `/api/*` lo hace (ED1 [H3]). Hoy atiende una ruta: `POST /api/eventos`.
 *
 * Un lote por sesión = una invocación. Se escribe **un** punto en Analytics Engine por lote:
 * - `indexes[0]` y `blobs[0]`: id del producto;
 * - `doubles[i]`: cuántas veces pasó `EVENTOS[i]` (tool.opened, tool.completed, tool.shared,
 *   tool.next_step). Las consultas de HU-E2.6 leen `double1 … double4` en ese orden.
 */
import { EVENTOS, type Lote, VERSION_DEL_LOTE } from '@gestionagro/eventos';

/** Productos que emiten eventos. Una prueba lo ata a los `product.yaml` (P2). */
export const PRODUCTOS_CON_EVENTOS: readonly string[] = ['agro-calculadora-dpv'];

const TAMANO_MAXIMO_BYTES = 2048;
const CUENTA_MAXIMA = 100;

export interface DatasetDeAnalytics {
  writeDataPoint(punto: { indexes?: string[]; blobs?: string[]; doubles?: number[] }): void;
}

export interface Env {
  /** Binding de Workers Analytics Engine. */
  EVENTOS?: DatasetDeAnalytics;
  ASSETS: { fetch: (solicitud: Request) => Promise<Response> };
}

const respuesta = (estado: number, mensaje?: string) =>
  new Response(mensaje ?? null, {
    status: estado,
    headers: mensaje ? { 'content-type': 'text/plain; charset=utf-8' } : {},
  });

/** Valida un lote. Devuelve el motivo del rechazo, o null si es válido. */
export function motivoDeRechazo(lote: unknown): string | null {
  if (typeof lote !== 'object' || lote === null) return 'el lote no es un objeto';
  const l = lote as Partial<Lote>;
  if (l.v !== VERSION_DEL_LOTE) return `versión de lote desconocida: ${String(l.v)}`;
  if (typeof l.producto !== 'string' || !PRODUCTOS_CON_EVENTOS.includes(l.producto)) {
    return `producto desconocido: ${String(l.producto)}`;
  }
  if (typeof l.eventos !== 'object' || l.eventos === null) return 'faltan los eventos';
  const nombres = Object.keys(l.eventos);
  if (nombres.length === 0) return 'el lote no trae eventos';
  for (const [nombre, cuenta] of Object.entries(l.eventos)) {
    if (!(EVENTOS as readonly string[]).includes(nombre)) return `evento desconocido: ${nombre}`;
    if (!Number.isInteger(cuenta) || (cuenta as number) < 1 || (cuenta as number) > CUENTA_MAXIMA) {
      return `cuenta inválida para ${nombre}: ${String(cuenta)}`;
    }
  }
  return null;
}

export async function atenderEventos(solicitud: Request, env: Env): Promise<Response> {
  if (solicitud.method !== 'POST') return respuesta(405, 'Solo POST');
  const cuerpo = await solicitud.text();
  if (new TextEncoder().encode(cuerpo).length > TAMANO_MAXIMO_BYTES)
    return respuesta(413, 'Lote demasiado grande');
  let lote: unknown;
  try {
    lote = JSON.parse(cuerpo);
  } catch {
    return respuesta(400, 'El lote no es JSON');
  }
  const motivo = motivoDeRechazo(lote);
  if (motivo) return respuesta(400, motivo);
  if (!env.EVENTOS) {
    // Sin destino no se finge éxito (P1): queda en el log y responde 503.
    console.error('agro-sitio: falta el binding EVENTOS de Analytics Engine');
    return respuesta(503, 'Eventos no disponibles');
  }
  const { producto, eventos } = lote as Lote;
  env.EVENTOS.writeDataPoint({
    indexes: [producto],
    blobs: [producto],
    doubles: EVENTOS.map((nombre) => eventos[nombre] ?? 0),
  });
  return respuesta(204);
}

export default {
  async fetch(solicitud: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(solicitud.url);
    if (pathname === '/api/eventos') return atenderEventos(solicitud, env);
    if (pathname.startsWith('/api/')) return respuesta(404, 'Ruta de API desconocida');
    return env.ASSETS.fetch(solicitud);
  },
};
