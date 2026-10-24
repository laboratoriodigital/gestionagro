/**
 * La sesión de la cuenta en el teléfono (HU-E4.2). La cuenta es opcional: sin ella el cuaderno
 * registra igual (ARQUITECTURA §5.3, regla 2; ED1 §28).
 *
 * - Los tokens viven en la base local (`meta`, clave `sesion`), nunca en `localStorage` ni en una
 *   URL (CA4, P13). `meta` no viaja en los respaldos: los tokens no salen en un archivo.
 * - El código de entrada llega en el fragmento `#entrar=…`; se borra de la barra de direcciones
 *   **antes** de canjearlo, para que no quede en el historial.
 * - Sin señal y con el access vencido, la sesión no es un error: es «sin sesión para
 *   sincronizar» y se renueva sola cuando vuelve la señal (CA2). Registrar nunca la espera.
 * - Salir de la cuenta borra los tokens del teléfono, no los registros.
 */

import type { CuadernoDb } from './db.ts';
import { idDispositivo } from './dispositivo.ts';

export const CLAVE_SESION = 'sesion';

export interface Organizacion {
  org_id: string;
  nombre: string;
  rol: string;
  /** Plan de la finca (HU-E3.11); falta en sesiones de antes de este cambio. */
  plan?: string;
  /** Hasta cuándo vale un plan pagado en línea (HU-E0.7); null o ausente si no vence. */
  plan_vence?: string | null;
}

export interface Sesion {
  acceso: string;
  acceso_vence: number;
  refresh: string;
  refresh_vence: number;
  usuario: { nombre: string; email: string };
  organizaciones: Organizacion[];
  org_id: string | null;
  /** API de la celda de esa organización (HU-E5.1); null sin organización. */
  url_api?: string | null;
}

/** Lo que responde el CORE al canjear o renovar; `refresh` es null si no rotó. */
type RespuestaDelCore = Omit<Sesion, 'refresh'> & { refresh: string | null };

export type EstadoDeSesion =
  | 'sin-cuenta'
  | 'activa'
  /** Access vencido, refresh vigente: se renueva al haber señal. */
  | 'por-renovar'
  /** Refresh vencido o revocado: hay que volver a entrar. */
  | 'vencida';

/** URL del CORE según el host del cuaderno (`celdas.json`, HU-E4.2). */
export function urlDelCore(
  hostname: string,
  config: { dominio: string; url: string; url_staging: string } = __CORE__,
): string {
  return hostname === config.dominio ? config.url : config.url_staging;
}

/**
 * La cuenta de Laboratorio Digital según el host del cuaderno: los asistentes con acceso, las
 * sesiones, los pagos y los datos de la persona (HU-C7.5 a HU-C9.6). En staging la sirve el CORE.
 */
export function urlDeLaCuenta(
  hostname: string,
  config: { dominio: string; url_staging: string; cuenta: string } = __CORE__,
): string {
  return hostname === config.dominio ? config.cuenta : `${config.url_staging}/`;
}

/** El plan de la finca de la sesión; sin finca en la nube o sin dato, el gratuito. */
export const planDeLaFinca = (sesion: Sesion | null): string =>
  sesion?.organizaciones.find((o) => o.org_id === sesion.org_id)?.plan ?? 'gratuito';

/** Hasta cuándo vale el plan pagado de la finca de la sesión; null si no vence (HU-E0.7). */
export const vencimientoDelPlan = (sesion: Sesion | null): string | null =>
  sesion?.organizaciones.find((o) => o.org_id === sesion.org_id)?.plan_vence ?? null;

/** El rol de esta persona en la finca de la sesión, o null si no hay finca en la nube. */
export const rolEnLaFinca = (sesion: Sesion | null): string | null =>
  sesion?.organizaciones.find((o) => o.org_id === sesion.org_id)?.rol ?? null;

export async function leerSesion(db: CuadernoDb): Promise<Sesion | null> {
  const fila = await db.meta.get(CLAVE_SESION);
  return (fila?.valor as Sesion | undefined) ?? null;
}

async function guardar(db: CuadernoDb, sesion: Sesion, ahora: number): Promise<Sesion> {
  await db.meta.put({
    clave: CLAVE_SESION,
    valor: sesion,
    actualizado: new Date(ahora).toISOString(),
  });
  return sesion;
}

export async function salirDeLaCuenta(db: CuadernoDb): Promise<void> {
  await db.meta.delete(CLAVE_SESION);
}

export function estadoDeSesion(sesion: Sesion | null, ahora: number): EstadoDeSesion {
  if (!sesion) return 'sin-cuenta';
  if (sesion.refresh_vence <= ahora) return 'vencida';
  return sesion.acceso_vence > ahora ? 'activa' : 'por-renovar';
}

/** Lo que llegó en el fragmento al volver de Google. */
export type Regreso = { codigo: string } | { error: string } | null;

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

async function pedirAlCore(
  fetchFn: typeof fetch,
  url: string,
  cuerpo: Record<string, unknown>,
): Promise<RespuestaDelCore> {
  let r: Response;
  try {
    r = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorDeSesion('Sin señal: no se pudo hablar con el servidor.');
  }
  const datos = (await r.json().catch(() => ({}))) as Partial<RespuestaDelCore> & {
    motivo?: string;
  };
  if (!r.ok) throw new ErrorDeSesion(datos.motivo ?? `El servidor respondió ${r.status}.`);
  return datos as RespuestaDelCore;
}

export async function canjear(
  db: CuadernoDb,
  codigo: string,
  core: string,
  fetchFn: typeof fetch = fetch,
  ahora: () => number = () => Date.now(),
): Promise<Sesion> {
  const respuesta = await pedirAlCore(fetchFn, `${core}/api/core/auth/canje`, {
    codigo,
    dispositivo: await idDispositivo(db),
  });
  if (!respuesta.refresh) throw new ErrorDeSesion('El servidor no entregó la sesión.');
  return guardar(db, { ...respuesta, refresh: respuesta.refresh }, ahora());
}

/**
 * Renueva el access si venció. Sin señal no falla: devuelve la sesión como está y el estado
 * queda «por renovar» (CA2). Si el CORE dice que la sesión ya no sirve, se borra y se avisa.
 */
export async function renovarSiHaceFalta(
  db: CuadernoDb,
  core: string,
  opciones: {
    fetchFn?: typeof fetch;
    ahora?: () => number;
    enLinea?: () => boolean;
    /** La finca de este teléfono: la sesión se pide para ella (bitácora agro 25). */
    org?: string | null;
    /** Renovar aunque el access siga vigente: la sesión es de otra finca. */
    forzar?: boolean;
  } = {},
): Promise<{ sesion: Sesion | null; aviso: string | null }> {
  const { fetchFn = fetch, ahora = () => Date.now(), enLinea = () => navigator.onLine } = opciones;
  const sesion = await leerSesion(db);
  const estado = estadoDeSesion(sesion, ahora());
  if (!sesion || estado === 'sin-cuenta') return { sesion, aviso: null };
  if (estado === 'activa' && !opciones.forzar) return { sesion, aviso: null };
  if (estado === 'vencida') {
    await salirDeLaCuenta(db);
    return { sesion: null, aviso: 'La sesión venció. Vuelve a entrar.' };
  }
  if (!enLinea()) return { sesion, aviso: null };
  let r: Response;
  try {
    r = await fetchFn(`${core}/api/core/auth/refrescar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        refresh: sesion.refresh,
        ...((opciones.org ?? sesion.org_id) ? { org_id: opciones.org ?? sesion.org_id } : {}),
      }),
    });
  } catch {
    return { sesion, aviso: null }; // la señal se fue a mitad: se intenta en la próxima
  }
  const datos = (await r.json().catch(() => ({}))) as Partial<RespuestaDelCore> & {
    motivo?: string;
  };
  if (r.status === 401) {
    await salirDeLaCuenta(db);
    return { sesion: null, aviso: datos.motivo ?? 'La sesión venció. Vuelve a entrar.' };
  }
  if (!r.ok) return { sesion, aviso: null }; // CORE en pausa o caído: se reintenta después
  const renovada = await guardar(
    db,
    { ...(datos as RespuestaDelCore), refresh: datos.refresh ?? sesion.refresh },
    ahora(),
  );
  return { sesion: renovada, aviso: null };
}
