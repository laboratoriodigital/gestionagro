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
 * - `/_t/<release>/…`, los archivos comunes de la vitrina, salen de los assets sin pasar por aquí.
 *   Los de una release anterior ya no están en los assets: salen del almacén de la celda
 *   (`vitrina/<release>/…`, que sube cada despliegue), para que una página horneada con ella siga
 *   cargando sus estilos y su JavaScript mientras su tienda no se re-hornea (HU-T4.6, TIENDA §10.6).
 * - `/.well-known/security.txt` (RFC 9116) no se hornea: su `Expires` cambia con el día. Lo sirve el
 *   despacho con el correo del responsable de la plataforma, de su política (P2).
 *
 * Ningún identificador de cuenta, base o dominio en el código (ADR-6).
 */

import { crearLectorKillSwitch, type LectorKillSwitch } from '@ed1/kill-switch';
import { cspDeLaVitrina } from '@ed1/tienda-horno/csp';
import politica from '../../../content/tienda/privacidad/politica.json' with { type: 'json' };
import { securityTxt } from '../../core/src/security-txt.ts';

export const CABECERA_DESPACHO = 'x-despacho';
export const CABECERA_TIENDA = 'x-tienda';
/**
 * Bitácora tienda3 37: la IP del comprador, para los límites por IP de la API. La pone el despacho;
 * la que llega de afuera se borra, como las demás cabeceras internas. En la subsolicitud del binding
 * de servicio, `cf-connecting-ip` no es la del comprador, y los límites nunca se cumplían.
 */
export const CABECERA_IP = 'x-ip-del-comprador';
export const CACHE_MS = 30_000;

/** Lo que guarda `TIENDA_HOSTS` en `h:<hostname>` (TIENDA §5.6). */
export interface DestinoDeHost {
  org: string;
  celda: string;
  shard: string;
  /** La versión publicada; `null` mientras la tienda no publica. */
  version: number | null;
  /**
   * HU-T13.2: la dirección canónica de la tienda, si esta es un alias. Un alias responde 301 a ella,
   * con la ruta y la consulta intactas, salvo la API.
   */
  aliasDe?: string;
  /** HU-T13.6: la plataforma la suspendió; todas sus direcciones responden 451. */
  suspendida?: true;
}

/** Un hostname, para no redirigir a lo que no lo es aunque el KV lo diga (P1). */
const HOSTNAME = /^(?=.{1,253}$)(?:(?!-)[a-z0-9-]{1,63}(?<!-)\.)+[a-z0-9-]{2,63}$/;

export interface LectorKv {
  get(clave: string): Promise<string | null>;
}

export interface Servicio {
  fetch(solicitud: Request): Promise<Response>;
}

/** Lo que el despacho usa de un bucket R2: leer un objeto por su clave. */
export interface Almacen {
  get(
    clave: string,
  ): Promise<{ text(): Promise<string>; arrayBuffer?(): Promise<ArrayBuffer> } | null>;
}

/** Una ruta de la vitrina: `/_t/<release>/<archivo>`, con la release por su huella. */
const RUTA_DE_LA_VITRINA = /^\/_t\/([0-9a-f]{12})\/([a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.[a-z0-9]+)$/i;
const TIPOS_DE_LA_VITRINA: Record<string, string> = {
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  woff2: 'font/woff2',
  txt: 'text/plain; charset=utf-8',
};

/** El manifiesto de una versión (`@ed1/tienda-horno`, `manifiesto()`). */
export interface Manifiesto {
  archivos: Record<string, { huella: string; tipo: string; bytes: number }>;
  /** HU-T8.2 CA3: la dirección vieja de un producto y la de ahora. */
  redirecciones?: Record<string, string>;
  huella: string;
}

export interface Env {
  TIENDA_HOSTS?: LectorKv;
  /** El KV de flags de la celda, con los kill switches (`ks:tienda`, `ks:tienda:<org>`). */
  FLAGS?: LectorKv;
  SECRETO_DESPACHO?: string;
  /** El host público de las fotos (HU-T5.6), para la CSP. */
  MEDIOS?: string;
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
      const { rol, canonico, estado } = d as {
        rol?: unknown;
        canonico?: unknown;
        estado?: unknown;
      };
      const aliasDe =
        rol === 'alias' && typeof canonico === 'string' && HOSTNAME.test(canonico)
          ? canonico
          : undefined;
      return {
        org: d.org,
        celda: d.celda as string,
        shard: d.shard,
        version,
        ...(aliasDe ? { aliasDe } : {}),
        ...(estado === 'suspendida' ? { suspendida: true as const } : {}),
      };
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
  cabeceras.delete(CABECERA_IP);
  const ip = solicitud.headers.get('cf-connecting-ip');
  if (ip) cabeceras.set(CABECERA_IP, ip);
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

/**
 * Las cabeceras de una página de la vitrina (TIENDA §11.4): CSP sin nada en línea ni de terceros.
 * Las fotos, solo de su host (`MEDIOS`, HU-T5.6): el de producción o el de staging, nunca los dos.
 * El carrito suma Bold, para pagar en línea (HU-T11.4).
 */
export const cabecerasDeLaVitrina = (medios: string | undefined, ruta?: string) => ({
  'content-security-policy': cspDeLaVitrina(medios, ruta),
  // Sin includeSubDomains: los otros subdominios de un comercio no son nuestros (TIENDA §4.4).
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
});

/**
 * Las direcciones de la plataforma en la zona de las tiendas que no son tiendas: las de las fotos
 * (HU-T5.6). El comodín de las tiendas nuevas (HU-T13.4) también las cubre, y siguen a su origen sin
 * pasar por el despacho. Una prueba las ata a `MEDIOS_DE_LA_TIENDA` (P2).
 */
export const DIRECCIONES_DE_LA_PLATAFORMA: ReadonlySet<string> = new Set([
  'img.laboratorio-digital.app',
  'img--staging.laboratorio-digital.app',
]);

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

/**
 * HU-T8.6: la vista previa del comercio, en `/_vista/<huella del manifiesto>/`. La API guarda una
 * sola por tienda en `sitios/<org>/vista.json`, con su manifiesto, y vence a las 24 horas. Nunca
 * toca el puntero, la versión publicada ni su sitemap.
 */
export const RUTA_DE_LA_VISTA = /^\/_vista\/([0-9a-f]{64})(\/.*)?$/;
export const VIDA_DE_LA_VISTA_MS = 24 * 60 * 60 * 1000;
const PEDIR_EN_LA_VISTA =
  'Es una vista previa: aquí no se puede pedir ni pagar. Publica tu tienda para recibir pedidos.';

export interface VistaGuardada {
  huella: string;
  creada: string;
  manifiesto: Manifiesto;
}

/** Si la solicitud viene de una página de la vista previa de esta misma dirección. */
export function desdeLaVista(solicitud: Request): boolean {
  const desde = solicitud.headers.get('referer');
  if (!desde) return false;
  try {
    const r = new URL(desde);
    return r.host === new URL(solicitud.url).host && r.pathname.startsWith('/_vista/');
  } catch {
    return false;
  }
}

/**
 * Los enlaces de una página de la vista llevan a la misma vista: `href`, `src` y `action` que
 * empiezan en `/`, menos los archivos comunes de la vitrina (`/_t/`), que son los de siempre.
 */
export const conEnlacesDeLaVista = (html: string, huella: string): string =>
  html.replace(/(href|src|action)="\/(?!\/|_t\/)/g, `$1="/_vista/${huella}/`);

const vistaVencida = (): Response =>
  new Response(
    pagina(
      'Esta vista previa ya no está',
      'Las vistas previas duran un día. Pide otra desde el panel de tu tienda.',
    ),
    {
      status: 404,
      headers: { ...CABECERAS_DE_AVISO, 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
    },
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

/**
 * HU-T13.6: una tienda suspendida por la plataforma. 451 y una página neutra: no dice por qué ni
 * acusa a nadie, y no se guarda en caché para que levantarla se vea enseguida.
 */
export const suspendida = (): Response =>
  new Response(
    pagina(
      'Esta tienda no está disponible',
      'La plataforma la suspendió mientras revisa algo. Si compraste aquí, escríbele a la tienda por su WhatsApp.',
    ),
    { status: 451, headers: { ...CABECERAS_DE_AVISO, 'cache-control': 'no-store' } },
  );

export function crearDespacho(
  opciones: {
    ahora?: () => number;
    /** A quién va lo que no es del despacho; en el Worker, el `fetch` global, que va al origen. */
    alOrigen?: (s: Request) => Promise<Response>;
  } = {},
) {
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

  /** HU-T4.6 CA3: un archivo de una release que ya no está en los assets, desde el almacén. */
  async function servirRelease(env: Env, destino: DestinoDeHost, ruta: string): Promise<Response> {
    const m = RUTA_DE_LA_VITRINA.exec(ruta);
    const sitios = env[`SITIOS_${destino.celda.toUpperCase()}`] as Almacen | undefined;
    if (!m || !sitios) return new Response('No existe', { status: 404 });
    try {
      const objeto = await sitios.get(`vitrina/${m[1]}/${m[2]}`);
      if (!objeto?.arrayBuffer) return new Response('No existe', { status: 404 });
      const extension = (m[2] ?? '').slice((m[2] ?? '').lastIndexOf('.') + 1).toLowerCase();
      return new Response(await objeto.arrayBuffer(), {
        headers: {
          'content-type': TIPOS_DE_LA_VITRINA[extension] ?? 'application/octet-stream',
          'cache-control': 'public, max-age=31536000, immutable',
          'x-content-type-options': 'nosniff',
        },
      });
    } catch (e) {
      console.error(`tienda-sitio: el almacén falló con ${ruta} (${String(e)})`);
      return new Response('No disponible', { status: 503, headers: { 'retry-after': '60' } });
    }
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
      // HU-T8.2 CA3: la dirección vieja de un producto lleva a la nueva, horneada en el manifiesto.
      const salto = archivo
        ? undefined
        : (m.redirecciones?.[url.pathname] ?? m.redirecciones?.[`${url.pathname}/`]);
      // Solo a la ficha de un producto de esta misma tienda: nunca a otro origen.
      if (salto && /^\/p\/[a-z0-9-]+\/$/.test(salto))
        return Response.redirect(`${url.origin}${salto}${url.search}`, 301);
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
          ...cabecerasDeLaVitrina(env.MEDIOS, url.pathname),
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

  /** HU-T8.6: un archivo de la vista previa de la tienda, con sus enlaces dentro de ella. */
  async function servirVista(
    url: URL,
    env: Env,
    destino: DestinoDeHost,
    huella: string,
    resto: string | undefined,
  ): Promise<Response> {
    if (resto === undefined) return Response.redirect(`${url.origin}/_vista/${huella}/`, 302);
    const sitios = env[`SITIOS_${destino.celda.toUpperCase()}`] as Almacen | undefined;
    if (!sitios) return enPausa(false);
    try {
      const guardada = await sitios.get(`sitios/${destino.org}/vista.json`);
      const vista = guardada ? (JSON.parse(await guardada.text()) as VistaGuardada) : null;
      if (
        !vista ||
        vista.huella !== huella ||
        !(ahora() - Date.parse(vista.creada) < VIDA_DE_LA_VISTA_MS)
      )
        return vistaVencida();
      const m = vista.manifiesto;
      const archivo = m.archivos[archivoDeLaRuta(resto, false)];
      if (!archivo && !resto.endsWith('/') && m.archivos[`${resto}/index.html`])
        return Response.redirect(`${url.origin}/_vista/${huella}${resto}/`, 302);
      if (!archivo || !HUELLA.test(archivo.huella)) return noEsta();
      const objeto = await sitios.get(`objetos/${archivo.huella.slice(0, 2)}/${archivo.huella}`);
      if (!objeto) return vistaVencida();
      const texto = await objeto.text();
      return new Response(
        archivo.tipo.startsWith('text/html') ? conEnlacesDeLaVista(texto, huella) : texto,
        {
          headers: {
            ...cabecerasDeLaVitrina(env.MEDIOS, resto),
            'content-type': archivo.tipo,
            // CA2: ni a la caché ni a los buscadores.
            'cache-control': 'no-store',
            'x-robots-tag': 'noindex, nofollow',
          },
        },
      );
    } catch (e) {
      console.error(`tienda-sitio: la vista previa falló (${String(e)})`);
      return enPausa(false);
    }
  }

  return {
    async fetch(solicitud: Request, env: Env): Promise<Response> {
      const url = new URL(solicitud.url);
      if (DIRECCIONES_DE_LA_PLATAFORMA.has(url.hostname) || url.hostname === env.MEDIOS)
        return (opciones.alOrigen ?? fetch)(solicitud);
      const destino = await resolver(env, url.hostname);
      if (destino === undefined) return enPausa(true);
      if (!destino) return sinTienda();
      if (await apagado(env, 'tienda')) return enPausa(true);
      if (await apagado(env, `tienda:${destino.org}`)) return enPausa(false);
      if (destino.suspendida) return suspendida();
      // HU-T13.2: un alias lleva a la dirección canónica. La API nunca: un 301 a un POST, como el
      // aviso de Bold, no lo sigue cualquier cliente (CA2).
      if (destino.aliasDe && destino.aliasDe !== url.hostname && !esDeLaApi(url.pathname)) {
        return new Response(null, {
          status: 301,
          headers: {
            location: `https://${destino.aliasDe}${url.pathname}${url.search}`,
            'cache-control': 'public, max-age=3600',
          },
        });
      }
      if (esDeLaApi(url.pathname)) {
        // HU-T8.6: desde la vista previa no se pide, no se paga ni se mide.
        if (solicitud.method !== 'GET' && solicitud.method !== 'HEAD' && desdeLaVista(solicitud)) {
          return url.pathname === '/_m'
            ? new Response(null, { status: 204 })
            : Response.json(
                { estado: 'vista-previa', motivo: PEDIR_EN_LA_VISTA },
                { status: 403, headers: { 'cache-control': 'no-store' } },
              );
        }
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
      if (url.pathname.startsWith('/_t/')) return servirRelease(env, destino, url.pathname);
      const vista = RUTA_DE_LA_VISTA.exec(url.pathname);
      if (vista?.[1]) return servirVista(url, env, destino, vista[1], vista[2]);
      if (url.pathname === '/.well-known/security.txt') {
        return new Response(
          securityTxt({
            correo: politica.responsable.correo,
            canonical: `https://${url.hostname}/.well-known/security.txt`,
            ahora: ahora(),
          }),
          {
            headers: {
              ...cabecerasDeLaVitrina(env.MEDIOS),
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
