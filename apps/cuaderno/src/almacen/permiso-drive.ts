/**
 * Pedir el permiso de Google Drive a través del CORE y canjearlo a la vuelta (HU-E8.4, etapa 1).
 * El CORE hace el intercambio con Google; ver `apps/core/src/drive.ts`.
 *
 * 1. Antes de salir, el teléfono crea un verificador al azar y lo guarda en su base local. Al CORE
 *    solo le manda su SHA-256 (el desafío).
 * 2. Google y el CORE devuelven la pantalla de Respaldo con `#drive=<sello>` o `#drive-error=…`.
 * 3. El teléfono canjea el sello con el verificador: solo quien empezó puede usarlo, aunque el
 *    fragmento quede en el historial.
 *
 * El verificador va en la base local y no en `sessionStorage`: si la vuelta de Google abre otra
 * pestaña del mismo sitio, la base sigue siendo la misma. El token de Drive nunca se guarda: dura
 * una hora y se usa para una sola copia.
 */
import type { CuadernoDb } from './db.ts';

const CLAVE = 'drive_pendiente';
/** Lo que el teléfono espera hacer cuando vuelva de Google. */
export type AccionDrive = 'guardar' | 'traer';
const VIDA_PENDIENTE_MS = 10 * 60 * 1000;

const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

/** Dirección del CORE para empezar; quien llama navega hacia ella. */
export async function urlParaPedirPermiso(
  db: CuadernoDb,
  core: string,
  vuelta: string,
  accion: AccionDrive,
  ahora: () => number = () => Date.now(),
): Promise<string> {
  const verificador = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const desafio = b64url(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador)),
  );
  const creado = new Date(ahora()).toISOString();
  await db.meta.put({ clave: CLAVE, valor: { verificador, accion, creado }, actualizado: creado });
  return `${core}/api/core/drive/inicio?vuelta=${encodeURIComponent(vuelta)}&desafio=${desafio}`;
}

export type Vuelta = { tipo: 'sello'; sello: string } | { tipo: 'error'; motivo: string } | null;

/** Lee el fragmento de la vuelta de Google, si es de Drive. */
export function leerVuelta(hash: string): Vuelta {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const sello = p.get('drive');
  if (sello) return { tipo: 'sello', sello };
  const error = p.get('drive-error');
  if (error) return { tipo: 'error', motivo: error };
  return null;
}

/** El motivo de la vuelta, dicho para la persona (P15). */
export function textoDelError(motivo: string): string {
  return motivo === 'cancelada'
    ? 'Cancelaste el permiso en Google. No se guardó ni se trajo nada.'
    : 'Google no dio el permiso. Vuelve a intentarlo en un momento.';
}

export class PermisoInvalido extends Error {
  override readonly name = 'PermisoInvalido';
}

/** Canjea el sello por un token de Drive de una hora; borra lo pendiente pase lo que pase. */
export async function canjearPermiso(
  db: CuadernoDb,
  core: string,
  sello: string,
  {
    fetchFn = (...a: Parameters<typeof fetch>) => fetch(...a),
    ahora = () => Date.now(),
  }: { fetchFn?: typeof fetch; ahora?: () => number } = {},
): Promise<{ acceso: string; accion: AccionDrive }> {
  const fila = await db.meta.get(CLAVE);
  await db.meta.delete(CLAVE);
  const pendiente = fila?.valor as
    | { verificador?: string; accion?: AccionDrive; creado?: string }
    | undefined;
  if (
    !pendiente?.verificador ||
    !pendiente.accion ||
    ahora() - Date.parse(pendiente.creado ?? '') > VIDA_PENDIENTE_MS
  ) {
    throw new PermisoInvalido(
      'El permiso se pidió hace mucho o desde otro teléfono. Vuelve a tocar el botón.',
    );
  }
  let r: Response;
  try {
    r = await fetchFn(`${core}/api/core/drive/canje`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sellado: sello, verificador: pendiente.verificador }),
    });
  } catch {
    throw new PermisoInvalido(
      'No hay señal para terminar el permiso. Inténtalo cuando tengas internet.',
    );
  }
  const cuerpo = (await r.json().catch(() => ({}))) as { acceso?: string; motivo?: string };
  if (!r.ok || !cuerpo.acceso) {
    throw new PermisoInvalido(cuerpo.motivo ?? 'Google no dio el permiso. Vuelve a intentarlo.');
  }
  return { acceso: cuerpo.acceso, accion: pendiente.accion };
}
