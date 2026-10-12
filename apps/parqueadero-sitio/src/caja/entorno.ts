/**
 * Dónde corre la caja. Solo el host de producción (ADR-40, HU-Q5.2) imprime recibos de verdad:
 * cualquier otro, staging, `localhost` o uno que no se conoce, marca «PRUEBA» (HU-Q5.1 CA2). Un
 * host desconocido cuenta como prueba, nunca al revés (P1).
 */
import type { Bloque } from '@ed1/impresion';

export const HOST_DE_PRODUCCION = 'parqueadero.laboratorio-digital.app';

export function esProduccion(hostname: string): boolean {
  return hostname === HOST_DE_PRODUCCION;
}

/**
 * Adónde lleva el enlace del recibo: en producción, `ORIGEN_DEL_RECIBO` de
 * `@ed1/parqueadero-recibos` (una prueba lo compara); en staging, su propia `/r/`, para que los
 * recibos de PRUEBA se puedan abrir antes de que exista el dominio (HU-Q5.2).
 */
export function origenDelRecibo(lugar: { hostname: string; origin: string }): string {
  return esProduccion(lugar.hostname) ? `https://${HOST_DE_PRODUCCION}/r/` : `${lugar.origin}/r/`;
}

/** En prueba, la primera línea de todo lo que se imprime dice PRUEBA. */
export function conMarcaDeEntorno(bloques: readonly Bloque[], hostname: string): Bloque[] {
  if (esProduccion(hostname)) return [...bloques];
  return [
    { tipo: 'texto', texto: '*** PRUEBA: NO VALE ***', alinear: 'centro', negrita: true },
    ...bloques,
  ];
}

/** El CORE de las cuentas según el host (`celdas.json`, HU-Q7.6): staging fuera de producción. */
export function urlDelCore(
  hostname: string,
  config: { url: string; url_staging: string } = __CORE__,
): string {
  return esProduccion(hostname) ? config.url : config.url_staging;
}
