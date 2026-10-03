/**
 * Varias fincas en un mismo teléfono (HU-E4.7). Cada finca tiene su propia base local: la de
 * siempre (`gestionagro-cuaderno`, sin migrar nada) y una nueva por cada finca que se agrega
 * (`gestionagro-cuaderno-<id>`). Nada se mezcla: los registros, la cola de salida y el vínculo con
 * la nube son de cada base (P21).
 *
 * - **Una sola sesión.** El refresh token rota al renovarse: dos copias se invalidarían entre sí.
 *   Por eso la sesión vive en la finca activa y se traslada al cambiar de finca, con el id de este
 *   teléfono (es el mismo teléfono).
 * - **El registro de fincas** (nombre, base, organización) y cuál está activa van en el
 *   almacenamiento local del navegador: no son secretos y se leen antes de abrir ninguna base.
 * - Cambiar de finca recarga la app con la otra base: ninguna pantalla queda con datos de la
 *   anterior.
 */
import { uuidv7 } from '@gestionagro/agro-schema';
import { type CuadernoDb, NOMBRE_POR_DEFECTO } from './db.ts';
import { CLAVE_DISPOSITIVO } from './dispositivo.ts';
import { CLAVE_SESION } from './sesion.ts';
import { leerVinculo } from './vinculo.ts';

export interface FincaLocal {
  base: string;
  nombre: string;
  /** La finca en la nube a la que está vinculada; null si es solo de este teléfono. */
  org_id: string | null;
}

const CLAVE_LISTA = 'gestionagro.fincas-locales';
const CLAVE_ACTIVA = 'gestionagro.finca-activa';
const CLAVE_BAJAR = 'gestionagro.bajar-al-abrir';

/** Lo que se usa de `localStorage`; las pruebas pasan uno en memoria. */
export type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const local = (): Almacen => globalThis.localStorage;

const esBase = (b: unknown): b is string =>
  typeof b === 'string' && (b === NOMBRE_POR_DEFECTO || b.startsWith(`${NOMBRE_POR_DEFECTO}-`));

/** La base de la finca activa; la de siempre si no se eligió otra. */
export function baseActiva(almacen: () => Almacen = local): string {
  try {
    const b = almacen().getItem(CLAVE_ACTIVA);
    return esBase(b) ? b : NOMBRE_POR_DEFECTO;
  } catch {
    return NOMBRE_POR_DEFECTO;
  }
}

export function fincasLocales(almacen: () => Almacen = local): FincaLocal[] {
  try {
    const lista = JSON.parse(almacen().getItem(CLAVE_LISTA) ?? '[]') as unknown;
    return Array.isArray(lista)
      ? lista.filter(
          (f): f is FincaLocal =>
            esBase(f?.base) &&
            typeof f?.nombre === 'string' &&
            (f.org_id === null || typeof f.org_id === 'string'),
        )
      : [];
  } catch {
    return [];
  }
}

/** Anota o actualiza una finca del teléfono (su nombre o su vínculo cambian). */
export function anotarFinca(finca: FincaLocal, almacen: () => Almacen = local): void {
  const lista = fincasLocales(almacen).filter((f) => f.base !== finca.base);
  try {
    almacen().setItem(CLAVE_LISTA, JSON.stringify([...lista, finca]));
  } catch {
    // Sin almacenamiento local no hay lista: la app sigue con la finca de siempre.
  }
}

export const nuevaBase = (): string => `${NOMBRE_POR_DEFECTO}-${uuidv7()}`;

/**
 * Pasa a otra finca: le entrega la sesión y el id del teléfono, y la deja activa. Quien llama
 * recarga la app. Con `bajarOrg`, al abrir se baja esa finca de la nube (una base nueva).
 */
export async function cambiarDeFinca(
  desde: CuadernoDb,
  hacia: CuadernoDb,
  opciones: { bajarOrg?: string | null; almacen?: () => Almacen } = {},
): Promise<void> {
  const { bajarOrg = null, almacen = local } = opciones;
  const sesion = await desde.meta.get(CLAVE_SESION);
  const dispositivo = await desde.meta.get(CLAVE_DISPOSITIVO);
  // Primero se escribe en la nueva y después se quita de la anterior: si algo se corta en el
  // medio, la sesión queda en las dos y no se pierde.
  await hacia.transaction('rw', hacia.meta, async () => {
    if (sesion) await hacia.meta.put(sesion);
    if (dispositivo && !(await hacia.meta.get(CLAVE_DISPOSITIVO))) {
      await hacia.meta.put(dispositivo);
    }
  });
  if (sesion) await desde.meta.delete(CLAVE_SESION);
  almacen().setItem(CLAVE_ACTIVA, hacia.name);
  if (bajarOrg) almacen().setItem(CLAVE_BAJAR, bajarOrg);
  else almacen().removeItem(CLAVE_BAJAR);
}

/** La finca de la nube que hay que bajar al abrir, una sola vez. */
export function tomarFincaPorBajar(almacen: () => Almacen = local): string | null {
  try {
    const org = almacen().getItem(CLAVE_BAJAR);
    almacen().removeItem(CLAVE_BAJAR);
    return org;
  } catch {
    return null;
  }
}

/**
 * La finca de esta base, con su nombre y su vínculo de hoy; null si la base no tiene ninguna.
 * Mientras una finca baja, aún no llegó: se conserva el nombre que se anotó al abrirla.
 */
export async function fincaDeLaBase(
  db: CuadernoDb,
  almacen: () => Almacen = local,
): Promise<FincaLocal | null> {
  const finca = await db.finca.toCollection().first();
  const vinculo = await leerVinculo(db);
  const antes = fincasLocales(almacen).find((f) => f.base === db.name);
  if (!finca && !vinculo && !antes) return null;
  return {
    base: db.name,
    nombre: finca?.nombre ?? antes?.nombre ?? FINCA_SIN_NOMBRE,
    org_id: vinculo?.org_id ?? antes?.org_id ?? null,
  };
}

/**
 * Anota la finca de esta base en la lista del teléfono (el nombre llega con la sincronización o
 * al configurarla). Con una sola finca no se anota nada, salvo con `siempre` (al agregar otra):
 * quien no usa varias tiene el almacenamiento local vacío, como antes (CA4).
 */
export async function anotarFincaActiva(
  db: CuadernoDb,
  opciones: { siempre?: boolean; almacen?: () => Almacen } = {},
): Promise<FincaLocal | null> {
  const { siempre = false, almacen = local } = opciones;
  const finca = await fincaDeLaBase(db, almacen);
  if (finca && (siempre || fincasLocales(almacen).length > 0)) anotarFinca(finca, almacen);
  return finca;
}

export const FINCA_SIN_NOMBRE = 'Finca nueva';
