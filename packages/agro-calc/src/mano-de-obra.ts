/**
 * Mano de obra (HU-E7.2): el valor del jornal que rige en una fecha y el costo de unas horas. Se
 * calcula en el navegador (ADR-5). Casos en `casos/mano-de-obra.json`.
 *
 * - Un valor rige desde su fecha hasta que otro lo reemplaza: cambiarlo no toca lo pasado (CA1).
 * - Sin un valor que rija, el costo no se conoce: nulo, nunca 0 (P1).
 * - `costo = horas / horas por jornal × valor del jornal`. Un jornal son 8 horas.
 * - No liquida nómina, recargos, horas extra ni prestaciones (CA3): es el costo de referencia
 *   para saber cuánto cuesta producir.
 */

export const HORAS_POR_JORNAL = 8;

export interface ValorConVigencia {
  /** AAAA-MM-DD desde la que rige. */
  desde: string;
  valor: number;
  /** Para desempatar dos valores del mismo día: el más reciente gana. */
  actualizado?: string;
}

/** El valor que rige en `fecha` (AAAA-MM-DD), o null si ninguno había empezado. */
export function valorVigente(valores: readonly ValorConVigencia[], fecha: string): number | null {
  const candidatos = valores
    .filter((v) => v.desde <= fecha)
    .sort(
      (a, b) =>
        b.desde.localeCompare(a.desde) || (b.actualizado ?? '').localeCompare(a.actualizado ?? ''),
    );
  return candidatos[0]?.valor ?? null;
}

/** Costo de `horas` con un jornal de `valorJornal`; null si no se conoce el valor. */
export function costoDeHoras(
  horas: number,
  valorJornal: number | null,
  horasPorJornal = HORAS_POR_JORNAL,
): number | null {
  if (valorJornal === null || !(horas >= 0) || !(horasPorJornal > 0)) return null;
  return Math.round((horas / horasPorJornal) * valorJornal);
}
