/**
 * Lo que las calculadoras comparten para llevar algo al cuaderno (HU-E2.7, HU-E10.2): la ruta de
 * Registrar y si este navegador ya usa el cuaderno. Una prueba ata los nombres a los del cuaderno
 * (P2).
 */

/** Pantalla del cuaderno que recibe la lectura (HU-E3.8, CA3). Mismo dominio que el sitio. */
export const REGISTRAR_EN_CUADERNO = '/agro/app/registrar/';

/** Nombre de la base del cuaderno en IndexedDB; una prueba exige que sea el del cuaderno (P2). */
export const BASE_DEL_CUADERNO = 'gestionagro-cuaderno';

/**
 * ¿Este navegador ya usa el cuaderno? (HU-E2.7, CA2). Mismo dominio, así que la base es visible.
 * Sin `indexedDB.databases()` (navegadores viejos) no se sabe: se responde que no, y lo peor que
 * pasa es una línea de explicación de más.
 */
export async function cuadernoEnUso(
  idb: IDBFactory | undefined = globalThis.indexedDB,
): Promise<boolean> {
  if (typeof idb?.databases !== 'function') return false;
  try {
    return (await idb.databases()).some((b) => b.name === BASE_DEL_CUADERNO);
  } catch {
    return false;
  }
}
