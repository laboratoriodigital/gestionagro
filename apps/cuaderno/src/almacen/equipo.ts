/**
 * El equipo de la finca y los teléfonos de la cuenta (HU-E4.6), contra el CORE. Todo con señal:
 * son decisiones de acceso, no registros, y no esperan en la cola.
 *
 * - Quien administra la finca ve quién tiene acceso, cambia roles y quita a alguien.
 * - Cada persona ve los teléfonos donde entró con su cuenta y retira uno (perdido, robado,
 *   prestado).
 */
import type { CuadernoDb } from './db.ts';
import { ErrorDeSesion, leerSesion } from './sesion.ts';

export interface Miembro {
  usuario_id: string;
  nombre: string;
  rol: string;
  /** Es quien está usando este teléfono. */
  tu: boolean;
}

export interface Telefono {
  id: string;
  dispositivo: string;
  creado: string;
}

/** POST al CORE con la sesión de este teléfono. Todo con señal: no espera en la cola. */
export async function pedirAlCore<T>(
  db: CuadernoDb,
  core: string,
  ruta: string,
  cuerpo: object,
  fetchFn: typeof fetch,
): Promise<T> {
  const sesion = await leerSesion(db);
  if (!sesion) throw new ErrorDeSesion('Entra con tu cuenta para continuar.');
  let r: Response;
  try {
    r = await fetchFn(`${core}${ruta}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sesion.acceso}` },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorDeSesion('Sin señal: inténtalo cuando haya señal.');
  }
  const datos = (await r.json().catch(() => ({}))) as { motivo?: string };
  if (!r.ok) throw new ErrorDeSesion(datos.motivo ?? `La nube respondió ${r.status}.`);
  return datos as T;
}

export const leerEquipo = async (db: CuadernoDb, core: string, fetchFn: typeof fetch = fetch) =>
  (await pedirAlCore<{ miembros: Miembro[] }>(db, core, '/api/core/equipo/ver', {}, fetchFn))
    .miembros;

export const cambiarRol = (
  db: CuadernoDb,
  core: string,
  usuarioId: string,
  rol: string,
  fetchFn: typeof fetch = fetch,
) => pedirAlCore(db, core, '/api/core/equipo/rol', { usuario_id: usuarioId, rol }, fetchFn);

export const quitarDelEquipo = (
  db: CuadernoDb,
  core: string,
  usuarioId: string,
  fetchFn: typeof fetch = fetch,
) => pedirAlCore(db, core, '/api/core/equipo/quitar', { usuario_id: usuarioId }, fetchFn);

export const leerTelefonos = async (db: CuadernoDb, core: string, fetchFn: typeof fetch = fetch) =>
  (await pedirAlCore<{ telefonos: Telefono[] }>(db, core, '/api/core/telefonos/ver', {}, fetchFn))
    .telefonos;

export const retirarTelefono = (
  db: CuadernoDb,
  core: string,
  id: string,
  fetchFn: typeof fetch = fetch,
) => pedirAlCore(db, core, '/api/core/telefonos/retirar', { id }, fetchFn);
