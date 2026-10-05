/**
 * Kill switches del CORE (HU-E8.1, HU-C3.6, PLATAFORMA §4.10). Viven en el KV de flags de la celda
 * del CORE; el despliegue crea las claves que faltan en `encendido` y nunca toca las que existen.
 *
 * - `ks:core` apaga todo el CORE: entrar, renovar, organizaciones, equipo, pagos y Drive.
 * - `ks:agro-core` es el nombre de antes, y apaga lo mismo mientras dure la transición (P10): hay
 *   runbooks y hábitos que lo nombran. Cualquiera de las dos en `apagado` apaga.
 * - `ks:core:<producto>` apaga lo mismo, pero solo para un producto.
 * - `ks:core:pagos` apaga los cobros de planes de todos los productos, y nada más.
 */

/** El nombre de antes del kill switch de todo el CORE (`ks:agro-core`). */
export const PRODUCTO_CORE = 'agro-core';
/** Todo el CORE (`ks:core`). */
export const KS_CORE = 'core';
/** Los cobros de planes de todos los productos (`ks:core:pagos`). */
export const KS_PAGOS = 'core:pagos';
/** Todo lo del CORE para un producto (`ks:core:<producto>`). */
export const ksDelProducto = (producto: string): string => `core:${producto}`;

/** Los ids de kill switch que el despliegue del CORE asegura, para los productos dados. */
export function killSwitchesDelCore(productos: readonly string[]): string[] {
  return [PRODUCTO_CORE, KS_CORE, KS_PAGOS, ...productos.map(ksDelProducto)];
}
