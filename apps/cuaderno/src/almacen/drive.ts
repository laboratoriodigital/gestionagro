/**
 * Copia del cuaderno en el Google Drive del productor (HU-E8.4, etapa 1; decisión del dueño,
 * 5 oct 2026). Todo va del teléfono a Google: la nube de CultivoPro no ve la copia.
 *
 * - Una carpeta visible, «CultivoPro · respaldos», en el Drive de la persona: puede ver, descargar
 *   o borrar sus copias. Con el permiso `drive.file`, la app solo ve lo que ella misma creó.
 * - El archivo es el mismo `agro-export` v1 de «Descargar respaldo completo» (P2): se restaura con
 *   la misma revisión e importación, que une y no reemplaza.
 * - Se conservan las 8 copias más recientes; las más viejas que creó la app se borran.
 * - Las fotos no van en la copia todavía: el formato no las lleva.
 *
 * Funciones con `fetch` inyectado, para probarlas sin Google. Lo que no es del cuaderno (Drive,
 * la carpeta y las copias que se conservan) vive en `@ed1/drive`, que comparte con la caja del
 * parqueadero (HU-Q10.1).
 */
import { fechaAgronomica } from '@ed1/agro-schema';
import * as drive from '@ed1/drive';
import marca from '../../../../content/marca.json' with { type: 'json' };
import { corto } from '../descargar.ts';
import type { CuadernoDb } from './db.ts';
import { exportarTodo } from './respaldo.ts';

export { type CopiaEnDrive, ErrorDeDrive, ORIGEN_DRIVE } from '@ed1/drive';
export const CARPETA = `${marca.nombre} · respaldos`;
export const CONSERVAR = 8;
export const CLAVE_ULTIMO_DRIVE = 'ultimo_respaldo_drive';

type Fetch = typeof fetch;

/** Id de la carpeta de respaldos del cuaderno; la crea si no existe. */
export const carpetaDeRespaldos = (fetchFn: Fetch, token: string): Promise<string> =>
  drive.carpetaDeRespaldos(fetchFn, token, CARPETA);

export const listarCopias = drive.listarCopias;
export const descargarCopia = drive.descargarCopia;

const HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Exporta todo, lo sube a la carpeta y deja solo las 8 copias más recientes. Devuelve el nombre
 * del archivo y cuántas copias viejas borró.
 */
export async function guardarCopiaEnDrive(
  db: CuadernoDb,
  fetchFn: Fetch,
  token: string,
  { app, ahora = () => new Date() }: { app: string; ahora?: () => Date },
): Promise<{ nombre: string; borradas: number }> {
  const archivo = await exportarTodo(db, { app, ahora });
  const finca = archivo.tablas.finca.filas.find((f) => f.id === archivo.finca_id);
  const momento = ahora();
  const hora = HORA.format(momento).replace(':', '');
  const nombre = `cuaderno-${corto(finca?.nombre ?? 'finca')}-${fechaAgronomica(momento.getTime())}-${hora}.json`;
  const { borradas } = await drive.subirCopia(fetchFn, token, {
    carpeta: CARPETA,
    nombre,
    contenido: JSON.stringify(archivo),
    conservar: CONSERVAR,
  });
  const instante = momento.toISOString();
  await db.meta.put({ clave: CLAVE_ULTIMO_DRIVE, valor: instante, actualizado: instante });
  return { nombre, borradas };
}
