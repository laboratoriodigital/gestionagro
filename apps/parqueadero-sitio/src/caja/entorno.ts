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

/** En prueba, la primera línea de todo lo que se imprime dice PRUEBA. */
export function conMarcaDeEntorno(bloques: readonly Bloque[], hostname: string): Bloque[] {
  if (esProduccion(hostname)) return [...bloques];
  return [
    { tipo: 'texto', texto: '*** PRUEBA: NO VALE ***', alinear: 'centro', negrita: true },
    ...bloques,
  ];
}
