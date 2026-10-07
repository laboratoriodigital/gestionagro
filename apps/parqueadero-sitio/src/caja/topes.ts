/**
 * El tope legal de la ciudad de la sede (HU-Q1.2, PARQUEADERO §9.1 y §9.2 regla 3). Sin zod: el
 * inicio lo usa para el aviso. El CI valida el contenido con `problemasDeTopes`; las cajas
 * instaladas reciben un tope nuevo con la versión siguiente (P10).
 */
import type { TopesDeCiudades, Vehiculo } from '@ed1/parqueadero-schema';
import contenido from '../../../../content/parqueadero/topes.json' with { type: 'json' };

const TOPES = contenido as TopesDeCiudades;

/** `Bogotá D.C.`, `bogota`, ` BOGOTÁ ` → `bogota`: la sede escribe su ciudad como quiere. */
export function claveDeCiudad(ciudad: string): string {
  return ciudad
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bd\.?\s*c\.?$/, '')
    .replace(/[^a-z ]/g, '')
    .trim();
}

export interface TopeDeCiudad {
  readonly ciudad: string;
  readonly norma: string;
  readonly vigenteDesde: string;
  /** El máximo por minuto, sin sello de oro: el que la caja exige mientras la sede no diga más. */
  readonly porMinuto: number;
}

export function topeDeLaCiudad(
  ciudad: string | undefined,
  vehiculo: Vehiculo,
  topes: TopesDeCiudades = TOPES,
): TopeDeCiudad | null {
  if (!ciudad) return null;
  const c = topes.ciudades.find((x) => claveDeCiudad(x.ciudad) === claveDeCiudad(ciudad));
  const t = c?.topes.find((x) => x.vehiculo === vehiculo);
  if (!c || !t) return null;
  return {
    ciudad: c.ciudad,
    norma: c.norma,
    vigenteDesde: c.vigente_desde,
    porMinuto: t.por_minuto,
  };
}

/** Un tope de más de 13 meses puede estar viejo: la norma cambia cada año (§9.2 regla 3). */
export const MESES_DE_VIGENCIA = 13;

/**
 * «El tope de Bogotá no está actualizado» si el de la ciudad tiene más de 13 meses; si no, `null`.
 * La caja sigue cobrando: el aviso no la detiene (P1, P15). `hoy` es `AAAA-MM-DD` de Bogotá.
 */
export function avisoDeTopeViejo(
  ciudad: string | undefined,
  hoy: string,
  topes: TopesDeCiudades = TOPES,
): string | null {
  if (!ciudad) return null;
  const c = topes.ciudades.find((x) => claveDeCiudad(x.ciudad) === claveDeCiudad(ciudad));
  if (!c) return null;
  const [a, m, d] = c.vigente_desde.split('-').map(Number) as [number, number, number];
  const limite = new Date(Date.UTC(a, m - 1 + MESES_DE_VIGENCIA, d)).toISOString().slice(0, 10);
  return hoy > limite ? `El tope de ${c.ciudad} no está actualizado` : null;
}
