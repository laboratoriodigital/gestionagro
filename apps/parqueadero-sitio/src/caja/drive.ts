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
 * vea (lo mismo que en el cuaderno).
 *
 * - **Las fotos** (HU-Q8.3; decisión del dueño del 12 oct 2026: «Las fotos en la nube, van para la
 *   cuenta del drive por ahora»): con el mismo permiso, después de la copia, suben las que faltan a
 *   la carpeta de fotos de esta caja, y se borran allá las que el teléfono ya borró por vencidas.
 *   No van en el archivo, que se comparte por correo. Tampoco suben solas: el permiso dura una
 *   hora y no se renueva sin la persona.
 */
import {
  borrarArchivo,
  type CopiaEnDrive,
  canjearSello,
  carpetaDeRespaldos,
  descargarCopia,
  listarArchivos,
  listarCopias,
  nuevoVerificador,
  PermisoInvalido,
  subirArchivo,
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

/** Lo que pasó con las fotos al guardar la copia: subidas y borradas, o por qué no terminaron. */
export type FotosEnDrive =
  | { readonly subidas: number; readonly borradas: number }
  | { readonly falla: unknown };

/**
 * Arma el archivo de siempre, lo sube a la carpeta y lo anota como respaldo; después, las fotos.
 * Si las fotos fallan, la copia ya quedó: se dice aparte y la próxima copia sube las que faltan.
 */
export async function guardarCopia(
  db: BaseDeLaCaja,
  ctx: Contexto,
  acceso: string,
  { app, fetchFn = fetch }: { app: string; fetchFn?: Fetch },
): Promise<{ nombre: string; borradas: number; fotos: FotosEnDrive }> {
  const r = await armarRespaldo(db, ctx, app);
  const nombre = `${r.nombre}.json`;
  const { borradas } = await subirCopia(fetchFn, acceso, {
    carpeta: CARPETA,
    nombre,
    contenido: JSON.stringify(r.json),
    conservar: CONSERVAR,
  });
  await anotarRespaldo(db, ctx.reloj());
  const fotos = await sincronizarFotos(db, acceso, fetchFn).catch((falla: unknown) => ({ falla }));
  return { nombre, borradas, fotos };
}

export const CARPETA_DE_FOTOS = 'Caja del parqueadero · fotos';
const EXTENSION = { 'image/webp': 'webp', 'image/jpeg': 'jpg' } as const;
/** El id de la foto va al final del nombre: así se sabe cuáles ya subieron. */
const ID_EN_EL_NOMBRE = /_([^_.]+)\.(?:webp|jpg)$/;
/** El día de Bogotá (UTC−5, sin horario de verano), para que la persona las ordene a la vista. */
const diaDe = (ms: number) => new Date(ms - 5 * 3_600_000).toISOString().slice(0, 10);

/**
 * Sube las fotos que faltan a la carpeta de esta caja (una por serie: dos cajas no se pisan) y
 * borra allá las que esta caja ya borró por vencidas (`fotos_purgadas`). Una caja restaurada no
 * tiene esa lista: no borra nada de lo que subió otra.
 */
export async function sincronizarFotos(
  db: BaseDeLaCaja,
  acceso: string,
  fetchFn: Fetch = fetch,
): Promise<{ subidas: number; borradas: number }> {
  const dispositivo = await db.meta.get('dispositivo');
  const serie = dispositivo?.clave === 'dispositivo' ? dispositivo.serie : '';
  const carpeta = await carpetaDeRespaldos(
    fetchFn,
    acceso,
    serie ? `${CARPETA_DE_FOTOS} · caja ${serie}` : CARPETA_DE_FOTOS,
  );
  const enDrive = new Map<string, string>();
  for (const a of await listarArchivos(fetchFn, acceso, carpeta)) {
    const id = a.nombre.match(ID_EN_EL_NOMBRE)?.[1];
    if (id) enDrive.set(id, a.id);
  }
  const purgadas = await db.meta.get('fotos_purgadas');
  const porBorrar = purgadas?.clave === 'fotos_purgadas' ? purgadas.ids : [];
  let borradas = 0;
  for (const id of porBorrar) {
    const archivo = enDrive.get(id);
    if (!archivo) continue;
    await borrarArchivo(fetchFn, acceso, archivo);
    borradas++;
  }
  // Se olvida solo lo resuelto: una foto purgada mientras tanto queda para la próxima copia.
  await db.transaction('rw', db.meta, async () => {
    const hoy = await db.meta.get('fotos_purgadas');
    const resto = (hoy?.clave === 'fotos_purgadas' ? hoy.ids : []).filter(
      (id) => !porBorrar.includes(id),
    );
    if (resto.length > 0) await db.meta.put({ clave: 'fotos_purgadas', ids: resto });
    else await db.meta.delete('fotos_purgadas');
  });
  let subidas = 0;
  for (const id of (await db.fotos.toCollection().primaryKeys()) as string[]) {
    if (enDrive.has(id)) continue;
    const foto = await db.fotos.get(id);
    if (!foto) continue;
    await subirArchivo(fetchFn, acceso, {
      carpeta,
      nombre: `${diaDe(foto.creada)}_${foto.id}.${EXTENSION[foto.tipo]}`,
      tipo: foto.tipo,
      datos: foto.datos,
    });
    subidas++;
  }
  return { subidas, borradas };
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
