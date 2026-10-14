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
import { type Cupon, calcularTotal, cobrableEnLinea, LIMITES } from '@ed1/dinero';
import { z } from 'zod';

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
  | { codigo: 'envio_invalido' }
  | { codigo: 'total_cambio'; totalVisto: number }
  | { codigo: 'carrito_vacio' };

export interface Cotizacion {
  subtotal: number;
  descuento: number;
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
  precio_cop: number;
  stock: number | null;
  reservado: number;
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
      `SELECT v.id, v.precio_cop, v.stock, v.reservado FROM variante v
       JOIN producto p ON p.org_id = v.org_id AND p.id = v.producto_id
       WHERE v.org_id = ? AND v.activa = 1 AND p.estado = 'activo' AND p.borrado IS NULL
         AND v.id IN (${pedidas.map(() => '?').join(', ')})`,
    )
    .bind(org, ...pedidas.map((l) => l.variante))
    .all<FilaVariante>();
  const porId = new Map(filas.map((f) => [f.id, f]));

  const carrito: Cotizacion['carrito'] = [];
  const lineas: { precioCop: number; cantidad: number }[] = [];
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
    lineas.push({ precioCop: v.precio_cop, cantidad });
  }
  if (lineas.length === 0) {
    avisos.push({ codigo: 'carrito_vacio' });
    return {
      subtotal: 0,
      descuento: 0,
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
        `SELECT tipo, valor, minimo_cop, desde, hasta, usos_maximos, usos FROM cupon
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
      }>();
    const vigente =
      c &&
      (c.desde === null || c.desde <= ahora) &&
      (c.hasta === null || ahora <= c.hasta) &&
      (c.usos_maximos === null || c.usos < c.usos_maximos);
    if (!c || !vigente) avisos.push({ codigo: 'cupon_invalido' });
    else if (c.tipo === 'porcentaje')
      cupon = { tipo: 'porcentaje', porcentaje: c.valor, minimoCop: c.minimo_cop };
    else if (c.tipo === 'valor')
      cupon = { tipo: 'valor', valorCop: c.valor, minimoCop: c.minimo_cop };
    else cupon = { tipo: 'envio_gratis', minimoCop: c.minimo_cop };
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

  const t = calcularTotal({ lineas, cupon, envio });
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
    envio: t.envio,
    total: t.total,
    avisos,
    cobrable: c.cobrable,
    ...(c.cobrable ? {} : { motivo: c.motivo }),
    carrito,
    cambio,
  };
}
