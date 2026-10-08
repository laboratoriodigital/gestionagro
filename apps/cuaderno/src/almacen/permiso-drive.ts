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
import { canjearSello, nuevoVerificador, PermisoInvalido, urlDelPermiso } from '@ed1/drive';
import type { CuadernoDb } from './db.ts';

export { leerVuelta, PermisoInvalido, textoDelError, type Vuelta } from '@ed1/drive';

const CLAVE = 'drive_pendiente';
/** Lo que el teléfono espera hacer cuando vuelva de Google. */
export type AccionDrive = 'guardar' | 'traer';
const VIDA_PENDIENTE_MS = 10 * 60 * 1000;

/** Dirección del CORE para empezar; quien llama navega hacia ella. */
export async function urlParaPedirPermiso(
  db: CuadernoDb,
  core: string,
  vuelta: string,
  accion: AccionDrive,
  ahora: () => number = () => Date.now(),
): Promise<string> {
  const { verificador, desafio } = await nuevoVerificador();
  const creado = new Date(ahora()).toISOString();
  await db.meta.put({ clave: CLAVE, valor: { verificador, accion, creado }, actualizado: creado });
  return urlDelPermiso(core, { vuelta, desafio });
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
  const acceso = await canjearSello(fetchFn, core, sello, pendiente.verificador);
  return { acceso, accion: pendiente.accion };
}
