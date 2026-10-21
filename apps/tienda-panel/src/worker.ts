/**
 * El Worker del panel de la Tienda 3.0 (HU-T2.4, TIENDA-3.0 §3.1 y §12). El panel es solo assets:
 * este código corre únicamente en `/api/*`, `/mcp` y `/.well-known/*` (`run_worker_first`, HU-T15.7), así ninguna pantalla gasta una
 * invocación. Pasa la solicitud a la API de la celda por su binding de servicio, en el mismo origen
 * y sin CORS, con el secreto del despacho; las cabeceras internas que llegan de afuera se borran
 * (TIENDA §14.1).
 *
 * Con una sola celda va a su API. Con varias, la celda la dice el token del CORE (HU-T2.8); hasta
 * entonces, responde 503 y lo dice (P1), en vez de adivinar.
 */

export const CABECERA_DESPACHO = 'x-despacho';
export const CABECERA_TIENDA = 'x-tienda';

export interface Servicio {
  fetch(solicitud: Request): Promise<Response>;
}

export interface Env {
  ASSETS?: Servicio;
  SECRETO_DESPACHO?: string;
  /** Un binding de servicio por celda: `API_C1`. */
  [binding: string]: unknown;
}

const API = /^API_C[0-9]+$/;

/** La solicitud para la API: sin las cabeceras internas de afuera, con el secreto del despacho. */
export function paraLaApi(solicitud: Request, secreto: string): Request {
  const cabeceras = new Headers(solicitud.headers);
  cabeceras.delete(CABECERA_TIENDA);
  cabeceras.set(CABECERA_DESPACHO, secreto);
  return new Request(solicitud, { headers: cabeceras });
}

export async function atender(solicitud: Request, env: Env): Promise<Response> {
  const url = new URL(solicitud.url);
  // HU-T15.7: el MCP del comercio y sus metadatos también van a la API, sin tienda resuelta.
  const deLaApi =
    url.pathname.startsWith('/api/') ||
    url.pathname === '/mcp' ||
    url.pathname.startsWith('/.well-known/');
  if (!deLaApi) {
    if (env.ASSETS) return env.ASSETS.fetch(solicitud);
    return new Response('No existe', { status: 404 });
  }
  const apis = Object.entries(env).filter(([nombre]) => API.test(nombre)) as [string, Servicio][];
  const [unica] = apis;
  if (!env.SECRETO_DESPACHO || apis.length !== 1 || !unica) {
    console.error(
      `tienda-panel: ${env.SECRETO_DESPACHO ? `${apis.length} APIs de celda` : 'falta SECRETO_DESPACHO'}`,
    );
    return Response.json({ estado: 'sin-configurar' }, { status: 503 });
  }
  return unica[1].fetch(paraLaApi(solicitud, env.SECRETO_DESPACHO));
}

export default { fetch: atender };
