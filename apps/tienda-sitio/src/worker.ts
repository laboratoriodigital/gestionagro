/**
 * El despacho de la Tienda 3.0 (HU-T2.4, TIENDA-3.0 §3.1, §3.3 y §11.1): un solo Worker para todas
 * las tiendas. Resuelve la tienda por el `Host` en el KV `TIENDA_HOSTS`, **sin tocar la base**, con
 * una caché en memoria de 30 s; y pasa lo que es de la API (`/api/v1/*`) a la API de su celda por
 * el binding de servicio (`API_C1`), con el secreto del despacho y la tienda resuelta en `x-tienda`.
 *
 * - Un `Host` sin tienda responde 404 con una página neutra: «Esta dirección no tiene tienda».
 * - Las cabeceras internas (`x-despacho`, `x-tienda`) que llegan de afuera se borran siempre: solo
 *   el despacho las escribe (TIENDA §14.1).
 * - Las páginas de una tienda las sirve el horno desde R2 (HU-T5.1). Hasta entonces, 404.
 * - Kill switches (HU-T2.7, TIENDA §15.2): con `ks:tienda` apagado, toda tienda dice «Volvemos
 *   pronto» (503); con `ks:tienda:<org>`, solo esa (una suspensión o una falla aislada). Caché de 60 s.
 *
 * Ningún identificador de cuenta, base o dominio en el código (ADR-6).
 */

import { crearLectorKillSwitch, type LectorKillSwitch } from '@ed1/kill-switch';

export const CABECERA_DESPACHO = 'x-despacho';
export const CABECERA_TIENDA = 'x-tienda';
export const CACHE_MS = 30_000;

/** Lo que guarda `TIENDA_HOSTS` en `h:<hostname>` (TIENDA §5.6). */
export interface DestinoDeHost {
  org: string;
  celda: string;
  shard: string;
}

export interface LectorKv {
  get(clave: string): Promise<string | null>;
}

export interface Servicio {
  fetch(solicitud: Request): Promise<Response>;
}

export interface Env {
  TIENDA_HOSTS?: LectorKv;
  /** El KV de flags de la celda, con los kill switches (`ks:tienda`, `ks:tienda:<org>`). */
  FLAGS?: LectorKv;
  SECRETO_DESPACHO?: string;
  /** Un binding de servicio por celda: `API_C1`. */
  [binding: string]: unknown;
}

const CELDA = /^c[0-9]+$/;

/** Lee y valida una entrada del KV; una que no se puede leer cuenta como «sin tienda» (P1: se dice). */
export function destinoDe(texto: string | null): DestinoDeHost | null {
  if (texto === null) return null;
  try {
    const d = JSON.parse(texto) as Partial<DestinoDeHost>;
    if (typeof d.org === 'string' && typeof d.shard === 'string' && CELDA.test(d.celda ?? '')) {
      return { org: d.org, celda: d.celda as string, shard: d.shard };
    }
  } catch {
    // Abajo: se registra y se trata como un host sin tienda.
  }
  console.error(`tienda-sitio: entrada ilegible en TIENDA_HOSTS (${texto.slice(0, 80)})`);
  return null;
}

/** La solicitud para la API: sin las cabeceras internas de afuera, con las del despacho. */
export function paraLaApi(solicitud: Request, destino: DestinoDeHost, secreto: string): Request {
  const cabeceras = new Headers(solicitud.headers);
  cabeceras.delete(CABECERA_DESPACHO);
  cabeceras.delete(CABECERA_TIENDA);
  cabeceras.set(CABECERA_DESPACHO, secreto);
  cabeceras.set(CABECERA_TIENDA, JSON.stringify({ org: destino.org, shard: destino.shard }));
  return new Request(solicitud, { headers: cabeceras });
}

const SIN_TIENDA = `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Esta dirección no tiene tienda</title>
</head>
<body>
<main>
<h1>Esta dirección no tiene tienda</h1>
<p>Revisa que esté bien escrita. Si alguien te la compartió, pídele el enlace de nuevo.</p>
</main>
</body>
</html>
`;

const CABECERAS_DE_PAGINA = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cache-control': 'public, max-age=60',
};

export const sinTienda = (): Response =>
  new Response(SIN_TIENDA, { status: 404, headers: CABECERAS_DE_PAGINA });

const pagina = (titulo: string, texto: string) => `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${titulo}</title>
</head>
<body>
<main>
<h1>${titulo}</h1>
<p>${texto}</p>
</main>
</body>
</html>
`;

/** Con un kill switch apagado: 503, sin caché y con `Retry-After`, para volver sola. */
export const enPausa = (deTodas: boolean): Response =>
  new Response(
    deTodas
      ? pagina('Volvemos pronto', 'Estamos haciendo un ajuste. Vuelve en unos minutos.')
      : pagina(
          'Esta tienda no está disponible por ahora',
          'Vuelve más tarde, o escríbele a la tienda por su WhatsApp.',
        ),
    {
      status: 503,
      headers: { ...CABECERAS_DE_PAGINA, 'cache-control': 'no-store', 'retry-after': '300' },
    },
  );

export function crearDespacho(opciones: { ahora?: () => number } = {}) {
  const ahora = opciones.ahora ?? (() => Date.now());
  const cache = new Map<string, { destino: DestinoDeHost | null; vence: number }>();
  let lector: { kv: LectorKv; lector: LectorKillSwitch } | null = null;
  const apagado = (env: Env, clave: string) => {
    if (!env.FLAGS) return Promise.resolve(false);
    if (lector?.kv !== env.FLAGS) {
      lector = { kv: env.FLAGS, lector: crearLectorKillSwitch({ kv: env.FLAGS, ahora }) };
    }
    return lector.lector.apagado(clave);
  };

  async function resolver(env: Env, host: string): Promise<DestinoDeHost | null> {
    const guardado = cache.get(host);
    if (guardado && guardado.vence > ahora()) return guardado.destino;
    if (!env.TIENDA_HOSTS) {
      console.error('tienda-sitio: falta el KV TIENDA_HOSTS');
      return null;
    }
    const destino = destinoDe(await env.TIENDA_HOSTS.get(`h:${host}`));
    cache.set(host, { destino, vence: ahora() + CACHE_MS });
    return destino;
  }

  return {
    async fetch(solicitud: Request, env: Env): Promise<Response> {
      const url = new URL(solicitud.url);
      const destino = await resolver(env, url.hostname);
      if (!destino) return sinTienda();
      if (await apagado(env, 'tienda')) return enPausa(true);
      if (await apagado(env, `tienda:${destino.org}`)) return enPausa(false);
      if (url.pathname.startsWith('/api/v1/')) {
        const api = env[`API_${destino.celda.toUpperCase()}`] as Servicio | undefined;
        if (!api || !env.SECRETO_DESPACHO) {
          console.error(`tienda-sitio: sin API o sin secreto para la celda ${destino.celda}`);
          return Response.json({ estado: 'sin-configurar' }, { status: 503 });
        }
        return api.fetch(paraLaApi(solicitud, destino, env.SECRETO_DESPACHO));
      }
      // Las páginas horneadas llegan con HU-T5.1.
      return sinTienda();
    },
  };
}

export default crearDespacho();
