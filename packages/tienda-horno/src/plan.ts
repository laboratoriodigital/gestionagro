/**
 * HU-T13.5 CA2 y CA3: lo que se hornea según el plan de la tienda. El horno recibe lo que el comercio
 * publicó, completo, y aquí se recorta a lo que su plan permite: así, cuando el plan cambia, el
 * re-horneado de lo publicado muestra u oculta sin que el comercio vuelva a publicar.
 *
 * - Los productos que pasan del límite, en el orden del comercio, quedan ocultos: no se hornean, pero
 *   siguen en su catálogo, nunca se borran. Sus colecciones tampoco los nombran.
 * - Sin cobro en línea, el carrito no ofrece pagar en línea; sin contraentrega, tampoco esa forma. Si
 *   no queda ninguna forma para pedir por WhatsApp, queda «a convenir»: la tienda sigue vendiendo.
 * - Sin feeds, no se hornean.
 * - Sin el MCP público (Gratis, HU-T18.3), la tienda no lo anuncia; sin `sinMarca` (Gratis,
 *   HU-T18.2), el pie lleva el sello «Hecha con TiendaPro».
 */
import { formasDelPlan, type LimitesDelPlan } from '@ed1/tienda-schema';
import type { TiendaParaHornear } from './horno.ts';

export interface AlPlan {
  tienda: TiendaParaHornear;
  /** Los productos que el plan deja fuera de la vitrina, por su slug. */
  ocultos: string[];
}

/** La tienda recortada a su plan. Sin `plan` (pruebas y versiones de antes), queda igual. */
export function alPlan(t: TiendaParaHornear, plan: LimitesDelPlan | undefined = t.plan): AlPlan {
  if (!plan) return { tienda: t, ocultos: [] };
  const visibles = plan.productos === null ? t.productos : t.productos.slice(0, plan.productos);
  const ocultos = t.productos.slice(visibles.length).map((p) => p.slug);
  const quedan = new Set(visibles.map((p) => p.slug));
  const nombres = new Set(visibles.map((p) => p.nombre));
  const { cobroEnLinea, cobroEnPruebas, feeds, mcp, ...resto } = t;
  const tienda: TiendaParaHornear = {
    ...resto,
    plan,
    productos: visibles,
    ...(t.colecciones
      ? {
          colecciones: t.colecciones.map((c) => ({
            ...c,
            productos: c.productos.filter((s) => quedan.has(s)),
          })),
        }
      : {}),
    ...(t.legal
      ? {
          legal: {
            ...t.legal,
            formas: formasDelPlan(t.legal.formas, plan, Boolean(cobroEnLinea)),
            sinRetracto: t.legal.sinRetracto.filter((p) => nombres.has(p.nombre)),
          },
        }
      : {}),
    ...(cobroEnLinea && plan.cobroEnLinea
      ? { cobroEnLinea, ...(cobroEnPruebas ? { cobroEnPruebas } : {}) }
      : {}),
    ...(feeds && plan.feeds ? { feeds } : {}),
    // HU-T18.3 CA3: el MCP público, solo en Pro e IA Pro. Una versión de antes no trae el campo.
    ...(mcp && plan.mcpPublico !== false ? { mcp } : {}),
  };
  return { tienda, ocultos };
}
