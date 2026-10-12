/**
 * Piezas del despliegue por celdas (HU-E1.5). Funciones puras o con `fetch` inyectado, para
 * probarlas sin tocar Cloudflare.
 */
import { POLITICA_VIGENTE } from '../../apps/core/src/politica.ts';
import { RUTAS_APP, rutaDe } from '../../apps/cuaderno/src/rutas.ts';
import { type Agentes, robotsTxt } from '../../apps/sitio/src/lib/robots.ts';
import { SITIO } from '../../apps/sitio/src/lib/seo.ts';
import agentes from '../../content/agentes.json' with { type: 'json' };
import type { Celda } from './celdas.ts';

export type Destino = 'staging' | 'produccion';
export type Fetch = typeof fetch;

const API = 'https://api.cloudflare.com/client/v4';

// biome-ignore lint/suspicious/noControlCharactersInRegex: quita los códigos de color ANSI
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

/**
 * Qué hacer ante errores de Cloudflare **ya vistos** en una corrida real, por código (P15).
 * Solo entra un código que se observó: uno supuesto mandaría a hacer lo que no es (P1).
 */
export const ACCIONES_POR_CODIGO: Readonly<Record<string, string>> = {
  // Visto el 1 oct 2026 en el primer despliegue a staging (bitácora agro 11).
  '10089':
    'Activa Analytics Engine creando sus datasets: Cloudflare → Workers & Pages → Analytics Engine → crear dataset, con los nombres de «dataset_eventos» en infrastructure/celdas.json (y el mismo con «_staging» al final). Es gratis dentro de la cuota (ED1 §41).',
};

/**
 * Causa de una falla de `wrangler deploy`, para el resumen de la corrida: el mensaje de error tal
 * cual (P15: se cita el síntoma) y, si el código es conocido, qué hacer. Nada de «ver el registro».
 */
export function causaDeWrangler(salida: string): string[] {
  const lineas = salida.replace(ANSI, '').split(/\r?\n/);
  const inicio = lineas.findIndex((l) => /\[ERROR\]/.test(l));
  if (inicio < 0) return ['sin mensaje de error de wrangler; revisa el registro de la corrida'];
  const bloque: string[] = [];
  for (const l of lineas.slice(inicio, inicio + 6)) {
    const limpia = l.replace(/^[\s✘]*\[ERROR\]\s*/, '').trim();
    if (!limpia || /^If you think this is a bug|^🪵/.test(limpia)) continue;
    bloque.push(limpia);
  }
  const codigo = bloque.join(' ').match(/\[code: (\d+)\]/)?.[1];
  const accion = codigo ? ACCIONES_POR_CODIGO[codigo] : undefined;
  return accion ? [...bloque, `Qué hacer: ${accion}`] : bloque;
}

interface RespuestaCf {
  success?: boolean;
  result?: unknown;
  errors?: { code: number; message: string }[];
}

async function leer(
  fetchFn: Fetch,
  url: string,
  token: string,
): Promise<{ estado: number; cuerpo: RespuestaCf }> {
  const r = await fetchFn(url, { headers: { authorization: `Bearer ${token}` } });
  let cuerpo: RespuestaCf = {};
  try {
    cuerpo = (await r.json()) as RespuestaCf;
  } catch {
    cuerpo = { success: false, errors: [{ code: r.status, message: 'respuesta que no es JSON' }] };
  }
  return { estado: r.status, cuerpo };
}

/**
 * P12: el permiso que se comprueba es el que se usa. Antes de desplegar, se lee lo mismo que el
 * despliegue va a tocar, y una falla nombra la celda y el permiso exacto que falta.
 */
export async function verificarToken(
  fetchFn: Fetch,
  celda: Celda,
  token: string | undefined,
  cuenta: string | undefined,
  destino: Destino,
  /** Las zonas con dominio propio que despliega esta celda: el sitio y, si lo aloja, el CORE. */
  zona: string | readonly string[],
  /** El despliegue crea y migra bases D1 en esta celda (CORE, HU-E4.1; shards, HU-E5.1). */
  conD1 = false,
): Promise<string[]> {
  if (!token) return [`${celda.id}: falta el secreto ${celda.secretos.token} en GitHub`];
  if (!cuenta) return [`${celda.id}: falta el secreto ${celda.secretos.cuenta} en GitHub`];

  const verificacion = await leer(fetchFn, `${API}/user/tokens/verify`, token);
  const estadoToken = (verificacion.cuerpo.result as { status?: string } | undefined)?.status;
  if (verificacion.estado !== 200 || estadoToken !== 'active') {
    return [
      `${celda.id}: el token ${celda.secretos.token} no es válido o está vencido (${estadoToken ?? verificacion.estado})`,
    ];
  }

  const fallas: string[] = [];
  const scripts = await leer(fetchFn, `${API}/accounts/${cuenta}/workers/scripts`, token);
  if (scripts.estado === 403 || scripts.estado === 401) {
    fallas.push(
      `${celda.id}: al token le falta «Account → Workers Scripts: Edit» en la cuenta ${celda.cuenta}`,
    );
  } else if (scripts.estado === 404 || (scripts.cuerpo.errors ?? []).some((e) => e.code === 7003)) {
    fallas.push(
      `${celda.id}: la cuenta de ${celda.secretos.cuenta} no existe o el token no tiene acceso a ella`,
    );
  } else if (scripts.estado !== 200) {
    fallas.push(`${celda.id}: no se pudo leer los Workers de la cuenta (HTTP ${scripts.estado})`);
  }

  // HU-E8.1: el despliegue crea el KV de flags y sus claves de kill switch.
  const kv = await leer(
    fetchFn,
    `${API}/accounts/${cuenta}/storage/kv/namespaces?per_page=1`,
    token,
  );
  if (kv.estado === 403 || kv.estado === 401) {
    fallas.push(
      `${celda.id}: al token le falta «Account → Workers KV Storage: Edit» en la cuenta ${celda.cuenta}`,
    );
  } else if (kv.estado !== 200) {
    fallas.push(`${celda.id}: no se pudo leer los KV de la cuenta (HTTP ${kv.estado})`);
  }

  if (conD1) {
    const d1 = await leer(fetchFn, `${API}/accounts/${cuenta}/d1/database?per_page=1`, token);
    if (d1.estado === 403 || d1.estado === 401) {
      fallas.push(
        `${celda.id}: al token le falta «Account → D1: Edit» en la cuenta ${celda.cuenta}`,
      );
    } else if (d1.estado !== 200) {
      fallas.push(`${celda.id}: no se pudo leer las bases D1 de la cuenta (HTTP ${d1.estado})`);
    }
  }

  for (const z of destino === 'produccion' ? [zona].flat() : []) {
    const zonas = await leer(fetchFn, `${API}/zones?name=${encodeURIComponent(z)}`, token);
    const lista = (zonas.cuerpo.result as { id: string }[] | undefined) ?? [];
    const zonaId = lista[0]?.id;
    if (zonas.estado !== 200 || !zonaId) {
      fallas.push(
        `${celda.id}: el token no ve la zona ${z}; le falta «Zone → Workers Routes: Edit» en esa zona`,
      );
    } else {
      const rutas = await leer(fetchFn, `${API}/zones/${zonaId}/workers/routes`, token);
      if (rutas.estado !== 200) {
        fallas.push(
          `${celda.id}: al token le falta «Zone → Workers Routes: Edit» en ${z} (HTTP ${rutas.estado})`,
        );
      }
    }
  }
  return fallas;
}

/**
 * Prueba de humo después de desplegar (CA5). Solo lee páginas públicas y comprueba que la API
 * rechaza lo inválido: nunca escribe un evento ni toca datos de una finca real (P11).
 */
export async function humo(fetchFn: Fetch, base: string): Promise<string[]> {
  const fallas: string[] = [];
  const pedir = async (ruta: string, init?: RequestInit) => {
    try {
      return await fetchFn(`${base}${ruta}`, { redirect: 'manual', ...init });
    } catch (e) {
      fallas.push(`${ruta}: no respondió (${(e as Error).message})`);
      return null;
    }
  };
  const contiene = async (ruta: string, texto: string) => {
    const r = await pedir(ruta);
    if (!r) return;
    if (r.status !== 200) {
      fallas.push(`${ruta}: respondió ${r.status}, se esperaba 200`);
      return;
    }
    const cuerpo = await r.text();
    if (!cuerpo.includes(texto)) fallas.push(`${ruta}: no contiene «${texto}»`);
  };
  // La raíz redirige de verdad (HTTP 301 por _redirects), sin página intermedia.
  const raiz = await pedir('/');
  if (raiz) {
    const destinoRaiz = raiz.headers.get('location') ?? '';
    if (
      ![301, 302, 307, 308].includes(raiz.status) ||
      !destinoRaiz.endsWith('/herramientas/agro/')
    ) {
      fallas.push(
        `/: respondió ${raiz.status} hacia «${destinoRaiz}», se esperaba una redirección a /herramientas/agro/`,
      );
    }
  }
  await contiene('/herramientas/agro/', 'Herramientas agronómicas');
  await contiene('/herramientas/agro/calculadora-dpv/', 'Calculadora de DPV');
  // Cada ruta del cuaderno abre con un enlace directo, sin service worker todavía.
  for (const { segmento } of RUTAS_APP) await contiene(rutaDe(segmento), 'noindex');
  await contiene('/agro/app/manifest.webmanifest', '"scope":"/agro/app/"');
  // La CSP del cuaderno llega de verdad, también en la raíz /agro/app/ (HU-E0.5, P16).
  const app = await pedir('/agro/app/');
  if (app && !(app.headers.get('content-security-policy') ?? '').includes("connect-src 'self'")) {
    fallas.push('/agro/app/: no trae la cabecera Content-Security-Policy del cuaderno (_headers)');
  }
  await contiene('/agro/app/sw.js', 'precache');
  // HU-C8.1 CA2: el robots.txt publicado es exactamente el de content/agentes.json.
  const robots = await pedir('/robots.txt');
  if (robots && (await robots.text()) !== robotsTxt(agentes as Agentes, SITIO)) {
    fallas.push('/robots.txt: no es el que sale de content/agentes.json (¿editado a mano?)');
  }
  const get = await pedir('/api/eventos');
  if (get && get.status !== 405)
    fallas.push(`/api/eventos (GET): respondió ${get.status}, se esperaba 405`);
  const invalido = await pedir('/api/eventos', { method: 'POST', body: '{roto' });
  if (invalido && invalido.status !== 400) {
    fallas.push(`/api/eventos (POST inválido): respondió ${invalido.status}, se esperaba 400`);
  }
  return fallas;
}

/**
 * Prueba de humo del CORE (HU-E4.1): la base responde, tiene las migraciones y el directorio
 * tiene las celdas activas de celdas.json. Solo lee.
 */
/**
 * HU-C3.7, CA3: en producción, entrar a un producto de prueba responde que no existe. Es la segunda
 * red de la revisión de la base: esta mira lo que el Worker atiende de verdad.
 */
export async function humoSinProductosDePrueba(
  fetchFn: Fetch,
  base: string,
  dePrueba: readonly string[],
): Promise<string[]> {
  const fallas: string[] = [];
  for (const id of dePrueba) {
    const ruta = `/api/core/auth/google/inicio?producto=${encodeURIComponent(id)}`;
    try {
      const r = await fetchFn(`${base}${ruta}`, { redirect: 'manual' });
      const texto = await r.text();
      if (r.status !== 400 || !texto.includes('no existe')) {
        fallas.push(
          `${ruta}: respondió ${r.status}; el producto de prueba «${id}» no debe existir en producción`,
        );
      }
    } catch (e) {
      fallas.push(`${ruta}: no respondió (${(e as Error).message})`);
    }
  }
  return fallas;
}

export async function humoCore(
  fetchFn: Fetch,
  base: string,
  celdasActivas: number,
): Promise<string[]> {
  const ruta = '/api/core/salud';
  let r: Response;
  try {
    r = await fetchFn(`${base}${ruta}`);
  } catch (e) {
    return [`${ruta}: no respondió (${(e as Error).message})`];
  }
  let cuerpo: { estado?: string; motivo?: string; celdas?: number } = {};
  try {
    cuerpo = (await r.json()) as typeof cuerpo;
  } catch {
    return [`${ruta}: respondió ${r.status} sin JSON`];
  }
  if (r.status !== 200) {
    return [
      `${ruta}: respondió ${r.status} (${cuerpo.estado ?? '?'}: ${cuerpo.motivo ?? 'sin motivo'})`,
    ];
  }
  if (cuerpo.celdas !== celdasActivas) {
    return [
      `${ruta}: el directorio tiene ${String(cuerpo.celdas)} celdas activas y celdas.json ${celdasActivas}`,
    ];
  }
  return [];
}

/**
 * Prueba de humo de «entrar con Google» (HU-E4.2). Sin iniciar sesión: comprueba que hay clave
 * pública y que el inicio manda a Google con el cliente de los secretos y la dirección de regreso
 * que se registró en Google Cloud. No sigue la redirección ni crea usuarios (P11).
 */
export async function humoEntrar(
  fetchFn: Fetch,
  base: string,
  esperado: { clienteId: string; origenApp: string },
): Promise<string[]> {
  const fallas: string[] = [];
  try {
    const claves = await fetchFn(`${base}/api/core/claves`);
    const cuerpo = (await claves.json().catch(() => ({}))) as { claves?: unknown[] };
    if (claves.status !== 200 || cuerpo.claves?.length !== 1) {
      fallas.push(`/api/core/claves: respondió ${claves.status} sin una clave pública`);
    }
    const vuelta = encodeURIComponent(`${esperado.origenApp}/agro/app/cuenta/`);
    const inicio = await fetchFn(
      `${base}/api/core/auth/google/inicio?vuelta=${vuelta}&politica=${POLITICA_VIGENTE}`,
      {
        redirect: 'manual',
      },
    );
    const destino = new URL(inicio.headers.get('location') || 'about:blank');
    const callback = `${base}/api/core/auth/google/callback`;
    if (inicio.status !== 302 || destino.hostname !== 'accounts.google.com') {
      fallas.push(`entrar: respondió ${inicio.status}, se esperaba 302 a accounts.google.com`);
    } else if (destino.searchParams.get('client_id') !== esperado.clienteId) {
      fallas.push('entrar: Google recibe otro client_id que el del secreto GOOGLE_CLIENT_ID');
    } else if (destino.searchParams.get('redirect_uri') !== callback) {
      fallas.push(
        `entrar: la dirección de regreso es ${destino.searchParams.get('redirect_uri')}, se esperaba ${callback}`,
      );
    }
  } catch (e) {
    fallas.push(`entrar: no respondió (${(e as Error).message})`);
  }
  return fallas;
}

/** URL de workers.dev que imprime `wrangler deploy` en staging. */
export function urlDeWorkersDev(salida: string): string | null {
  return salida.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/)?.[0] ?? null;
}

export type EstadoCelda = 'desplegada' | 'fallo' | 'sin-tocar' | 'fuera';

export interface ResultadoCelda {
  celda: string;
  estado: EstadoCelda;
  detalle: string[];
}

/** Resumen para la persona que mira la corrida (P15): qué pasó en cada celda y cómo seguir. */
export function resumenDespliegue(destino: Destino, resultados: readonly ResultadoCelda[]): string {
  const icono: Record<EstadoCelda, string> = {
    desplegada: '✅',
    fallo: '❌',
    'sin-tocar': '⏸️',
    fuera: '🚫',
  };
  const filas = resultados.map(
    (r) => `| ${icono[r.estado]} | ${r.celda} | ${r.estado} | ${r.detalle.join('<br>') || '—'} |`,
  );
  const fallida = resultados.find((r) => r.estado === 'fallo');
  const sinTocar = resultados.filter((r) => r.estado === 'sin-tocar').map((r) => r.celda);
  const cierre = fallida
    ? [
        `El despliegue a ${destino} se detuvo en **${fallida.celda}**.`,
        sinTocar.length > 0
          ? `Quedaron sin tocar: ${sinTocar.join(', ')}.`
          : 'No quedaron celdas sin tocar.',
        `Para seguir: corrige la causa y vuelve a correr el flujo «desplegar» con «solo_celda: ${fallida.celda}»; o marca la celda \`"estado": "fuera"\` en infrastructure/celdas.json si no debe recibir este reparto.`,
      ].join(' ')
    : `Despliegue a ${destino} completo.`;
  return [
    `## Despliegue a ${destino}`,
    '',
    '| | Celda | Estado | Detalle |',
    '|---|---|---|---|',
    ...filas,
    '',
    cierre,
  ].join('\n');
}
