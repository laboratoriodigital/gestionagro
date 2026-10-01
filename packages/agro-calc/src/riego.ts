/**
 * Riego en sustrato (HU-E3.7). El porcentaje de drenaje dice si se riega de más o de menos.
 *
 * `% drenaje = volumen drenado / volumen aplicado × 100`. Ambos en la misma unidad (mL por gotero
 * o L por área); la unidad se cancela. Casos en `casos/drenaje.json`.
 */
import { ErrorDeMedida, exigirRango } from './medida.ts';

/** Rango aceptado de volumen: hasta 1.000.000 (L por área de una finca grande). */
const VOLUMEN_MAXIMO = 1_000_000;

/** Rangos válidos de las mediciones de la solución (HU-E3.7, CA2). */
export const RANGO_CE_DS_M = [0, 10] as const;
export const RANGO_PH = [3, 10] as const;

/**
 * Porcentaje de drenaje. Lanza ErrorDeMedida si lo aplicado no es mayor que 0, si un valor no es
 * un número o si lo drenado supera lo aplicado: nunca devuelve un porcentaje inventado (P1).
 */
export function drenajePct(volumenAplicado: number, volumenDrenado: number): number {
  const aplicado = exigirRango('volumenAplicado', volumenAplicado, 0, VOLUMEN_MAXIMO);
  const drenado = exigirRango('volumenDrenado', volumenDrenado, 0, VOLUMEN_MAXIMO);
  if (aplicado === 0) {
    throw new ErrorDeMedida(
      'volumenAplicado',
      '«volumenAplicado» debe ser mayor que 0 para calcular el drenaje',
    );
  }
  if (drenado > aplicado) {
    throw new ErrorDeMedida(
      'volumenDrenado',
      '«volumenDrenado» no puede ser mayor que lo aplicado',
    );
  }
  return (drenado / aplicado) * 100;
}

/** «30 %» o «30,5 %»: hasta un decimal y coma decimal. */
export function formatearPct(valor: number): string {
  const redondeado = Math.round(valor * 10) / 10;
  return `${String(redondeado).replace('.', ',')} %`;
}
