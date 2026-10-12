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
  /** false para un producto sin organizaciones, como la cuenta (ADR-28). */
  organizaciones?: boolean;
  tipos: string[];
  roles: RolDeProducto[];
  /** Ruta del `planes.json` del producto. Solo con organizaciones. */
  planes?: string;
  /** Ruta de la política de datos del producto. */
  politica: string;
  prefijo_de_cobro?: string;
  gracia_dias?: number;
  /**
   * Con Workers Paid: USD al mes encima de la base y lo que se apaga al agotarlo (HU-C11.1). En el
   * plan gratuito, además, las filas de D1 que el producto puede escribir al día de las 100.000 de
   * toda la cuenta: el vigía dice quién las gasta (HU-Q7.13).
   */
  presupuesto?: { usd_mes: number; al_agotarse: string[]; d1_filas_escritas_dia?: number };
  /**
   * Las claves de kill switch del producto (`ks:<id>` y `ks:<id>-<capacidad>`), que el despliegue
   * crea en `encendido` en el KV de flags de las celdas del producto (HU-Q7.13).
   */
  kill_switches?: string[];
  /** Lo que un agente puede pedir sobre una organización del producto (HU-C9.2). */
  alcances?: AlcanceDeProducto[];
}

/** Un alcance de OAuth: su id lleva el producto delante (`agro:registros:leer`). */
export interface AlcanceDeProducto {
  id: string;
  /** Lo que se lee en la pantalla de consentimiento. */
  descripcion: string;
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
  for (const prefijo of repetidos(productos.flatMap((p) => p.prefijo_de_cobro ?? []))) {
    fallas.push(`dos productos usan el prefijo de cobro «${prefijo}»`);
  }
  for (const p of productos) {
    const conOrganizaciones = tieneOrganizaciones(p);
    if (conOrganizaciones && !p.roles.some((r) => r.administra)) {
      fallas.push(`«${p.id}» no tiene ningún rol que administre: nadie podría pagar ni invitar`);
    }
    for (const rol of repetidos(p.roles.map((r) => r.id))) {
      fallas.push(`«${p.id}» declara dos veces el rol «${rol}»`);
    }
    if (conOrganizaciones && !p.roles.some((r) => r.invitable)) {
      fallas.push(`«${p.id}» no tiene ningún rol invitable: nadie podría sumarse a un equipo`);
    }
    // HU-C11.1, CA3: el presupuesto apaga capacidades propias del producto, nunca la venta. Ni el
    // producto entero (`ks:<id>`), ni el CORE ni sus cobros, ni la capacidad de otro producto.
    for (const clave of p.presupuesto?.al_agotarse ?? []) {
      if (!clave.startsWith(`ks:${p.id}-`) && !clave.startsWith(`ks:${p.id}:`)) {
        fallas.push(
          `«${p.id}».presupuesto.al_agotarse no puede apagar «${clave}»: solo capacidades propias, nunca la venta`,
        );
      }
    }
    // HU-Q7.13: un producto declara solo sus propias claves; las del CORE las crea el CORE.
    for (const clave of p.kill_switches ?? []) {
      if (clave !== `ks:${p.id}` && !clave.startsWith(`ks:${p.id}-`)) {
        fallas.push(
          `«${p.id}».kill_switches no puede declarar «${clave}»: solo ks:${p.id} y ks:${p.id}-…`,
        );
      }
    }
    for (const clave of p.presupuesto?.al_agotarse ?? []) {
      if (p.kill_switches && !p.kill_switches.includes(clave)) {
        fallas.push(
          `«${p.id}».presupuesto.al_agotarse apaga «${clave}», que no está en sus kill_switches`,
        );
      }
    }
    if (existe) {
      for (const [campo, ruta] of [
        ['planes', p.planes],
        ['politica', p.politica],
      ] as const) {
        if (ruta !== undefined && !existe(ruta))
          fallas.push(`«${p.id}».${campo} apunta a «${ruta}», que no existe`);
      }
    }
  }
  return fallas;
}

/** Si el producto tiene organizaciones: todos, salvo los que dicen `organizaciones: false` (ADR-28). */
export function tieneOrganizaciones(producto: Producto): boolean {
  return producto.organizaciones !== false;
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

// --- Planes y precios por periodo (HU-C1.2, PLATAFORMA §4.2 y §4.8, ADR-22) ---

/**
 * Los periodos de prepago, en meses. La base los tiene en la tabla `periodo` (migración 0006):
 * una prueba exige que digan lo mismo (P2). Uno nuevo es un INSERT, no una reconstrucción (PC1).
 */
export const PERIODOS = [1, 3, 6, 12] as const;

/** Cómo se llama cada periodo en la tabla `periodo` (los de la siembra de la 0006). */
export const NOMBRE_DE_PERIODO: Record<(typeof PERIODOS)[number], string> = {
  1: 'mensual',
  3: 'trimestral',
  6: 'semestral',
  12: 'anual',
};

/** Mínimo de un cobro con Bold, en pesos. */
export const MONTO_MINIMO_COP = 1000;

export interface PlanConCobro {
  id: string;
  /** El plan que se entrega sin pagar o al vencer (HU-C2.3). Exactamente uno por producto. */
  gratuito?: boolean;
  /** Lo que el CORE cobra por un mes (HU-E0.7). Convive con `cobro` mientras haya dos campos. */
  cobro_mensual_cop?: number;
  /** Monto por periodo: la clave son meses de `PERIODOS`. Un periodo sin monto no se ofrece. */
  cobro?: Record<string, number>;
}

/**
 * Exactamente un plan gratuito por producto, y sin cobro (HU-C2.3): es el que el directorio entrega
 * sin pagar o al vencer, así que no se adivina por su nombre.
 */
export function fallasDeGratuito(planes: readonly PlanConCobro[]): string[] {
  const fallas: string[] = [];
  const gratuitos = planes.filter((p) => p.gratuito === true);
  if (gratuitos.length !== 1) {
    fallas.push(
      `tiene que haber exactamente un plan con "gratuito": true, y hay ${gratuitos.length}${gratuitos.length > 1 ? ` (${gratuitos.map((p) => p.id).join(', ')})` : ''}`,
    );
  }
  for (const p of gratuitos.filter((x) => x.cobro || x.cobro_mensual_cop !== undefined)) {
    fallas.push(`«${p.id}» es gratuito y tiene cobro`);
  }
  return fallas;
}

/** Todas las reglas de los planes de un producto: el gratuito y los precios por periodo. */
export function fallasDePlanes(planes: readonly PlanConCobro[]): string[] {
  return [...fallasDeGratuito(planes), ...fallasDeCobro(planes)];
}

/** Reglas de los precios por periodo de los planes de un producto. Todas las fallas a la vez (P15). */
export function fallasDeCobro(planes: readonly PlanConCobro[]): string[] {
  const fallas: string[] = [];
  for (const p of planes) {
    const cobro = p.cobro;
    if (!cobro) continue;
    for (const [meses, monto] of Object.entries(cobro)) {
      if (!(PERIODOS as readonly number[]).includes(Number(meses))) {
        fallas.push(
          `«${p.id}» cobra ${meses} meses, que no es un periodo (${PERIODOS.join(', ')})`,
        );
      }
      if (!Number.isInteger(monto) || monto < MONTO_MINIMO_COP) {
        fallas.push(
          `«${p.id}» cobra ${monto} por ${meses} meses: tiene que ser un entero de al menos COP ${MONTO_MINIMO_COP}`,
        );
      }
    }
    if (p.cobro_mensual_cop !== undefined && cobro['1'] !== p.cobro_mensual_cop) {
      fallas.push(
        `«${p.id}»: cobro["1"] (${cobro['1']}) no es cobro_mensual_cop (${p.cobro_mensual_cop})`,
      );
    }
    // A más meses, el mes no sale más caro: el valor por mes no crece con el periodo.
    const ofrecidos = PERIODOS.filter((n) => cobro[String(n)] !== undefined);
    for (let i = 1; i < ofrecidos.length; i++) {
      const [corto, largo] = [ofrecidos[i - 1] as number, ofrecidos[i] as number];
      const porMesCorto = (cobro[String(corto)] as number) / corto;
      const porMesLargo = (cobro[String(largo)] as number) / largo;
      if (porMesLargo > porMesCorto) {
        fallas.push(
          `«${p.id}»: a ${largo} meses el mes sale más caro (${Math.round(porMesLargo)}) que a ${corto} (${Math.round(porMesCorto)})`,
        );
      }
    }
  }
  return fallas;
}
