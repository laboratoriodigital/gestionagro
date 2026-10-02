/**
 * Lista de espera de planes con precio visible (HU-E0.6), contra el CORE. «Me interesa» deja la
 * señal de que la finca pagaría ese plan; no cobra ni pide tarjeta. Con señal, como el equipo.
 */
import configPlanes from '../../../../content/agro/cuaderno/planes.json' with { type: 'json' };
import type { CuadernoDb } from './db.ts';
import { pedirAlCore } from './equipo.ts';

export interface Plan {
  id: string;
  nombre: string;
  precio: string;
  para_quien: string;
  incluye: string[];
}

export const PLANES: readonly Plan[] = configPlanes.planes;
export const AVISO_PRECIO = configPlanes.aviso_precio;
/** Los planes que se pueden pedir en la lista de espera (el gratuito ya se tiene). */
export const CON_ESPERA = new Set(['finca', 'exportador', 'cadena']);

export const planesMarcados = async (db: CuadernoDb, core: string, fetchFn: typeof fetch = fetch) =>
  (await pedirAlCore<{ planes: string[] }>(db, core, '/api/core/interes/ver', {}, fetchFn)).planes;

export const marcarInteres = (
  db: CuadernoDb,
  core: string,
  plan: string,
  fetchFn: typeof fetch = fetch,
) =>
  pedirAlCore<{ plan: string; nuevo: boolean }>(db, core, '/api/core/interes', { plan }, fetchFn);
