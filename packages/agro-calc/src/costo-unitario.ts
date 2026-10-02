/**
 * Costo por unidad cosechada y margen de un ciclo (HU-E7.3). Casos en `casos/costo-unitario.json`.
 *
 * - **Costo** = insumos + mano de obra. Es lo registrado en el cuaderno; arriendo, depreciación,
 *   empaques, transporte y servicios no están, y quien muestra el número lo dice (CA3).
 * - **Por unidad** = costo / lo vendible (cosechado − descarte), en la unidad de la cosecha. Sin
 *   nada vendible no hay costo por unidad: nunca se divide por cero ni se muestra 0 (P1).
 * - **Margen** = ingresos de los despachos − costo. Sin ventas no hay margen (null), no un margen
 *   negativo igual al costo.
 * - Si algún costo o algún precio de venta no se conoce, el resultado se calcula con lo conocido y
 *   se marca incompleto: quien lo muestra dice «al menos» y cuántos faltan. Nunca suma 0 por ellos.
 */

export interface EntradaCostoUnitario {
  /** Pesos de insumos aplicados con costo conocido. */
  insumos: number;
  /** Pesos de mano de obra con jornal conocido. */
  manoDeObra: number;
  /** Aplicaciones o jornales cuyo costo no se conoce. */
  costosSinDato: number;
  /** Cantidad vendible producida, en la unidad de la cosecha. */
  vendible: number;
  /** Pesos vendidos con precio conocido. */
  ingresos: number;
  /** Despachos que tocaron el ciclo. */
  ventas: number;
  /** De esos, los que no tienen precio. */
  ventasSinPrecio: number;
}

export interface CostoUnitario {
  costo: number;
  costoCompleto: boolean;
  /** Pesos por unidad vendible; null si no hay nada vendible. */
  porUnidad: number | null;
  /** Ingresos − costo; null si no hubo ventas. */
  margen: number | null;
  margenCompleto: boolean;
}

const pesos = (n: number) => Math.round(n);

export function costoUnitario(e: EntradaCostoUnitario): CostoUnitario {
  const costo = pesos(e.insumos + e.manoDeObra);
  const costoCompleto = e.costosSinDato === 0;
  return {
    costo,
    costoCompleto,
    porUnidad: Number.isFinite(e.vendible) && e.vendible > 0 ? pesos(costo / e.vendible) : null,
    margen: e.ventas > 0 ? pesos(e.ingresos) - costo : null,
    margenCompleto: costoCompleto && e.ventasSinPrecio === 0,
  };
}
