/**
 * El despacho de la Tienda 3.0 (HU-T2.4 y HU-T5.1, TIENDA-3.0 §3.1, §3.3, §5.6 y §11.1): un solo
 * Worker para todas las tiendas, que **nunca toca la base**.
 *
 * - `Host` → caché en memoria de 30 s → KV `TIENDA_HOSTS` → la tienda, su celda, su shard y la
 *   versión publicada. Un error al leer el KV no se guarda en la caché (P7): la próxima visita
 *   vuelve a preguntar.
 * - Lo de la API (`/api/*`, `/mcp`, `/_m`) pasa a la API de su celda por el binding de servicio
 *   (`API_C1`), con el secreto del despacho y la tienda resuelta en `x-tienda`; las cabeceras
 *   internas que llegan de afuera se borran siempre (TIENDA §14.1). Nunca se redirige.
 * - Las páginas salen del almacén de la celda (`SITIOS`, R2): el manifiesto de la versión publicada
 *   (`sitios/<org>/<versión>/manifiesto.json`, que no cambia nunca y se guarda en memoria) dice la
 *   huella de cada ruta, y el archivo es `objetos/<hh>/<huella>`. Con `Accept: text/markdown`, el
 *   gemelo `.md` (`Vary: Accept`). Cada respuesta lleva las cabeceras de la vitrina.
 * - Un `Host` sin tienda: 404 «Esta dirección no tiene tienda». Una tienda sin versión publicada:
 *   404 «Esta tienda todavía no abre». Kill switches (HU-T2.7): `ks:tienda` y `ks:tienda:<org>`.
 * - Cada página dice dónde está su gemelo `.md` también en la cabecera `Link` (HU-T15.1, CA2).
 * - `/.well-known/security.txt` (RFC 9116) no se hornea: su `Expires` cambia con el día. Lo sirve el
 *   despacho con el correo del responsable de la plataforma, de su política (P2).
 *
 * Ningún identificador de cuenta, base o dominio en el código (ADR-6).
 */

import { crearLectorKillSwitch, type LectorKillSwitch } from '@ed1/kill-switch';
import politica from '../../../content/tienda/privacidad/politica.json' with { type: 'json' };
import { securityTxt } from '../../core/src/security-txt.ts';

export const CABECERA_DESPACHO = 'x-despacho';
export const CABECERA_TIENDA = 'x-tienda';
export const CACHE_MS = 30_000;

/** Lo que guarda `TIENDA_HOSTS` en `h:<hostname>` (TIENDA §5.6). */
export interface DestinoDeHost {
  org: string;
  celda: string;
  shard: string;
  /** La versión publicada; `null` mientras la tienda no publica. */
  version: number | null;
}

export interface LectorKv {
  get(clave: string): Promise<string | null>;
}

export interface Servicio {
  fetch(solicitud: Request): Promise<Response>;
}

/** Lo que el despacho usa de un bucket R2: leer un objeto por su clave. */
export interface Almacen {
  get(clave: string): Promise<{ text(): Promise<string> } | null>;
}

/** El manifiesto de una versión (`@ed1/tienda-horno`, `manifiesto()`). */
export interface Manifiesto {
  archivos: Record<string, { huella: string; tipo: string; bytes: number }>;
  huella: string;
}

export interface Env {
  TIENDA_HOSTS?: LectorKv;
  /** El KV de flags de la celda, con los kill switches (`ks:tienda`, `ks:tienda:<org>`). */
  FLAGS?: LectorKv;
  SECRETO_DESPACHO?: string;
  /** Un binding de servicio por celda (`API_C1`) y su almacén de sitios horneados (`SITIOS_C1`). */
  [binding: string]: unknown;
}

const CELDA = /^c[0-9]+$/;
const HUELLA = /^[0-9a-f]{64}$/;

/** Lee y valida una entrada del KV; una que no se puede leer cuenta como «sin tienda» (P1: se dice). */
export function destinoDe(texto: string | null): DestinoDeHost | null {
  if (texto === null) return null;
  try {
    const d = JSON.parse(texto) as Partial<DestinoDeHost>;
    const version = d.version ?? null;
    if (
      typeof d.org === 'string' &&
      typeof d.shard === 'string' &&
      CELDA.test(d.celda ?? '') &&
      (version === null || (Number.isInteger(version) && version > 0))
    ) {
      return { org: d.org, celda: d.celda as string, shard: d.shard, version };
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

/** Lo que va a la API: nunca se sirve del almacén ni se redirige. */
export const esDeLaApi = (ruta: string): boolean =>
  ruta.startsWith('/api/') || ruta === '/mcp' || ruta.startsWith('/mcp/') || ruta === '/_m';

/**
 * El archivo del manifiesto para una ruta: `/` y `/p/x/` son su `index.html` (o `index.md` si se
 * pide Markdown); una ruta con extensión, tal cual.
 */
export function archivoDeLaRuta(ruta: string, markdown: boolean): string {
  if (ruta.endsWith('/')) return `${ruta}index.${markdown ? 'md' : 'html'}`;
  return ruta;
}

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

const CABECERAS_DE_AVISO = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cache-control': 'public, max-age=60',
};

/** Las cabeceras de una página de la vitrina (TIENDA §11.4): CSP sin nada en línea ni de terceros. */
export const CABECERAS_DE_LA_VITRINA = {
  'content-security-policy':
    "default-src 'self'; img-src 'self' https://img.laboratorio-digital.app data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  // Sin includeSubDomains: los otros subdominios de un comercio no son nuestros (TIENDA §4.4).
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

export const sinTienda = (): Response =>
  new Response(
    pagina(
      'Esta dirección no tiene tienda',
      'Revisa que esté bien escrita. Si alguien te la compartió, pídele el enlace de nuevo.',
    ),
    { status: 404, headers: CABECERAS_DE_AVISO },
  );

const sinPublicar = (): Response =>
  new Response(
    pagina('Esta tienda todavía no abre', 'Vuelve pronto: está preparando su catálogo.'),
    { status: 404, headers: { ...CABECERAS_DE_AVISO, 'cache-control': 'no-store' } },
  );

const noEsta = (): Response =>
  new Response(
    pagina(
      'Esta página no existe',
      'Puede que el producto ya no esté. Vuelve a la portada de la tienda.',
    ),
    { status: 404, headers: CABECERAS_DE_AVISO },
  );

/** Con un kill switch apagado, o el KV o el almacén caídos: 503, sin caché y con `Retry-After`. */
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
      headers: { ...CABECERAS_DE_AVISO, 'cache-control': 'no-store', 'retry-after': '300' },
    },
  );

export function crearDespacho(opciones: { ahora?: () => number } = {}) {
  const ahora = opciones.ahora ?? (() => Date.now());
  const cache = new Map<string, { destino: DestinoDeHost | null; vence: number }>();
  /** Los manifiestos no cambian nunca: una versión publicada es inmutable. */
  const manifiestos = new Map<string, Manifiesto>();
  let lector: { kv: LectorKv; lector: LectorKillSwitch } | null = null;
  const apagado = (env: Env, clave: string) => {
    if (!env.FLAGS) return Promise.resolve(false);
    if (lector?.kv !== env.FLAGS) {
      lector = { kv: env.FLAGS, lector: crearLectorKillSwitch({ kv: env.FLAGS, ahora }) };
    }
    return lector.lector.apagado(clave);
  };

  /** La tienda del host; `undefined` si el KV falló (no se guarda: P7). */
  async function resolver(env: Env, host: string): Promise<DestinoDeHost | null | undefined> {
    const guardado = cache.get(host);
    if (guardado && guardado.vence > ahora()) return guardado.destino;
    if (!env.TIENDA_HOSTS) {
      console.error('tienda-sitio: falta el KV TIENDA_HOSTS');
      return null;
    }
    let texto: string | null;
    try {
      texto = await env.TIENDA_HOSTS.get(`h:${host}`);
    } catch (e) {
      console.error(`tienda-sitio: no se pudo leer TIENDA_HOSTS (${String(e)})`);
      return undefined;
    }
    const destino = destinoDe(texto);
    cache.set(host, { destino, vence: ahora() + CACHE_MS });
    return destino;
  }

  async function manifiestoDe(sitios: Almacen, org: string, version: number) {
    const clave = `sitios/${org}/${version}/manifiesto.json`;
    const guardado = manifiestos.get(clave);
    if (guardado) return guardado;
    const objeto = await sitios.get(clave);
    if (!objeto) return null;
    const m = JSON.parse(await objeto.text()) as Manifiesto;
    if (manifiestos.size > 500) manifiestos.clear();
    manifiestos.set(clave, m);
    return m;
  }

  async function servir(solicitud: Request, env: Env, destino: DestinoDeHost): Promise<Response> {
    if (destino.version === null) return sinPublicar();
    const sitios = env[`SITIOS_${destino.celda.toUpperCase()}`] as Almacen | undefined;
    if (!sitios) {
      console.error(`tienda-sitio: falta el almacén de la celda ${destino.celda}`);
      return enPausa(false);
    }
    const url = new URL(solicitud.url);
    const markdown = (solicitud.headers.get('accept') ?? '').includes('text/markdown');
    try {
      const m = await manifiestoDe(sitios, destino.org, destino.version);
      if (!m) {
        console.error(`tienda-sitio: falta el manifiesto de ${destino.org} v${destino.version}`);
        return enPausa(false);
      }
      let archivo = m.archivos[archivoDeLaRuta(url.pathname, markdown)];
      if (!archivo && !url.pathname.endsWith('/') && m.archivos[`${url.pathname}/index.html`]) {
        return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301);
      }
      if (!archivo && markdown) archivo = m.archivos[archivoDeLaRuta(url.pathname, false)];
      if (!archivo || !HUELLA.test(archivo.huella)) return noEsta();
      const gemelo =
        url.pathname.endsWith('/') && m.archivos[`${url.pathname}index.md`]
          ? { link: `<${url.pathname}index.md>; rel="alternate"; type="text/markdown"` }
          : {};
      const objeto = await sitios.get(`objetos/${archivo.huella.slice(0, 2)}/${archivo.huella}`);
      if (!objeto) {
        console.error(`tienda-sitio: falta el objeto ${archivo.huella}`);
        return enPausa(false);
      }
      return new Response(await objeto.text(), {
        headers: {
          ...CABECERAS_DE_LA_VITRINA,
          'content-type': archivo.tipo,
          'cache-control': 'public, max-age=60',
          vary: 'Accept',
          etag: `"${archivo.huella}"`,
          ...gemelo,
        },
      });
    } catch (e) {
      console.error(`tienda-sitio: el almacén falló (${String(e)})`);
      return enPausa(false);
    }
  }

  return {
    async fetch(solicitud: Request, env: Env): Promise<Response> {
      const url = new URL(solicitud.url);
      const destino = await resolver(env, url.hostname);
      if (destino === undefined) return enPausa(true);
      if (!destino) return sinTienda();
      if (await apagado(env, 'tienda')) return enPausa(true);
      if (await apagado(env, `tienda:${destino.org}`)) return enPausa(false);
      if (esDeLaApi(url.pathname)) {
        const api = env[`API_${destino.celda.toUpperCase()}`] as Servicio | undefined;
        if (!api || !env.SECRETO_DESPACHO) {
          console.error(`tienda-sitio: sin API o sin secreto para la celda ${destino.celda}`);
          return Response.json({ estado: 'sin-configurar' }, { status: 503 });
        }
        return api.fetch(paraLaApi(solicitud, destino, env.SECRETO_DESPACHO));
      }
      if (solicitud.method !== 'GET' && solicitud.method !== 'HEAD') {
        return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
      }
      if (url.pathname === '/.well-known/security.txt') {
        return new Response(
          securityTxt({
            correo: politica.responsable.correo,
            canonical: `https://${url.hostname}/.well-known/security.txt`,
            ahora: ahora(),
          }),
          {
            headers: {
              ...CABECERAS_DE_LA_VITRINA,
              'content-type': 'text/plain; charset=utf-8',
              'cache-control': 'public, max-age=3600',
            },
          },
        );
      }
      return servir(solicitud, env, destino);
    },
  };
}

export default crearDespacho();
