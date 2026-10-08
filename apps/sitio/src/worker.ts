/**
 * Worker del sitio (ARQUITECTURA §5.1). Todo lo público es asset estático y no ejecuta este
 * script; solo `/api/*` lo hace (ED1 [H3]). Hoy atiende una ruta: `POST /api/eventos`.
 *
 * Un lote por sesión = una invocación. Se escribe **un** punto en Analytics Engine por lote:
 * - `indexes[0]` y `blobs[0]`: id del producto;
 * - `doubles[i]`: cuántas veces pasó `EVENTOS[i]` (tool.opened, tool.completed, tool.shared,
 *   tool.next_step). Las consultas de HU-E2.6 leen `double1 … double4` en ese orden.
 *
 * Kill switch (HU-E8.1): con `ks:<producto>` en `apagado`, el lote se rechaza con 503 y no se
 * escribe nada. La calculadora sigue funcionando: es un asset estático que no pasa por aquí.
 */
import { EVENTOS, type Lote, motivoDeRechazoDelLote } from '@ed1/eventos';
import { crearLectorKillSwitch, type LectorKillSwitch, type LectorKv } from '@ed1/kill-switch';

/** Productos que emiten eventos. Una prueba lo ata a los `product.yaml` (P2). */
export const PRODUCTOS_CON_EVENTOS: readonly string[] = [
  'agro-calculadora-dpv',
  'agro-periodo-de-carencia',
];

const TAMANO_MAXIMO_BYTES = 2048;

export interface DatasetDeAnalytics {
  writeDataPoint(punto: { indexes?: string[]; blobs?: string[]; doubles?: number[] }): void;
}

export interface Env {
  /** Binding de Workers Analytics Engine. */
  EVENTOS?: DatasetDeAnalytics;
  ASSETS: { fetch: (solicitud: Request) => Promise<Response> };
  /** KV de flags de la celda (`agro-c0-flags`); lo agrega el despliegue (HU-E8.1). */
  FLAGS?: LectorKv;
}

// Uno por isolate: la caché de 60 s vive mientras viva el isolate.
let lector: { kv: LectorKv; lector: LectorKillSwitch } | null = null;
function lectorDe(kv: LectorKv): LectorKillSwitch {
  if (lector?.kv !== kv) lector = { kv, lector: crearLectorKillSwitch({ kv }) };
  return lector.lector;
}

const respuesta = (estado: number, mensaje?: string) =>
  new Response(mensaje ?? null, {
    status: estado,
    headers: mensaje ? { 'content-type': 'text/plain; charset=utf-8' } : {},
  });

/** Valida un lote. Devuelve el motivo del rechazo, o null si es válido. */
export const motivoDeRechazo = (lote: unknown): string | null =>
  motivoDeRechazoDelLote(lote, PRODUCTOS_CON_EVENTOS);

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
  if (env.FLAGS && (await lectorDe(env.FLAGS).apagado(producto))) {
    return new Response('Producto apagado', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '60' },
    });
  }
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
