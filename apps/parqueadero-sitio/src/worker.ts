/**
 * Worker del sitio del parqueadero (HU-Q5.3, ADR-32, PARQUEADERO §14.4). Todo es asset estático
 * y no ejecuta este script; solo `/_m` lo hace (`run_worker_first`). Recibe dos lotes de eventos
 * anónimos:
 * - el de la caja, con un punto en Analytics Engine por clave: `indexes[0]` el producto
 *   (`parqueadero-caja`), `blobs` el evento, el adaptador y la causa (vacíos si no aplican) y
 *   `doubles[0]` cuántas veces pasó;
 * - el de una herramienta del sitio (HU-Q11.5, `@ed1/eventos`), con un punto por lote como el sitio
 *   del agro: `indexes[0]` y `blobs[0]` la herramienta, y `doubles` los cuatro `tool.*` en orden.
 *
 * Sin IP ni nada de la solicitud (P13): ni cabeceras, ni país, ni agente. Un lote con una clave
 * fuera de la lista cerrada se rechaza entero (P10).
 */
import {
  EVENTOS,
  type Lote,
  type LoteDeLaCaja,
  leerClave,
  motivoDeRechazoDeLaCaja,
  motivoDeRechazoDelLote,
  VERSION_DEL_LOTE,
} from '@ed1/eventos';

/** Las herramientas del sitio que cuentan sus eventos (HU-Q11.4). */
export const HERRAMIENTAS_CON_EVENTOS: readonly string[] = ['parqueadero-recibo-de-entrada'];

const TAMANO_MAXIMO_BYTES = 4096;

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

export async function atenderEventos(solicitud: Request, env: Env): Promise<Response> {
  if (solicitud.method !== 'POST') return respuesta(405, 'Solo POST');
  const cuerpo = await solicitud.text();
  if (new TextEncoder().encode(cuerpo).length > TAMANO_MAXIMO_BYTES) {
    return respuesta(413, 'Lote demasiado grande');
  }
  let lote: unknown;
  try {
    lote = JSON.parse(cuerpo);
  } catch {
    return respuesta(400, 'El lote no es JSON');
  }
  const deHerramienta = (lote as { v?: unknown } | null)?.v === VERSION_DEL_LOTE;
  const motivo = deHerramienta
    ? motivoDeRechazoDelLote(lote, HERRAMIENTAS_CON_EVENTOS)
    : motivoDeRechazoDeLaCaja(lote);
  if (motivo) return respuesta(400, motivo);
  if (!env.EVENTOS) {
    // Sin destino no se finge éxito (P1): la caja guarda el lote y lo manda después.
    console.error('ed1-parqueadero: falta el binding EVENTOS de Analytics Engine');
    return respuesta(503, 'Eventos no disponibles');
  }
  if (deHerramienta) {
    const { producto, eventos } = lote as Lote;
    env.EVENTOS.writeDataPoint({
      indexes: [producto],
      blobs: [producto],
      doubles: EVENTOS.map((nombre) => eventos[nombre] ?? 0),
    });
    return respuesta(204);
  }
  const { producto, conteos } = lote as LoteDeLaCaja;
  for (const [clave, cuenta] of Object.entries(conteos)) {
    const e = leerClave(clave);
    if (!e) continue;
    env.EVENTOS.writeDataPoint({
      indexes: [producto],
      blobs:
        e.evento === 'impresion.fallida' ? [e.evento, e.adaptador, e.causa] : [e.evento, '', ''],
      doubles: [cuenta],
    });
  }
  return respuesta(204);
}

export default {
  async fetch(solicitud: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(solicitud.url);
    if (pathname === '/_m') return atenderEventos(solicitud, env);
    return env.ASSETS.fetch(solicitud);
  },
};
