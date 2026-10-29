/**
 * Lo que cobra Bold por un pago en línea, antes del IVA de la comisión: la tabla de TIENDA-3.0 §9.7,
 * que sale del Estudio §10.2 con el tarifario público de Bold (oferta observada, no una cotización).
 * La paga el comercio. Una sola tabla para la pantalla de cobro del panel y la calculadora de
 * precios de tiendapro.co (HU-P5.2), que dice la fecha en que se consultó.
 */

/** Cuándo se consultó el tarifario de Bold (el corte del Estudio). */
export const COMISIONES_CONSULTADAS = '2026-10-04';
/** El IVA de la comisión, en porcentaje: Bold lo cobra encima. */
export const IVA_DE_LA_COMISION = 19;

export interface ComisionDeBold {
  id: string;
  medio: string;
  /** El porcentaje en centésimas: 299 es el 2,99 %. */
  centesimas: number;
  /** El cargo fijo por pago, en pesos; `null` si no tiene. */
  fijoCop: number | null;
}

export const COMISIONES_DE_BOLD: readonly ComisionDeBold[] = [
  { id: 'tarjeta', medio: 'Tarjeta Visa o Mastercard', centesimas: 299, fijoCop: 900 },
  { id: 'pse', medio: 'PSE, Bancolombia y billeteras', centesimas: 289, fijoCop: 900 },
  { id: 'qr', medio: 'QR en línea', centesimas: 289, fijoCop: null },
  { id: 'inmediato', medio: 'Depósito inmediato', centesimas: 359, fijoCop: 900 },
];

/** «2,99 %». */
export const porcentajeEnTexto = (centesimas: number): string =>
  `${(centesimas / 100).toFixed(2).replace('.', ',')} %`;
