/**
 * Entrar con Google (HU-E4.2, ARQUITECTURA §5.4): OIDC con PKCE, cliente confidencial en el CORE.
 *
 *   app ──► GET  /api/core/auth/google/inicio?vuelta=<pantalla de la app>
 *           (cookie con state, verifier y vuelta; 302 a Google)
 *   Google ► GET /api/core/auth/google/callback?code&state
 *           (canjea el code, crea usuario y sesión; 302 a <vuelta>#entrar=<código de un uso>)
 *   app ──► POST /api/core/auth/canje      {codigo, dispositivo}  → access + refresh
 *   app ──► POST /api/core/auth/refrescar  {refresh, org_id?}     → access (+ refresh si rotó)
 *
 * - Ningún token viaja en la URL (CA4, P13). El código de entrada va en el fragmento, sirve una
 *   vez y vence en 2 minutos; los tokens viajan en el cuerpo de un POST.
 * - `vuelta` solo puede ser una pantalla del cuaderno en un origen de `ORIGENES_APP`: sin eso,
 *   cualquiera podría mandar el código de entrada a su propio sitio.
 * - Nada de esto escribe tokens, códigos ni el `code` de Google en el log.
 */

import type { BaseD1 } from '@gestionagro/d1';
import { type Firmante, firmarAcceso } from '@gestionagro/tokens';
import { decodeIdToken, Google, generateCodeVerifier, generateState } from 'arctic';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { POLITICA_VIGENTE } from './politica.ts';
import {
  directorioDeUsuario,
  type EntradaDelDirectorio,
  usuarioDeIdentidad,
} from './repositorio.ts';
import {
  canjearCodigo,
  crearSesion,
  refrescar,
  type SesionActiva,
  SesionInvalida,
} from './sesiones.ts';

export const RUTA_CALLBACK = '/api/core/auth/google/callback';
const COOKIE = 'agro_oauth';

/** Lo único que el CORE necesita de Google; en las pruebas se reemplaza por uno falso. */
export interface ProveedorGoogle {
  urlDeAutorizacion(state: string, verifier: string, redirect: string): URL;
  identidad(
    code: string,
    verifier: string,
    redirect: string,
  ): Promise<{ sub: string; email: string; nombre: string }>;
}

export function proveedorGoogle(clienteId: string, secreto: string): ProveedorGoogle {
  const cliente = (redirect: string) => new Google(clienteId, secreto, redirect);
  return {
    urlDeAutorizacion: (state, verifier, redirect) =>
      cliente(redirect).createAuthorizationURL(state, verifier, ['openid', 'email', 'profile']),
    async identidad(code, verifier, redirect) {
      const tokens = await cliente(redirect).validateAuthorizationCode(code, verifier);
      // El id_token llega directo del endpoint de tokens de Google por TLS: no hace falta
      // verificar su firma (OIDC Core §3.1.3.7, punto 6).
      const reclamos = decodeIdToken(tokens.idToken()) as {
        sub?: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
      };
      if (!reclamos.sub || !reclamos.email || reclamos.email_verified === false) {
        throw new Error('Google no entregó una cuenta con correo verificado');
      }
      return { sub: reclamos.sub, email: reclamos.email, nombre: reclamos.name ?? reclamos.email };
    },
  };
}

export interface Entorno {
  db: BaseD1;
  firmante: Firmante;
  google: ProveedorGoogle;
  origenes: readonly string[];
  ahora: () => number;
}

/** La pantalla del cuaderno a la que se vuelve, o null si no es una pantalla permitida. */
export function vueltaPermitida(
  vuelta: string | undefined,
  origenes: readonly string[],
): string | null {
  if (!vuelta) return null;
  let url: URL;
  try {
    url = new URL(vuelta);
  } catch {
    return null;
  }
  if (!origenes.includes(url.origin) || !url.pathname.startsWith('/agro/app/')) return null;
  return `${url.origin}${url.pathname}`;
}

const redirectDe = (c: Context) => new URL(RUTA_CALLBACK, c.req.url).toString();

export function inicio(c: Context, e: Entorno): Response {
  const vuelta = vueltaPermitida(c.req.query('vuelta'), e.origenes);
  if (!vuelta) return c.text('Esta dirección de regreso no es del cuaderno.', 400);
  // HU-E0.5, CA3: sin aceptar la política vigente no se crea ni se abre una cuenta.
  const politica = c.req.query('politica');
  if (politica !== POLITICA_VIGENTE) {
    return c.text(
      `Para entrar, acepta la política de tratamiento de datos vigente (versión ${POLITICA_VIGENTE}) en el cuaderno.`,
      400,
    );
  }
  const state = generateState();
  const verifier = generateCodeVerifier();
  setCookie(c, COOKIE, JSON.stringify({ state, verifier, vuelta, politica }), {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/api/core/auth/',
    maxAge: 600,
  });
  return c.redirect(e.google.urlDeAutorizacion(state, verifier, redirectDe(c)).toString(), 302);
}

/** Vuelve a la app con un motivo corto en el fragmento; la app lo dice en palabras. */
const volverConError = (c: Context, vuelta: string, motivo: string) =>
  c.redirect(`${vuelta}#entrar-error=${motivo}`, 302);

export async function callback(c: Context, e: Entorno): Promise<Response> {
  let guardado: { state?: string; verifier?: string; vuelta?: string; politica?: string } = {};
  try {
    guardado = JSON.parse(getCookie(c, COOKIE) ?? '{}') as typeof guardado;
  } catch {
    guardado = {};
  }
  deleteCookie(c, COOKIE, { path: '/api/core/auth/', secure: true });
  const vuelta = vueltaPermitida(guardado.vuelta, e.origenes);
  if (!vuelta || !guardado.state || !guardado.verifier) {
    return c.text(
      'La entrada venció o se abrió en otro navegador. Vuelve al cuaderno y toca «Entrar con Google».',
      400,
    );
  }
  if (c.req.query('error')) return volverConError(c, vuelta, 'cancelada');
  const code = c.req.query('code');
  if (!code || c.req.query('state') !== guardado.state)
    return volverConError(c, vuelta, 'invalida');
  try {
    const persona = await e.google.identidad(code, guardado.verifier, redirectDe(c));
    const ahora = e.ahora();
    const usuario = await usuarioDeIdentidad(e.db, persona, () => ahora, guardado.politica ?? null);
    const codigo = await crearSesion(e.db, usuario.id, ahora);
    return c.redirect(`${vuelta}#entrar=${codigo}`, 302);
  } catch (error) {
    console.error('agro-core: no se pudo completar la entrada con Google:', (error as Error).name);
    return volverConError(c, vuelta, 'google');
  }
}

/**
 * Organización del token: la pedida (si es suya), la única que tiene, o ninguna. Pedir una ajena
 * no es un error que corte la respuesta: refrescar ya pudo rotar el refresh, y perderlo dejaría
 * al teléfono sin sesión. Se responde con la que corresponde y un aviso (P1: dicho, no callado).
 */
function elegirOrganizacion(
  directorio: readonly EntradaDelDirectorio[],
  pedida: string | undefined,
): { org: EntradaDelDirectorio | null; aviso: string | null } {
  const unica = directorio.length === 1 ? (directorio[0] ?? null) : null;
  if (!pedida) return { org: unica, aviso: null };
  const encontrada = directorio.find((d) => d.org_id === pedida);
  return encontrada
    ? { org: encontrada, aviso: null }
    : { org: unica, aviso: 'No perteneces a la organización pedida.' };
}

async function respuestaDeSesion(
  c: Context,
  e: Entorno,
  sesion: SesionActiva,
  pedida: string | undefined,
) {
  const directorio = await directorioDeUsuario(e.db, sesion.usuarioId);
  const { org, aviso } = elegirOrganizacion(directorio, pedida);
  const usuario = await e.db
    .prepare('SELECT nombre, email FROM usuario WHERE id = ?')
    .bind(sesion.usuarioId)
    .first<{ nombre: string; email: string }>();
  const acceso = await firmarAcceso(
    e.firmante,
    {
      sub: sesion.usuarioId,
      org: org?.org_id ?? null,
      rol: org?.rol ?? null,
      celda: org?.celda_id ?? null,
      shard: org?.shard ?? null,
      anillo: org?.anillo ?? null,
    },
    e.ahora(),
  );
  return c.json({
    acceso: acceso.token,
    acceso_vence: acceso.vence,
    refresh: sesion.refresh,
    refresh_vence: sesion.refreshVence,
    usuario,
    organizaciones: directorio.map(({ org_id, nombre, rol }) => ({ org_id, nombre, rol })),
    org_id: org?.org_id ?? null,
    /** API de la celda de esa organización: a dónde sincroniza el teléfono (HU-E5.2). */
    url_api: org?.url_api ?? null,
    aviso,
  });
}

async function cuerpo(c: Context): Promise<Record<string, unknown>> {
  try {
    const leido = (await c.req.json()) as unknown;
    return typeof leido === 'object' && leido !== null ? (leido as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const texto = (valor: unknown) =>
  typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;

export async function canje(c: Context, e: Entorno): Promise<Response> {
  const datos = await cuerpo(c);
  const codigo = texto(datos['codigo']);
  const dispositivo = texto(datos['dispositivo']);
  if (!codigo || !dispositivo)
    return c.json({ estado: 'invalido', motivo: 'Faltan el código o el teléfono' }, 400);
  try {
    return await respuestaDeSesion(
      c,
      e,
      await canjearCodigo(e.db, codigo, dispositivo, e.ahora()),
      undefined,
    );
  } catch (error) {
    if (error instanceof SesionInvalida)
      return c.json({ estado: 'sin-sesion', motivo: error.message }, 401);
    throw error;
  }
}

export async function renovar(c: Context, e: Entorno): Promise<Response> {
  const datos = await cuerpo(c);
  const refresh = texto(datos['refresh']);
  if (!refresh) return c.json({ estado: 'invalido', motivo: 'Falta el refresh' }, 400);
  try {
    return await respuestaDeSesion(
      c,
      e,
      await refrescar(e.db, refresh, e.ahora()),
      texto(datos['org_id']),
    );
  } catch (error) {
    if (error instanceof SesionInvalida)
      return c.json({ estado: 'sin-sesion', motivo: error.message }, 401);
    throw error;
  }
}
