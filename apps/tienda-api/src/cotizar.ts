/**
 * Cotizar (HU-T5.5, TIENDA-3.0 §6 y §13.2): el servidor recalcula el carrito con los precios y las
 * existencias de la base y con `@ed1/dinero`, la misma regla que el navegador usa para mostrar
 * (P2). Nunca confía en un precio, un descuento ni un total que mande el navegador:
 *
 * - lo que ya no se vende sale del carrito, y lo que no alcanza se baja, diciéndolo;
 * - el cupón y el envío se buscan en la base; uno que no sirve se dice, no se ignora;
 * - si llega `totalVisto` y no es el total calculado, la respuesta lo marca (`cambio`) y la página
 *   pide aceptar de nuevo: un total distinto nunca sigue en silencio (CA3).
 *
 * Solo lee: unas cuatro consultas y unas pocas filas por cotización.
 */
import type { BaseD1 } from '@ed1/d1';
import {
  type Cupon,
  calcularTotal,
  cobrableEnLinea,
  LIMITES,
  type PromocionPorCantidad,
} from '@ed1/dinero';
import { promocionVigente } from '@ed1/tienda-schema';
import { z } from 'zod';
import { precioDeHoy, promocionLeida } from './catalogo.ts';

export const PeticionDeCotizar = z.object({
  lineas: z
    .array(
      z.object({
        variante: z.string().min(1).max(64),
        cantidad: z.number().int().min(1).max(LIMITES.unidadesPorLinea),
      }),
    )
    .min(1)
    .max(LIMITES.lineas),
  envio: z.string().min(1).max(64).optional(),
  cupon: z.string().trim().min(1).max(24).optional(),
  totalVisto: z.number().int().min(0).optional(),
});
export type PeticionDeCotizar = z.infer<typeof PeticionDeCotizar>;

export type AvisoDeCotizar =
  | { codigo: 'linea_quitada'; variante: string }
  | { codigo: 'cantidad_ajustada'; variante: string; cantidad: number }
  | { codigo: 'cupon_invalido' }
  | { codigo: 'cupon_bajo_el_minimo' }
  | { codigo: 'cupon_no_aplica' }
  | { codigo: 'envio_invalido' }
  | { codigo: 'total_cambio'; totalVisto: number }
  | { codigo: 'carrito_vacio' };

export interface Cotizacion {
  subtotal: number;
  /** Todo lo descontado: las promociones más el cupón. */
  descuento: number;
  /** HU-P1.2: lo de las promociones por cantidad, y lo del cupón. */
  descuentoPromociones: number;
  descuentoCupon: number;
  envio: number;
  total: number;
  avisos: AvisoDeCotizar[];
  /** Si el total se puede cobrar en línea; si no, por qué (TIENDA §6, punto 6). */
  cobrable: boolean;
  motivo?: 'bajo_el_minimo' | 'sobre_el_tope';
  /** El carrito corregido: lo que de verdad se puede pedir. */
  carrito: { variante: string; cantidad: number }[];
  /** El total no es el que vio la persona: la página pide aceptar de nuevo. */
  cambio: boolean;
}

interface FilaVariante {
  id: string;
  producto_id: string;
  precio_cop: number;
  stock: number | null;
  reservado: number;
  promocion: string | null;
  oferta: string | null;
}

/** Las líneas repetidas de una misma variante se suman, dentro del tope por línea. */
function juntar(lineas: PeticionDeCotizar['lineas']) {
  const por = new Map<string, number>();
  for (const l of lineas) {
    por.set(
      l.variante,
      Math.min((por.get(l.variante) ?? 0) + l.cantidad, LIMITES.unidadesPorLinea),
    );
  }
  return [...por].map(([variante, cantidad]) => ({ variante, cantidad }));
}

/**
 * HU-P1.3: los productos del carrito que entran en el alcance de un cupón: los que nombra y los de
 * sus categorías. Un alcance ilegible no deja aplicar el cupón a nada (P1).
 */
async function productosDelAlcance(
  db: BaseD1,
  org: string,
  texto: string,
  lineas: readonly { producto: string }[],
): Promise<string[]> {
  let alcance: { productos?: unknown; colecciones?: unknown };
  try {
    alcance = JSON.parse(texto) as typeof alcance;
  } catch {
    return [];
  }
  const ids = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  const enElCarrito = [...new Set(lineas.map((l) => l.producto))];
  const nombrados = ids(alcance.productos).filter((p) => enElCarrito.includes(p));
  const colecciones = ids(alcance.colecciones);
  if (colecciones.length === 0 || enElCarrito.length === 0) return nombrados;
  const { results } = await db
    .prepare(
      `SELECT DISTINCT producto_id FROM coleccion_producto
        WHERE org_id = ? AND coleccion_id IN (SELECT value FROM json_each(?))
          AND producto_id IN (SELECT value FROM json_each(?))`,
    )
    .bind(org, JSON.stringify(colecciones), JSON.stringify(enElCarrito))
    .all<{ producto_id: string }>();
  return [...new Set([...nombrados, ...results.map((r) => r.producto_id)])];
}

export async function cotizar(
  db: BaseD1,
  org: string,
  p: PeticionDeCotizar,
  ahora: string,
): Promise<Cotizacion> {
  const pedidas = juntar(p.lineas);
  const avisos: AvisoDeCotizar[] = [];
  const { results: filas } = await db
    .prepare(
      `SELECT v.id, v.producto_id, v.precio_cop, v.stock, v.reservado, p.promocion, p.oferta FROM variante v
       JOIN producto p ON p.org_id = v.org_id AND p.id = v.producto_id
       WHERE v.org_id = ? AND v.activa = 1 AND p.estado = 'activo' AND p.borrado IS NULL
         AND v.id IN (${pedidas.map(() => '?').join(', ')})`,
    )
    .bind(org, ...pedidas.map((l) => l.variante))
    .all<FilaVariante>();
  const porId = new Map(filas.map((f) => [f.id, f]));

  const carrito: Cotizacion['carrito'] = [];
  const lineas: { precioCop: number; cantidad: number; producto: string }[] = [];
  // HU-P1.2: la promoción vigente de cada producto, leída otra vez de la base.
  const promociones: Record<string, PromocionPorCantidad> = {};
  for (const f of filas) {
    const promo = f.promocion ? promocionLeida(f.promocion) : null;
    if (promo && promocionVigente(promo, ahora)) {
      promociones[f.producto_id] =
        promo.tipo === 'regalo'
          ? { tipo: 'regalo', lleva: promo.lleva, paga: promo.paga }
          : {
              tipo: 'porcentaje',
              porcentaje: promo.porcentaje,
              desdeUnidades: promo.desdeUnidades,
            };
    }
  }
  for (const l of pedidas) {
    const v = porId.get(l.variante);
    const disponibles = v
      ? v.stock === null
        ? Number.POSITIVE_INFINITY
        : v.stock - v.reservado
      : 0;
    if (!v || disponibles <= 0) {
      avisos.push({ codigo: 'linea_quitada', variante: l.variante });
      continue;
    }
    const cantidad = Math.min(l.cantidad, disponibles);
    if (cantidad < l.cantidad) {
      avisos.push({ codigo: 'cantidad_ajustada', variante: l.variante, cantidad });
    }
    carrito.push({ variante: l.variante, cantidad });
    // HU-P1.4: con la oferta programada, si rige ahora; una vencida nunca se cobra (CA3).
    lineas.push({
      precioCop: precioDeHoy(v.precio_cop, v.oferta, ahora),
      cantidad,
      producto: v.producto_id,
    });
  }
  if (lineas.length === 0) {
    avisos.push({ codigo: 'carrito_vacio' });
    return {
      subtotal: 0,
      descuento: 0,
      descuentoPromociones: 0,
      descuentoCupon: 0,
      envio: 0,
      total: 0,
      avisos,
      cobrable: false,
      motivo: 'bajo_el_minimo',
      carrito,
      cambio: p.totalVisto !== undefined && p.totalVisto !== 0,
    };
  }

  let cupon: Cupon | null = null;
  if (p.cupon) {
    const c = await db
      .prepare(
        `SELECT tipo, valor, minimo_cop, desde, hasta, usos_maximos, usos, alcance FROM cupon
         WHERE org_id = ? AND codigo = ? AND activo = 1 AND borrado IS NULL`,
      )
      .bind(org, p.cupon.toUpperCase())
      .first<{
        tipo: 'porcentaje' | 'valor' | 'envio_gratis';
        valor: number;
        minimo_cop: number;
        desde: string | null;
        hasta: string | null;
        usos_maximos: number | null;
        usos: number;
        alcance: string | null;
      }>();
    const vigente =
      c &&
      (c.desde === null || c.desde <= ahora) &&
      (c.hasta === null || ahora <= c.hasta) &&
      (c.usos_maximos === null || c.usos < c.usos_maximos);
    if (!c || !vigente) avisos.push({ codigo: 'cupon_invalido' });
    else {
      const alcance = c.alcance ? await productosDelAlcance(db, org, c.alcance, lineas) : undefined;
      const conAlcance = alcance ? { productos: alcance } : {};
      if (c.tipo === 'porcentaje')
        cupon = { tipo: 'porcentaje', porcentaje: c.valor, minimoCop: c.minimo_cop, ...conAlcance };
      else if (c.tipo === 'valor')
        cupon = { tipo: 'valor', valorCop: c.valor, minimoCop: c.minimo_cop, ...conAlcance };
      else cupon = { tipo: 'envio_gratis', minimoCop: c.minimo_cop, ...conAlcance };
    }
  }

  let envio: { precioCop: number; gratisDesdeCop: number | null } | null = null;
  if (p.envio) {
    const e = await db
      .prepare(
        'SELECT precio_cop, gratis_desde_cop FROM envio_opcion WHERE org_id = ? AND id = ? AND activa = 1 AND borrado IS NULL',
      )
      .bind(org, p.envio)
      .first<{ precio_cop: number; gratis_desde_cop: number | null }>();
    if (e) envio = { precioCop: e.precio_cop, gratisDesdeCop: e.gratis_desde_cop };
    else avisos.push({ codigo: 'envio_invalido' });
  }

  const t = calcularTotal({ lineas, cupon, envio, promociones });
  for (const a of t.avisos) avisos.push({ codigo: a });
  const cobro = await db
    .prepare("SELECT datos FROM ajuste WHERE org_id = ? AND seccion = 'cobro'")
    .bind(org)
    .first<{ datos: string }>();
  const tope = (JSON.parse(cobro?.datos ?? '{}') as { topeCop?: number }).topeCop;
  const c = cobrableEnLinea(t.total, tope);
  const cambio = p.totalVisto !== undefined && p.totalVisto !== t.total;
  if (cambio) avisos.push({ codigo: 'total_cambio', totalVisto: p.totalVisto as number });
  return {
    subtotal: t.subtotal,
    descuento: t.descuento,
    descuentoPromociones: t.descuentoPromociones,
    descuentoCupon: t.descuentoCupon,
    envio: t.envio,
    total: t.total,
    avisos,
    cobrable: c.cobrable,
    ...(c.cobrable ? {} : { motivo: c.motivo }),
    carrito,
    cambio,
  };
}
