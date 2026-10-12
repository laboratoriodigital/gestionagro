/**
 * Lo que el CORE le da a sus celdas (HU-C5.6, PLATAFORMA §4.13, ADR-10): el plan de las
 * organizaciones de una celda, para que la celda sepa de un pago o de un vencimiento aunque nadie
 * haya entrado a la app.
 *
 * La celda lo pide por un service binding con RPC (`ServicioDelCore`, en `entrada-de-servicio.ts`),
 * no por HTTP: el método no tiene URL pública y no hace falta un secreto compartido. Solo funciona
 * entre Workers de la misma cuenta, que es lo que hay (ADR-23); una celda en otra cuenta necesitará
 * otro camino.
 */
import type { BaseD1 } from '@ed1/d1';
import { type CatalogoDelCore, planEnElToken } from './productos.ts';

export interface PlanDeOrganizacion {
  org_id: string;
  /** El shard de la organización: la celda guarda la copia en esa base. */
  shard: string;
  plan: string;
  /** Hasta cuándo, con la gracia ya aplicada (ISO); null si no vence. */
  plan_vence: string | null;
}

/**
 * Los planes de las organizaciones de `celda`. Con `desde`, solo las que tuvieron un pago aprobado
 * después (la vuelta de cada hora); sin él, todas (la de cada día, que también recoge los
 * vencimientos, porque esos no dejan fila).
 */
export async function planesDeLaCelda(
  db: BaseD1,
  catalogo: CatalogoDelCore,
  celda: string,
  ahora: number,
  desde?: string,
): Promise<PlanDeOrganizacion[]> {
  const soloCambios = desde
    ? " AND o.id IN (SELECT org_id FROM pago WHERE estado = 'aprobado' AND actualizado > ?)"
    : '';
  const { results } = await db
    .prepare(
      `SELECT o.id AS org_id, o.producto, o.shard, o.plan AS plan_pagado, o.plan_vence AS vence_pagado
         FROM organizacion o WHERE o.celda_id = ?${soloCambios} ORDER BY o.id`,
    )
    .bind(celda, ...(desde ? [desde] : []))
    .all<{
      org_id: string;
      producto: string;
      shard: string;
      plan_pagado: string;
      vence_pagado: string | null;
    }>();
  return results.map((o) => {
    const { plan, plan_vence } = planEnElToken(catalogo, o, ahora);
    return {
      org_id: o.org_id,
      shard: o.shard,
      plan,
      plan_vence: plan_vence === null ? null : new Date(plan_vence * 1000).toISOString(),
    };
  });
}
