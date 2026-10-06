/**
 * Los productos que el CORE atiende (HU-C3.1, PLATAFORMA §4.2 y §4.7, ADR-20).
 *
 * El Worker no tiene sistema de archivos: importa `infrastructure/productos.json` y la política de
 * cada producto al compilar (P2: la misma fuente que el despliegue copia a la base). Lo que cada
 * solicitud necesita saber —qué producto es, de dónde puede venir su app y a qué pantallas se
 * vuelve, qué política vale— sale de aquí, sin consultar la base.
 */
import type { Producto, RegistroDeProductos } from '@ed1/productos';
import politicaAgro from '../../../content/agro/privacidad/politica.json' with { type: 'json' };
import registro from '../../../infrastructure/productos.json' with { type: 'json' };

export interface CatalogoDelCore {
  productos: readonly Producto[];
  /** La versión vigente de la política de datos de cada producto. */
  politicas: Readonly<Record<string, string>>;
}

/**
 * El catálogo real. Una prueba exige que cada producto de `productos.json` tenga aquí su política
 * (P2): agregar un producto es sumar su `import` de la política junto a la del agro.
 */
export const CATALOGO: CatalogoDelCore = {
  productos: (registro as RegistroDeProductos).productos,
  politicas: { agro: politicaAgro.version },
};

/**
 * El producto de una solicitud que no dice cuál. Es el agro mientras dure la transición (P10): los
 * cuadernos instalados no mandan `producto`. Se retira al contraer (HU-C3.8).
 */
export const PRODUCTO_POR_DEFECTO = 'agro';

export type MotivoDeProducto = 'no-existe' | 'pausado' | 'retirado';

/** El producto pedido, o el motivo por el que no se atiende. */
export function productoDe(
  catalogo: CatalogoDelCore,
  id: string | undefined,
): { producto: Producto } | { motivo: MotivoDeProducto } {
  const producto = catalogo.productos.find((p) => p.id === (id ?? PRODUCTO_POR_DEFECTO));
  if (!producto) return { motivo: 'no-existe' };
  if (producto.estado !== 'activo') return { motivo: producto.estado };
  return { producto };
}

/**
 * De dónde puede venir la app de un producto. El agro los toma de `ORIGENES_APP` (que sale de
 * `celdas.json › sitio`, su única fuente); los demás, de los que declaran en `productos.json`.
 */
export function origenesDelProducto(
  producto: Producto,
  origenesDeLaCelda: readonly string[],
): readonly string[] {
  return producto.app.origenes === 'celdas.json › sitio'
    ? origenesDeLaCelda
    : [producto.app.origenes.produccion, producto.app.origenes.staging];
}

/**
 * La pantalla a la que se vuelve, si es de un origen y una ruta del producto; si no, null. Sin esto,
 * cualquiera podría mandar el código de entrada a su propio sitio, o a la app de otro producto.
 */
export function vueltaDelProducto(
  vuelta: string | undefined,
  producto: Producto,
  origenesDeLaCelda: readonly string[],
): string | null {
  if (!vuelta) return null;
  let url: URL;
  try {
    url = new URL(vuelta);
  } catch {
    return null;
  }
  if (!origenesDelProducto(producto, origenesDeLaCelda).includes(url.origin)) return null;
  if (!producto.app.rutas_de_vuelta.some((ruta) => url.pathname.startsWith(ruta))) return null;
  return `${url.origin}${url.pathname}`;
}
