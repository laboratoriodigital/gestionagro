/**
 * Productos del CORE (PLATAFORMA §4.2, ADR-20, HU-C1.1).
 *
 * Tipos y reglas que el esquema JSON no puede decir: ids repetidos, un producto sin quien
 * administre, prefijos de cobro compartidos. No lee archivos ni carga Ajv: lo usa también el
 * Worker del CORE, que no tiene sistema de archivos y no debe cargar con un validador de
 * esquemas (presupuesto del Worker). La lectura y el esquema están en
 * `scripts/lib/registro-productos.ts`.
 */

export type EstadoProducto = 'activo' | 'pausado' | 'retirado';

export interface RolDeProducto {
  id: string;
  /** Paga, invita, cambia roles y quita personas. */
  administra: boolean;
  invitable: boolean;
}

export interface Producto {
  id: string;
  nombre: string;
  estado: EstadoProducto;
  excepcion?: string;
  app: {
    /** El agro los toma de `celdas.json › sitio`, su única fuente (P2). */
    origenes: 'celdas.json › sitio' | { produccion: string; staging: string };
    rutas_de_vuelta: string[];
  };
  tipos: string[];
  roles: RolDeProducto[];
  /** Ruta del `planes.json` del producto. */
  planes: string;
  /** Ruta de la política de datos del producto. */
  politica: string;
  prefijo_de_cobro: string;
  gracia_dias: number;
}

export interface RegistroDeProductos {
  productos: Producto[];
}

/** Lo que se repite en una lista, una vez cada uno. */
function repetidos(valores: readonly string[]): string[] {
  return [...new Set(valores.filter((v, i) => valores.indexOf(v) !== i))];
}

/**
 * Reglas del registro que el esquema no expresa. Devuelve todas las fallas a la vez (P15).
 * `existe` dice si una ruta del repositorio existe; en un Worker no se llama.
 */
export function fallasDelRegistro(
  registro: RegistroDeProductos,
  existe?: (ruta: string) => boolean,
): string[] {
  const fallas: string[] = [];
  const { productos } = registro;
  for (const id of repetidos(productos.map((p) => p.id))) {
    fallas.push(`el producto «${id}» está dos veces`);
  }
  for (const prefijo of repetidos(productos.map((p) => p.prefijo_de_cobro))) {
    fallas.push(`dos productos usan el prefijo de cobro «${prefijo}»`);
  }
  for (const p of productos) {
    if (!p.roles.some((r) => r.administra)) {
      fallas.push(`«${p.id}» no tiene ningún rol que administre: nadie podría pagar ni invitar`);
    }
    for (const rol of repetidos(p.roles.map((r) => r.id))) {
      fallas.push(`«${p.id}» declara dos veces el rol «${rol}»`);
    }
    if (!p.roles.some((r) => r.invitable)) {
      fallas.push(`«${p.id}» no tiene ningún rol invitable: nadie podría sumarse a un equipo`);
    }
    if (existe) {
      for (const [campo, ruta] of [
        ['planes', p.planes],
        ['politica', p.politica],
      ] as const) {
        if (!existe(ruta)) fallas.push(`«${p.id}».${campo} apunta a «${ruta}», que no existe`);
      }
    }
  }
  return fallas;
}

/** El producto con ese id, o `undefined`. Uno retirado se devuelve igual: hay filas que lo nombran. */
export function productoPorId(registro: RegistroDeProductos, id: string): Producto | undefined {
  return registro.productos.find((p) => p.id === id);
}

/** Roles que se pueden ofrecer en una invitación de ese producto. */
export function rolesInvitables(producto: Producto): string[] {
  return producto.roles.filter((r) => r.invitable).map((r) => r.id);
}

/** Roles con los que se administra una organización de ese producto. */
export function rolesQueAdministran(producto: Producto): string[] {
  return producto.roles.filter((r) => r.administra).map((r) => r.id);
}
