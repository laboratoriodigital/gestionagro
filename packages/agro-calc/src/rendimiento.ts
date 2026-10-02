/**
 * Rendimiento por área y por planta (HU-E6.6). Se calcula en el navegador (ADR-5).
 *
 * - **Comercial:** lo cosechado menos el descarte, que es lo que se vende.
 * - `por m² = comercial / área en m²`.
 * - `por planta = comercial / plantas`. Sin el número de plantas del ciclo no se calcula: nulo, no
 *   cero (P1).
 * - En la unidad de la cosecha (kg, tallos, cajas): no se convierte entre unidades.
 *
 * Casos en `casos/rendimiento.json`.
 */
import { ErrorDeMedida, exigirRango } from './medida.ts';

const MAXIMO = 100_000_000;

export interface Rendimiento {
  /** Lo cosechado menos el descarte. */
  comercial: number;
  porM2: number;
  /** Nulo si no se sabe cuántas plantas tiene el ciclo. */
  porPlanta: number | null;
  /** % de lo cosechado que fue descarte; nulo si no se cosechó nada. */
  descartePct: number | null;
}

export function rendimiento(entrada: {
  cosechado: number;
  descarte: number;
  areaM2: number;
  plantas: number | null;
}): Rendimiento {
  const cosechado = exigirRango('cosechado', entrada.cosechado, 0, MAXIMO);
  const descarte = exigirRango('descarte', entrada.descarte, 0, MAXIMO);
  const area = exigirRango('areaM2', entrada.areaM2, 0, MAXIMO);
  if (descarte > cosechado) {
    throw new ErrorDeMedida('descarte', '«descarte» no puede ser mayor que lo cosechado');
  }
  if (area === 0) {
    throw new ErrorDeMedida('areaM2', '«areaM2» debe ser mayor que 0 para calcular por m²');
  }
  let plantas: number | null = null;
  if (entrada.plantas !== null) {
    plantas = exigirRango('plantas', entrada.plantas, 0, MAXIMO);
    if (plantas === 0) {
      throw new ErrorDeMedida('plantas', '«plantas» debe ser mayor que 0 para calcular por planta');
    }
  }
  const comercial = cosechado - descarte;
  return {
    comercial,
    porM2: comercial / area,
    porPlanta: plantas === null ? null : comercial / plantas,
    descartePct: cosechado === 0 ? null : (descarte / cosechado) * 100,
  };
}

/** «2,35»: hasta dos decimales y coma decimal; «1.250» con punto de miles. */
export function formatearCantidad(valor: number, decimales = 2): string {
  return valor.toLocaleString('es-CO', { maximumFractionDigits: decimales });
}
