/**
 * Copia del cuaderno en el Google Drive del productor (HU-E8.4, etapa 1; decisión del dueño,
 * 5 oct 2026). El CORE solo consigue el permiso: nunca ve ni guarda la copia, que va directo del
 * teléfono a Google.
 *
 *   app ──► GET  /api/core/drive/inicio?vuelta=<pantalla>&desafio=<sha256 del verificador>
 *           (cookie con state, verifier de PKCE, vuelta y desafío; 302 a Google)
 *   Google ► GET /api/core/drive/callback?code&state
 *           (canjea el code; 302 a <vuelta>#drive=<token sellado>)
 *   app ──► POST /api/core/drive/canje {sellado, verificador} → {acceso, vence}
 *
 * - Permiso `drive.file` (no sensible): la app solo ve los archivos que ella misma creó.
 * - `access_type` online: Google no entrega refresh token. El CORE no guarda ningún permiso de
 *   Drive: cada copia pide uno nuevo, de una hora.
 * - El token de Google no queda legible en ninguna URL (P13). Va sellado con AES-GCM y vence a los
 *   2 minutos. Solo se abre con el verificador que el teléfono guardó antes de salir, como en PKCE:
 *   quien copie el fragmento del historial no puede usarlo. No hay tablas nuevas.
 * - La clave del sello se deriva de `CORE_JWT_PRIVATE_KEY` con HKDF y una etiqueta propia: no
 *   hace falta otro secreto, y no sirve para firmar nada.
 * - Otro producto lo pide con `producto=<id>`: vuelve solo a un origen y una ruta de su app
 *   (`productos.json`), como al entrar. Sin `producto`, es el cuaderno, como siempre (P10: los
 *   cuadernos instalados no lo mandan).
 */
import { Google, generateCodeVerifier, generateState } from 'arctic';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { vueltaPermitida } from './entrar.ts';
import { type CatalogoDelCore, productoDe, vueltaDelProducto } from './productos.ts';

export const RUTA_CALLBACK_DRIVE = '/api/core/drive/callback';
export const ALCANCE_DRIVE = 'https://www.googleapis.com/auth/drive.file';
const COOKIE = 'agro_drive';
export const VIDA_SELLO_MS = 2 * 60 * 1000;

/** Lo único que el CORE necesita de Google para el Drive; las pruebas pasan uno falso. */
export interface ProveedorDrive {
  urlDeAutorizacion(state: string, verifier: string, redirect: string): URL;
  acceso(
    code: string,
    verifier: string,
    redirect: string,
  ): Promise<{ token: string; vence: number }>;
}

export function proveedorDrive(clienteId: string, secreto: string): ProveedorDrive {
  const cliente = (redirect: string) => new Google(clienteId, secreto, redirect);
  return {
    urlDeAutorizacion: (state, verifier, redirect) => {
      const url = cliente(redirect).createAuthorizationURL(state, verifier, [ALCANCE_DRIVE]);
      // Sin refresh token: nada de Drive queda guardado en el CORE.
      url.searchParams.set('access_type', 'online');
      return url;
    },
    async acceso(code, verifier, redirect) {
      const tokens = await cliente(redirect).validateAuthorizationCode(code, verifier);
      return { token: tokens.accessToken(), vence: tokens.accessTokenExpiresAt().getTime() };
    },
  };
}

export interface EntornoDrive {
  drive: ProveedorDrive;
  /** Material de la clave del sello (`CORE_JWT_PRIVATE_KEY`). */
  secreto: string;
  origenes: readonly string[];
  /** Los productos del CORE: de ahí salen los orígenes y las rutas de regreso de cada uno. */
  catalogo: CatalogoDelCore;
  ahora: () => number;
}

/** La pantalla a la que vuelve el permiso: la del producto que lo pidió, o la del cuaderno. */
function vueltaDeDrive(
  vuelta: string | undefined,
  producto: string | undefined,
  e: EntornoDrive,
): string | null {
  if (!producto) return vueltaPermitida(vuelta, e.origenes);
  const pedido = productoDe(e.catalogo, producto);
  return 'producto' in pedido ? vueltaDelProducto(vuelta, pedido.producto, e.origenes) : null;
}

const codificar = new TextEncoder();
const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
const desdeB64url = (s: string) =>
  Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));

export async function sha256B64url(texto: string): Promise<string> {
  return b64url(await crypto.subtle.digest('SHA-256', codificar.encode(texto)));
}

async function claveDelSello(secreto: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', codificar.encode(secreto), 'HKDF', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: codificar.encode('agro-core drive sello v1'),
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

interface Contenido {
  token: string;
  vence: number;
  desafio: string;
  sellado: number;
}

export async function sellar(secreto: string, contenido: Contenido): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await claveDelSello(secreto),
    codificar.encode(JSON.stringify(contenido)),
  );
  return `${b64url(iv)}.${b64url(cifrado)}`;
}

export class SelloInvalido extends Error {
  override name = 'SelloInvalido';
}

/** Abre el sello si es auténtico, no venció y el verificador es el del teléfono que lo pidió. */
export async function abrir(
  secreto: string,
  sellado: string,
  verificador: string,
  ahora: number,
): Promise<{ token: string; vence: number }> {
  const [iv, cifrado] = sellado.split('.');
  let contenido: Contenido;
  try {
    const plano = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: desdeB64url(iv ?? '') },
      await claveDelSello(secreto),
      desdeB64url(cifrado ?? ''),
    );
    contenido = JSON.parse(new TextDecoder().decode(plano)) as Contenido;
  } catch {
    throw new SelloInvalido('El permiso de Drive no es válido');
  }
  if (ahora - contenido.sellado > VIDA_SELLO_MS) {
    throw new SelloInvalido('El permiso de Drive venció; vuelve a intentarlo');
  }
  if ((await sha256B64url(verificador)) !== contenido.desafio) {
    throw new SelloInvalido('Este permiso de Drive se pidió desde otro teléfono');
  }
  return { token: contenido.token, vence: contenido.vence };
}

const redirectDe = (c: Context) => new URL(RUTA_CALLBACK_DRIVE, c.req.url).toString();

export function inicioDrive(c: Context, e: EntornoDrive): Response {
  const producto = c.req.query('producto') || undefined;
  const vuelta = vueltaDeDrive(c.req.query('vuelta'), producto, e);
  if (!vuelta) return c.text('Esta dirección de regreso no es de esta aplicación.', 400);
  const desafio = c.req.query('desafio') ?? '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(desafio)) return c.text('Falta el desafío del teléfono.', 400);
  const state = generateState();
  const verifier = generateCodeVerifier();
  setCookie(c, COOKIE, JSON.stringify({ state, verifier, vuelta, desafio, producto }), {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/api/core/drive/',
    maxAge: 600,
  });
  return c.redirect(e.drive.urlDeAutorizacion(state, verifier, redirectDe(c)).toString(), 302);
}

const volverConError = (c: Context, vuelta: string, motivo: string) =>
  c.redirect(`${vuelta}#drive-error=${motivo}`, 302);

export async function callbackDrive(c: Context, e: EntornoDrive): Promise<Response> {
  let guardado: {
    state?: string;
    verifier?: string;
    vuelta?: string;
    desafio?: string;
    producto?: string;
  } = {};
  try {
    guardado = JSON.parse(getCookie(c, COOKIE) ?? '{}') as typeof guardado;
  } catch {
    guardado = {};
  }
  deleteCookie(c, COOKIE, { path: '/api/core/drive/', secure: true });
  const vuelta = vueltaDeDrive(guardado.vuelta, guardado.producto, e);
  if (!vuelta || !guardado.state || !guardado.verifier || !guardado.desafio) {
    return c.text(
      'El permiso venció o se abrió en otro navegador. Vuelve a la aplicación e inténtalo otra vez.',
      400,
    );
  }
  if (c.req.query('error')) return volverConError(c, vuelta, 'cancelada');
  const code = c.req.query('code');
  if (!code || c.req.query('state') !== guardado.state)
    return volverConError(c, vuelta, 'invalida');
  try {
    const acceso = await e.drive.acceso(code, guardado.verifier, redirectDe(c));
    const sellado = await sellar(e.secreto, {
      ...acceso,
      desafio: guardado.desafio,
      sellado: e.ahora(),
    });
    return c.redirect(`${vuelta}#drive=${sellado}`, 302);
  } catch (error) {
    console.error('agro-core: Google no dio el permiso de Drive:', (error as Error).name);
    return volverConError(c, vuelta, 'google');
  }
}

export async function canjeDrive(c: Context, e: EntornoDrive): Promise<Response> {
  let datos: Record<string, unknown> = {};
  try {
    datos = (await c.req.json()) as Record<string, unknown>;
  } catch {
    datos = {};
  }
  const sellado = typeof datos['sellado'] === 'string' ? datos['sellado'] : '';
  const verificador = typeof datos['verificador'] === 'string' ? datos['verificador'] : '';
  if (!sellado || !verificador) {
    return c.json({ estado: 'invalido', motivo: 'Faltan el permiso o el verificador' }, 400);
  }
  try {
    const acceso = await abrir(e.secreto, sellado, verificador, e.ahora());
    return c.json({ acceso: acceso.token, vence: acceso.vence });
  } catch (error) {
    if (error instanceof SelloInvalido) {
      return c.json({ estado: 'invalido', motivo: error.message }, 400);
    }
    throw error;
  }
}
