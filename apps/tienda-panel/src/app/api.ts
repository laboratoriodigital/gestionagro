/**
 * Hablar con la API de la tienda desde el panel (HU-T8.1): `/api/panel/v1/*`, en el mismo origen
 * (el Worker del panel la pasa a la celda), con el token en la cabecera.
 *
 * - Un acceso vencido se renueva antes de pedir; un 401 se renueva una vez y se repite, salvo
 *   `reautenticar` (HU-T10.3), que pide volver a entrar con Google.
 * - Si aun así no hay sesión, la respuesta es `sin-sesion` con el motivo: la pantalla dice «vuelve a
 *   entrar» sin perder lo que la persona estaba escribiendo (CA2), porque no navega ni recarga.
 * - «Sin tienda», «error» y «sin sesión» son estados distintos y se dicen distinto.
 */
import type { ValorDeFuncion } from '@ed1/tienda-schema';
import type { Almacen } from './almacen.ts';
import { estadoDeSesion, leerSesion, renovar, type Sesion } from './sesion.ts';

export type RespuestaDelPanel<T> =
  | { tipo: 'ok'; datos: T }
  | { tipo: 'sin-sesion'; motivo: string }
  | { tipo: 'sin-tienda'; motivo: string; estado?: never; problemas?: never; version?: never }
  | {
      tipo: 'error';
      motivo: string;
      /** Lo que dijo la API, cuando lo dijo: `problemas` (422), `cambiado` (409), `no-existe` (404). */
      estado?: string;
      problemas?: { campo: string; mensaje: string }[];
      /** Con `cambiado`: la versión que hay ahora, para volver a leer. */
      version?: number | null;
    };

/** `GET /api/panel/v1/yo`: la tienda de la sesión, el rol, el plan y lo que el plan permite. */
export interface Yo {
  org: string;
  rol: string;
  plan: string | null;
  funciones: Record<string, ValorDeFuncion> | null;
  tienda: { slug: string; nombre: string; estado: string } | null;
}

export interface Conexion {
  almacen: Almacen;
  core: string;
  fetchFn?: typeof fetch;
  ahora?: () => number;
}

const SIN_SESION = 'Tu sesión venció. Vuelve a entrar con Google.';

async function conAcceso(c: Conexion): Promise<{ sesion: Sesion | null; motivo: string | null }> {
  const sesion = await leerSesion(c.almacen);
  const estado = estadoDeSesion(sesion, (c.ahora ?? Date.now)());
  if (estado === 'activa') return { sesion, motivo: null };
  if (estado === 'sin-sesion' || estado === 'vencida') return { sesion: null, motivo: SIN_SESION };
  return renovar(c.almacen, c.core, { fetchFn: c.fetchFn ?? fetch });
}

export async function pedirAlPanel<T>(
  c: Conexion,
  ruta: string,
  opciones: { metodo?: 'GET' | 'POST'; cuerpo?: unknown; formulario?: FormData } = {},
): Promise<RespuestaDelPanel<T>> {
  const fetchFn = c.fetchFn ?? fetch;
  // HU-T8.3: las fotos van como formulario; el navegador pone su `content-type` con el límite.
  const cuerpo =
    opciones.formulario ??
    (opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo));
  const pedir = (acceso: string) =>
    fetchFn(`/api/panel/v1/${ruta}`, {
      method: opciones.metodo ?? (cuerpo === undefined ? 'GET' : 'POST'),
      headers: {
        authorization: `Bearer ${acceso}`,
        ...(opciones.cuerpo === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(cuerpo === undefined ? {} : { body: cuerpo }),
    });
  try {
    let { sesion, motivo } = await conAcceso(c);
    if (!sesion) return { tipo: 'sin-sesion', motivo: motivo ?? SIN_SESION };
    let r = await pedir(sesion.acceso);
    // HU-T10.3: «reautenticar» pide entrar con Google otra vez; renovar el acceso no lo arregla,
    // porque la entrada reciente es la de la cuenta, no la del acceso.
    const reautenticar =
      r.status === 401 &&
      (
        (await r
          .clone()
          .json()
          .catch(() => null)) as { estado?: string } | null
      )?.estado === 'reautenticar';
    if (r.status === 401 && !reautenticar) {
      ({ sesion, motivo } = await renovar(c.almacen, c.core, { fetchFn }));
      if (!sesion) return { tipo: 'sin-sesion', motivo: motivo ?? SIN_SESION };
      r = await pedir(sesion.acceso);
    }
    const datos = (await r.json().catch(() => ({}))) as T & {
      estado?: string;
      motivo?: string;
      problemas?: { campo: string; mensaje: string }[];
      version?: number | null;
    };
    if (r.ok) return { tipo: 'ok', datos };
    if (r.status === 401) return { tipo: 'sin-sesion', motivo: datos.motivo ?? SIN_SESION };
    if (r.status === 403 && datos.estado === 'sin-tienda') {
      return {
        tipo: 'sin-tienda',
        motivo: datos.motivo ?? 'Tu cuenta todavía no tiene una tienda.',
      };
    }
    if (r.status === 403 && datos.estado === 'otra-celda') {
      return { tipo: 'sin-sesion', motivo: datos.motivo ?? SIN_SESION };
    }
    // HU-T8.2: lo que el formulario necesita para decir qué corregir o que alguien más guardó.
    if (r.status === 422 && Array.isArray(datos.problemas)) {
      return {
        tipo: 'error',
        estado: 'problemas',
        problemas: datos.problemas,
        motivo:
          datos.problemas.length === 1
            ? 'Falta corregir una cosa.'
            : `Falta corregir ${datos.problemas.length} cosas.`,
      };
    }
    if (r.status === 409 && datos.estado === 'cambiado') {
      return {
        tipo: 'error',
        estado: 'cambiado',
        version: datos.version ?? null,
        motivo: datos.motivo ?? 'Alguien más cambió esto mientras lo editabas.',
      };
    }
    return {
      tipo: 'error',
      ...(r.status === 404 && datos.estado === 'no-existe' ? { estado: 'no-existe' } : {}),
      motivo: datos.motivo ?? `La tienda no respondió bien (${r.status}). Intenta de nuevo.`,
    };
  } catch (e) {
    return {
      tipo: 'error',
      motivo:
        e instanceof Error && e.name === 'ErrorDeSesion'
          ? e.message
          : 'Sin conexión: no pudimos hablar con tu tienda. Revisa la señal e intenta de nuevo.',
    };
  }
}
