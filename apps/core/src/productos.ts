/**
 * Los productos que el CORE atiende (HU-C3.1, PLATAFORMA §4.2 y §4.7, ADR-20).
 *
 * El Worker no tiene sistema de archivos: importa `infrastructure/productos.json` y el catálogo
 * generado con la política y los planes de cada producto al compilar (P2: la misma fuente que el
 * despliegue copia a la base). Lo que cada
 * solicitud necesita saber —qué producto es, de dónde puede venir su app y a qué pantallas se
 * vuelve, qué política vale— sale de aquí, sin consultar la base.
 */
import type { BaseD1 } from '@ed1/d1';
import type { Producto, RegistroDeProductos } from '@ed1/productos';
import registro from '../../../infrastructure/productos.json' with { type: 'json' };
import registroDePrueba from '../../../infrastructure/productos-de-prueba.json' with {
  type: 'json',
};
import generado from './catalogo.generado.json' with { type: 'json' };

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
 * El catálogo real. Las versiones de las políticas y los planes salen de
 * `catalogo.generado.json`, que `scripts/generar-catalogo-core.ts` arma desde el `planes.json` y la
 * política de cada producto (P2); una prueba exige que esté al día. Agregar un producto es un
 * archivo y ese comando: ningún archivo de código del CORE nombra un producto (R1, HU-Q7.1).
 */
export const CATALOGO: CatalogoDelCore = {
  productos: (registro as RegistroDeProductos).productos,
  politicas: generado.real.politicas,
  planes: generado.real.planes,
};

/**
 * El catálogo de staging (HU-C3.7): el real más los productos de prueba, que solo existen ahí y en
 * D1 local. Una prueba exige su política y sus planes, como en el real (P2).
 */
export const CATALOGO_DE_STAGING: CatalogoDelCore = {
  productos: [...CATALOGO.productos, ...(registroDePrueba as RegistroDeProductos).productos],
  politicas: { ...CATALOGO.politicas, ...generado.prueba.politicas },
  planes: { ...CATALOGO.planes, ...generado.prueba.planes },
};

/**
 * El catálogo del Worker según su destino. Solo `staging` trae los de prueba: sin la variable, o
 * con cualquier otro valor, el real (P1: en la duda, producción no ve un producto de ensayo).
 */
export const catalogoDelDestino = (destino: string | undefined): CatalogoDelCore =>
  destino === 'staging' ? CATALOGO_DE_STAGING : CATALOGO;

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

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * El plan que va en el token v2 (HU-C4.3, PLATAFORMA §4.6): el pagado mientras no haya vencido con
 * la gracia de su producto, y si venció, el gratuito de ese producto. `plan_vence` (segundos) ya
 * trae la gracia: la celda aplica sus límites sin llamar al CORE ni saber de gracias.
 */
export function planEnElToken(
  catalogo: CatalogoDelCore,
  org: { producto: string; plan_pagado: string; vence_pagado: string | null },
  ahora: number,
): { plan: string; plan_vence: number | null } {
  if (!org.vence_pagado) return { plan: org.plan_pagado, plan_vence: null };
  const gracia = catalogo.productos.find((p) => p.id === org.producto)?.gracia_dias ?? 0;
  const vence = Date.parse(org.vence_pagado) + gracia * DIA_MS;
  if (ahora < vence) return { plan: org.plan_pagado, plan_vence: Math.floor(vence / 1000) };
  const gratuito = planesDe(catalogo, org.producto).find((p) => p.gratuito)?.id ?? 'gratuito';
  return { plan: gratuito, plan_vence: null };
}

export type AvisoDelPlan = 'en-gracia' | 'vence-en-1-dia' | 'vence-en-7-dias';

/**
 * La marca que la app usa para avisar (HU-C5.5, PLATAFORMA §4.8): en gracia (venció, pero la
 * gracia de su producto lo sostiene), o a 1 o a 7 días de vencer. null si no hay nada que avisar.
 * Se calcula al pedirla, sin escribir nada: pasada la gracia, el plan es el gratuito sin tocar la
 * fila (CA3).
 */
export function avisoDelPlan(
  catalogo: CatalogoDelCore,
  org: { producto: string; plan_pagado: string; vence_pagado: string | null },
  ahora: number,
): AvisoDelPlan | null {
  if (!org.vence_pagado) return null;
  const { plan_vence } = planEnElToken(catalogo, org, ahora);
  if (plan_vence === null) return null;
  if (ahora >= Date.parse(org.vence_pagado)) return 'en-gracia';
  const faltan = Date.parse(org.vence_pagado) - ahora;
  if (faltan <= DIA_MS) return 'vence-en-1-dia';
  if (faltan <= 7 * DIA_MS) return 'vence-en-7-dias';
  return null;
}
