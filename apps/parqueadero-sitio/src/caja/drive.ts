/**
 * La copia del parqueadero en el Google Drive de la persona (HU-Q10.1; decisión del dueño del
 * 8 oct 2026: «respaldo en la cuenta de Google con que se registre, tal cual quedó en
 * CultivoPro»). Es la copia del cuaderno (`apps/cuaderno/src/almacen/drive.ts`) con el archivo de
 * la caja; lo de Google y el permiso viven en `@ed1/drive` (P2).
 *
 * - **Guardar:** el mismo archivo `parqueadero-export/1` de «Respaldo» (P2), en la carpeta
 *   «Caja del parqueadero · respaldos» del Drive que la persona elige en Google. Se conservan las
 *   8 más recientes. Cuenta como respaldo: la cabecera deja de pedirlo.
 * - **Traer:** una copia de esa carpeta se une a la caja con la misma revisión de «Restaurar», que
 *   nunca borra ni reemplaza lo que hay (ARQUITECTURA §8.3, bitácora ecommerce 77).
 * - **El permiso** lo pide el CORE con `producto=parqueadero` y vuelve a `/caja/#drive=<sello>`. El
 *   verificador espera en `meta` (no en `sessionStorage`: Google puede volver en otra pestaña). El
 *   token de Google nunca se guarda: dura una hora y sirve para una sola copia.
 *
 * No es automática en segundo plano: una app web no puede pedir el permiso sin que la persona lo
 * vea (lo mismo que en el cuaderno). Las fotos no van, como en el archivo.
 */
import {
  type CopiaEnDrive,
  canjearSello,
  carpetaDeRespaldos,
  descargarCopia,
  listarCopias,
  nuevoVerificador,
  PermisoInvalido,
  subirCopia,
  urlDelPermiso,
} from '@ed1/drive';
import { anotarRespaldo, armarRespaldo, type Contexto, restaurar } from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';

export const CARPETA = 'Caja del parqueadero · respaldos';
export const CONSERVAR = 8;
/** Lo que vale un permiso pedido: después, la vuelta de Google ya no se acepta. */
const VIDA_PENDIENTE_MS = 10 * 60 * 1000;

export type AccionDrive = 'guardar' | 'traer';
type Fetch = typeof fetch;

/** Adónde ir para pedir el permiso; el verificador se queda en esta caja. */
export async function urlParaPedirPermiso(
  db: Pick<BaseDeLaCaja, 'meta'>,
  core: string,
  origen: string,
  accion: AccionDrive,
  ahora: () => number,
): Promise<string> {
  const { verificador, desafio } = await nuevoVerificador();
  await db.meta.put({ clave: 'drive_pendiente', verificador, accion, creado: ahora() });
  return urlDelPermiso(core, { producto: 'parqueadero', vuelta: `${origen}/caja/`, desafio });
}

/** Canjea el sello por un token de Drive de una hora; lo pendiente se borra pase lo que pase. */
export async function canjearPermiso(
  db: Pick<BaseDeLaCaja, 'meta'>,
  core: string,
  sello: string,
  { fetchFn = fetch, ahora }: { fetchFn?: Fetch; ahora: () => number },
): Promise<{ acceso: string; accion: AccionDrive }> {
  const pendiente = await db.meta.get('drive_pendiente');
  await db.meta.delete('drive_pendiente');
  if (pendiente?.clave !== 'drive_pendiente' || ahora() - pendiente.creado > VIDA_PENDIENTE_MS) {
    throw new PermisoInvalido(
      'El permiso se pidió hace mucho o desde otro teléfono. Vuelva a tocar el botón.',
      'vencido',
    );
  }
  const acceso = await canjearSello(fetchFn, core, sello, pendiente.verificador);
  return { acceso, accion: pendiente.accion };
}

/** Arma el archivo de siempre, lo sube a la carpeta y lo anota como respaldo. */
export async function guardarCopia(
  db: BaseDeLaCaja,
  ctx: Contexto,
  acceso: string,
  { app, fetchFn = fetch }: { app: string; fetchFn?: Fetch },
): Promise<{ nombre: string; borradas: number }> {
  const r = await armarRespaldo(db, ctx, app);
  const nombre = `${r.nombre}.json`;
  const { borradas } = await subirCopia(fetchFn, acceso, {
    carpeta: CARPETA,
    nombre,
    contenido: JSON.stringify(r.json),
    conservar: CONSERVAR,
  });
  await anotarRespaldo(db, ctx.reloj());
  return { nombre, borradas };
}

/** Las copias de la carpeta, la más reciente primero. */
export async function copiasEnDrive(
  acceso: string,
  fetchFn: Fetch = fetch,
): Promise<CopiaEnDrive[]> {
  return listarCopias(fetchFn, acceso, await carpetaDeRespaldos(fetchFn, acceso, CARPETA));
}

/** Trae una copia y la une a la caja, como «Restaurar»: no borra ni reemplaza nada. */
export async function traerCopia(
  db: BaseDeLaCaja,
  acceso: string,
  id: string,
  fetchFn: Fetch = fetch,
): ReturnType<typeof restaurar> {
  return restaurar(db, JSON.parse(await descargarCopia(fetchFn, acceso, id)));
}
