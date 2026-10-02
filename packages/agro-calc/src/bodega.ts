/**
 * Bodega de un insumo con costo promedio ponderado (HU-E7.1, CA2). Se calcula en el navegador
 * (ADR-5). Casos en `casos/bodega.json`.
 *
 * Los movimientos van en orden de tiempo:
 * - **Entrada** (compra): suma a la existencia. Con precio, el costo unitario pasa a
 *   `(existencia × costo + precio) / (existencia + cantidad)`. Sin precio, el costo del inventario
 *   deja de conocerse: queda nulo hasta que la existencia vuelva a 0 o menos y entre una compra con
 *   precio. Nunca se inventa un precio (P1).
 * - **Ajuste**: suma o resta cantidad al costo vigente (un conteo de bodega).
 * - **Salida** (aplicación): resta la cantidad y cuesta `cantidad × costo vigente`, o nulo si el
 *   costo no se conoce.
 * - Una existencia negativa no se bloquea (CA3): se marca, porque falta registrar algo.
 */

export type Movimiento =
  | { id: string; tipo: 'entrada'; cantidad: number; precioTotal: number | null }
  | { id: string; tipo: 'ajuste'; cantidad: number }
  | { id: string; tipo: 'salida'; cantidad: number };

export interface Bodega {
  existencia: number;
  /** Costo de una unidad del inventario; nulo si alguna entrada no tiene precio. */
  costoUnitario: number | null;
  /** Costo de cada salida, por id; nulo si no se conocía el costo en ese momento. */
  costoDeSalida: Map<string, number | null>;
  /** Alguna vez la existencia quedó por debajo de 0: falta registrar algo. */
  quedoNegativa: boolean;
}

const redondear = (x: number) => Math.round(x * 1e6) / 1e6;

export function bodega(movimientos: readonly Movimiento[]): Bodega {
  let existencia = 0;
  // Sin ninguna compra con precio, el costo no se conoce: nulo, no 0 (P1).
  let costo: number | null = null;
  let quedoNegativa = false;
  const costoDeSalida = new Map<string, number | null>();
  for (const m of movimientos) {
    if (!(Number.isFinite(m.cantidad) && m.cantidad !== 0)) continue;
    if (m.tipo === 'entrada') {
      const cantidad = Math.abs(m.cantidad);
      if (m.precioTotal === null) {
        costo = null;
      } else if (existencia <= 0 || costo === null) {
        // Sin inventario anterior que promediar (o era desconocido y ya se gastó): el precio nuevo.
        costo = existencia <= 0 ? m.precioTotal / cantidad : null;
      } else {
        costo = (existencia * costo + m.precioTotal) / (existencia + cantidad);
      }
      existencia += cantidad;
    } else if (m.tipo === 'ajuste') {
      existencia += m.cantidad;
    } else {
      const cantidad = Math.abs(m.cantidad);
      costoDeSalida.set(m.id, costo === null ? null : redondear(cantidad * costo));
      existencia -= cantidad;
    }
    existencia = redondear(existencia);
    if (existencia < 0) quedoNegativa = true;
  }
  return {
    existencia,
    costoUnitario: costo === null ? null : redondear(costo),
    costoDeSalida,
    quedoNegativa,
  };
}
