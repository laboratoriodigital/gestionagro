/**
 * Los productos que el CORE atiende (HU-C3.1, PLATAFORMA §4.2 y §4.7, ADR-20).
 *
 * El Worker no tiene sistema de archivos: importa `infrastructure/productos.json` y la política de
 * cada producto al compilar (P2: la misma fuente que el despliegue copia a la base). Lo que cada
 * solicitud necesita saber —qué producto es, de dónde puede venir su app y a qué pantallas se
 * vuelve, qué política vale— sale de aquí, sin consultar la base.
 */
import type { BaseD1 } from '@ed1/d1';
import type { Producto, RegistroDeProductos } from '@ed1/productos';
import planesAgro from '../../../content/agro/cuaderno/planes.json' with { type: 'json' };
import politicaAgro from '../../../content/agro/privacidad/politica.json' with { type: 'json' };
import registro from '../../../infrastructure/productos.json' with { type: 'json' };

export interface CatalogoDelCore {
  productos: readonly Producto[];
  /** La versión vigente de la política de datos de cada producto. */
  politicas: Readonly<Record<string, string>>;
  /** Los planes de cada producto, de su `planes.json` (HU-C3.4). */
  planes: Readonly<Record<string, readonly PlanDelProducto[]>>;
}

/** Lo que el CORE usa de un plan: su nombre, si es el gratuito y lo que cobra por un mes. */
export interface PlanDelProducto {
  id: string;
  nombre: string;
  gratuito?: boolean;
  cobro_mensual_cop?: number;
}

/**
 * El catálogo real. Una prueba exige que cada producto de `productos.json` tenga aquí su política
 * y sus planes (P2): agregar un producto es sumar sus dos `import` junto a los del agro.
 */
export const CATALOGO: CatalogoDelCore = {
  productos: (registro as RegistroDeProductos).productos,
  politicas: { agro: politicaAgro.version },
  planes: { agro: planesAgro.planes },
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

/** Si ese rol administra las organizaciones de ese producto: paga, invita y maneja el equipo. */
export function rolAdministra(catalogo: CatalogoDelCore, producto: string, rol: string): boolean {
  return (
    catalogo.productos
      .find((p) => p.id === producto)
      ?.roles.some((r) => r.id === rol && r.administra) ?? false
  );
}

/** Los roles que se pueden dar con una invitación en ese producto. */
export function rolesInvitablesDe(catalogo: CatalogoDelCore, producto: string): string[] {
  return (
    catalogo.productos
      .find((p) => p.id === producto)
      ?.roles.filter((r) => r.invitable)
      .map((r) => r.id) ?? []
  );
}

/**
 * El producto de una organización, de la base (HU-C3.2). El token v1 no lo trae: cuando lo traiga
 * (tokens v2, HU-C4.3), esta lectura sobra para las rutas con organización.
 */
export async function productoDeOrganizacion(db: BaseD1, orgId: string): Promise<string | null> {
  const fila = await db
    .prepare('SELECT producto FROM organizacion WHERE id = ?')
    .bind(orgId)
    .first<{ producto: string }>();
  return fila?.producto ?? null;
}

/** Los planes de un producto; ninguno si el producto no está en el catálogo. */
export function planesDe(catalogo: CatalogoDelCore, producto: string): readonly PlanDelProducto[] {
  return catalogo.planes[producto] ?? [];
}

/**
 * Lo que se cobra en línea por un mes de ese plan de ese producto, o null si no se paga en línea.
 * Un plan de otro producto no existe aquí: el nombre se busca solo entre los del producto.
 */
export function cobroMensual(
  catalogo: CatalogoDelCore,
  producto: string,
  plan: string,
): number | null {
  const monto = planesDe(catalogo, producto).find((p) => p.id === plan)?.cobro_mensual_cop;
  // Bold no abre pagos de menos de $1.000.
  return typeof monto === 'number' && Number.isInteger(monto) && monto >= 1000 ? monto : null;
}

/**
 * Todos los orígenes que el CORE atiende: la unión de los de cada producto que no está retirado
 * (HU-C3.5). Es lo que CORS deja leer; qué producto puede usar cada ruta lo decide aparte el
 * origen de la sesión, porque estar en la unión no basta.
 */
export function origenesDeTodos(
  catalogo: CatalogoDelCore,
  origenesDeLaCelda: readonly string[],
): readonly string[] {
  const todos = catalogo.productos
    .filter((p) => p.estado !== 'retirado')
    .flatMap((p) => origenesDelProducto(p, origenesDeLaCelda));
  return [...new Set(todos)];
}
