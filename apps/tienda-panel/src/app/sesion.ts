/**
 * La sesión del panel (HU-T8.1, TIENDA-3.0 §12.1). Es el patrón del cuaderno y de la caja
 * (`apps/cuaderno/src/almacen/sesion.ts`) con el producto `tienda`:
 *
 * - **Entrar:** la cuenta del CORE con `producto=tienda` y la política vigente; el CORE vuelve a la
 *   pantalla de la que se salió con `#entrar=<código>`. El código se borra de la barra **antes** de
 *   canjearlo, para que no quede en el historial (P13).
 * - **Los tokens viven en IndexedDB** (`almacen.ts`), nunca en `localStorage`, una cookie ni una URL.
 * - **Elegir la tienda:** con varias, el token no trae ninguna hasta que la persona elige; elegir es
 *   renovar la sesión hacia esa tienda.
 * - **Un token de otro producto no abre el panel (CA3):** si el CORE entregara uno con otra
 *   audiencia, no se guarda. La API, además, lo rechaza por su cuenta (HU-T2.8).
 *
 * Todo lo que habla con la red recibe su `fetch` y su reloj, para probarlo sin navegador.
 */
import politica from '../../../../content/tienda/privacidad/politica.json' with { type: 'json' };
import type { Almacen } from './almacen.ts';

/** La versión de la política que se acepta al entrar: la misma que pide el CORE (HU-E0.5 CA3). */
export const VERSION_DE_LA_POLITICA: string = politica.version;
export const PRODUCTO = 'tienda';
const CLAVE_SESION = 'sesion';
const CLAVE_DISPOSITIVO = 'dispositivo';

export interface TiendaDeLaCuenta {
  org_id: string;
  nombre: string;
  rol: string;
  plan?: string;
  plan_vence?: string | null;
  aviso?: string | null;
}

export interface Sesion {
  acceso: string;
  /** Instantes en milisegundos, como los da el CORE. */
  acceso_vence: number;
  refresh: string;
  refresh_vence: number;
  usuario: { nombre: string; email: string };
  organizaciones: TiendaDeLaCuenta[];
  /** La tienda del token; `null` mientras la persona no elige una. */
  org_id: string | null;
}

type RespuestaDelCore = Omit<Sesion, 'refresh'> & { refresh: string | null };

/** El CORE de este panel: el de producción en su dominio, el de staging en cualquier otro. */
export function urlDelCore(
  hostname: string,
  config: { panel: string; url: string; url_staging: string },
): string {
  return hostname === config.panel ? config.url : config.url_staging;
}

/** Adónde lleva «Entrar con Google». `vuelta` es la pantalla en la que estaba la persona. */
export function urlDeEntrada(core: string, vuelta: string): string {
  const q = new URLSearchParams({
    producto: PRODUCTO,
    vuelta,
    politica: VERSION_DE_LA_POLITICA,
  });
  return `${core}/api/core/auth/google/inicio?${q}`;
}

export type Regreso = { codigo: string } | { error: string } | null;

/** Lo que trajo el fragmento al volver de la cuenta. */
export function leerRegreso(fragmento: string): Regreso {
  const datos = new URLSearchParams(fragmento.replace(/^#/, ''));
  const codigo = datos.get('entrar');
  if (codigo) return { codigo };
  const error = datos.get('entrar-error');
  return error ? { error } : null;
}

export const MENSAJES_DE_ERROR: Readonly<Record<string, string>> = {
  cancelada: 'Cancelaste la entrada con Google. Puedes intentarlo cuando quieras.',
  invalida: 'No se pudo comprobar la entrada. Toca «Entrar con Google» otra vez.',
  google: 'Google no respondió bien. Intenta de nuevo en un momento.',
};

export class ErrorDeSesion extends Error {
  override name = 'ErrorDeSesion';
}

/** La audiencia de un token, sin verificarlo: la firma la verifica la API (HU-T2.8). */
export function audienciaDe(token: string): string | null {
  const carga = token.split('.')[1];
  if (!carga) return null;
  try {
    const json = atob(carga.replace(/-/g, '+').replace(/_/g, '/'));
    const aud = (JSON.parse(json) as { aud?: unknown }).aud;
    return typeof aud === 'string' ? aud : null;
  } catch {
    return null;
  }
}

export const OTRA_APLICACION =
  'Esa sesión es de otra aplicación. Entra con Google desde aquí para abrir tu tienda en TiendaPro.';

export type EstadoDeSesion = 'sin-sesion' | 'activa' | 'por-renovar' | 'vencida';

export function estadoDeSesion(sesion: Sesion | null, ahora: number): EstadoDeSesion {
  if (!sesion) return 'sin-sesion';
  if (sesion.refresh_vence <= ahora) return 'vencida';
  return sesion.acceso_vence > ahora ? 'activa' : 'por-renovar';
}

/** Qué pantalla toca con esta sesión (HU-T8.1, el boceto): cada caso dice algo distinto. */
export type Pantalla = 'entrar' | 'sin-tienda' | 'elegir' | 'panel';

export function pantallaDe(sesion: Sesion | null): Pantalla {
  if (!sesion) return 'entrar';
  if (sesion.organizaciones.length === 0) return 'sin-tienda';
  return sesion.org_id ? 'panel' : 'elegir';
}

export const leerSesion = (almacen: Almacen) => almacen.leer<Sesion>(CLAVE_SESION);
export const salir = (almacen: Almacen) => almacen.borrar(CLAVE_SESION);

async function dispositivo(almacen: Almacen): Promise<string> {
  const guardado = await almacen.leer<string>(CLAVE_DISPOSITIVO);
  if (guardado) return guardado;
  const nuevo = crypto.randomUUID();
  await almacen.guardar(CLAVE_DISPOSITIVO, nuevo);
  return nuevo;
}

async function alCore(
  fetchFn: typeof fetch,
  url: string,
  cuerpo: Record<string, unknown>,
): Promise<{ estado: number; datos: Partial<RespuestaDelCore> & { motivo?: string } }> {
  let r: Response;
  try {
    r = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorDeSesion('Sin conexión: no pudimos hablar con tu cuenta. Revisa la señal.');
  }
  const datos = (await r.json().catch(() => ({}))) as Partial<RespuestaDelCore> & {
    motivo?: string;
  };
  return { estado: r.status, datos };
}

/** Guarda lo que respondió el CORE, solo si es una sesión de la Tienda (CA3). */
async function guardarDelCore(
  almacen: Almacen,
  datos: Partial<RespuestaDelCore>,
  refreshAnterior: string | null,
): Promise<Sesion> {
  const refresh = datos.refresh ?? refreshAnterior;
  if (!datos.acceso || !refresh || !datos.organizaciones) {
    throw new ErrorDeSesion('Tu cuenta no entregó la sesión. Intenta entrar otra vez.');
  }
  if (audienciaDe(datos.acceso) !== PRODUCTO) {
    await salir(almacen);
    throw new ErrorDeSesion(OTRA_APLICACION);
  }
  const sesion = { ...(datos as RespuestaDelCore), refresh };
  await almacen.guardar(CLAVE_SESION, sesion);
  return sesion;
}

/** Canjea el código de un uso que trajo el fragmento. */
export async function canjear(
  almacen: Almacen,
  core: string,
  codigo: string,
  fetchFn: typeof fetch = fetch,
): Promise<Sesion> {
  const { estado, datos } = await alCore(fetchFn, `${core}/api/core/auth/canje`, {
    codigo,
    dispositivo: await dispositivo(almacen),
  });
  if (estado !== 200) {
    throw new ErrorDeSesion(
      estado === 403 ? OTRA_APLICACION : (datos.motivo ?? 'No se pudo entrar. Intenta otra vez.'),
    );
  }
  return guardarDelCore(almacen, datos, null);
}

/**
 * Renueva el acceso, hacia `org` si se pide (elegir la tienda). Si el CORE dice que la sesión ya no
 * sirve, se borra y se dice por qué; sin red, la sesión sigue como está.
 */
export async function renovar(
  almacen: Almacen,
  core: string,
  opciones: { org?: string | null; fetchFn?: typeof fetch } = {},
): Promise<{ sesion: Sesion | null; motivo: string | null }> {
  const sesion = await leerSesion(almacen);
  if (!sesion) return { sesion: null, motivo: null };
  const org = opciones.org ?? sesion.org_id;
  const { estado, datos } = await alCore(
    opciones.fetchFn ?? fetch,
    `${core}/api/core/auth/refrescar`,
    { refresh: sesion.refresh, ...(org ? { org_id: org } : {}) },
  );
  if (estado === 401 || estado === 403) {
    await salir(almacen);
    return {
      sesion: null,
      motivo:
        estado === 403
          ? OTRA_APLICACION
          : (datos.motivo ?? 'Tu sesión venció. Vuelve a entrar con Google.'),
    };
  }
  if (estado !== 200) return { sesion, motivo: null };
  return { sesion: await guardarDelCore(almacen, datos, sesion.refresh), motivo: null };
}
