/**
 * El plan de la tienda al día (HU-T13.5 CA3). Dos caminos lo cambian:
 *
 * - **El panel** (`guardarElPlan`): el token del CORE trae el plan y su vencimiento con la gracia
 *   sumada; al abrir el panel, la tienda guarda la copia si cambió. Así llega un plan recién pagado.
 * - **La tarea de cada hora** (`vencerLosPlanes`): si pasa la gracia y el comercio no abre el panel,
 *   nadie trae un token nuevo. La tarea pasa al gratuito las tiendas con `plan_vence` vencido.
 *
 * Con otro plan, las direcciones se vuelven a apuntar (el dominio propio deja de ser la canónica, o
 * vuelve a serlo) y lo publicado se vuelve a hornear: un plan que baja oculta enseguida lo que pasa
 * del límite y deja de cobrar en línea; uno que sube se ve en la próxima publicación, que pasa por
 * la compuerta. Nada se borra.
 */
import type { BaseD1 } from '@ed1/d1';
import { apuntarLaTienda } from './dominios.ts';
import { PLAN_GRATUITO } from './plan.ts';
import { type Almacen, type EscritorKv, rehornearExistencias } from './publicar.ts';

/** Las tiendas que la tarea pasa al gratuito por shard y vuelta: re-hornear cuesta consultas. */
export const PLANES_POR_VUELTA = 2;

/**
 * Guarda el plan del token si cambió. `planVence` viene en segundos, como en el token; `null`, sin
 * vencimiento. Devuelve si cambió.
 */
export async function guardarElPlan(
  db: BaseD1,
  org: string,
  plan: string,
  planVence: number | null,
): Promise<boolean> {
  const vence = planVence === null ? null : new Date(planVence * 1000).toISOString();
  const r = await db
    .prepare(
      'UPDATE tienda SET plan = ?, plan_vence = ? WHERE org_id = ? AND (plan IS NOT ? OR plan_vence IS NOT ?)',
    )
    .bind(plan, vence, org, plan, vence)
    .run();
  return (r.meta?.changes ?? 0) > 0;
}

export interface EntornoDelPlan {
  shard: BaseD1;
  shardNombre: string;
  control: BaseD1;
  hosts: EscritorKv;
  celda: string;
  org: string;
  instante: string;
  /** Para re-hornear lo publicado; sin ellos, solo se apuntan las direcciones. */
  sitios?: Almacen;
  release?: string;
  medios?: string;
}

/** Con el plan ya guardado: las direcciones y lo publicado, como lo deja el plan. */
export async function aplicarElPlan(e: EntornoDelPlan, pedidaPor: string) {
  await apuntarLaTienda({
    db: e.shard,
    org: e.org,
    actor: pedidaPor,
    instante: e.instante,
    control: e.control,
    celda: e.celda,
    shardNombre: e.shardNombre,
    hosts: e.hosts,
  });
  if (!e.sitios || !e.release) return { estado: 'sin-publicar' as const };
  return rehornearExistencias({
    shard: e.shard,
    shardNombre: e.shardNombre,
    control: e.control,
    sitios: e.sitios,
    hosts: e.hosts,
    celda: e.celda,
    release: e.release,
    ...(e.medios ? { medios: e.medios } : {}),
    org: e.org,
    pedidaPor,
    ahora: e.instante,
  });
}

/**
 * La tarea: las tiendas cuyo plan venció (con la gracia) pasan al gratuito. Solo si sigue vencido
 * al escribir: un pago que llegó entre tanto no se pisa.
 */
export async function vencerLosPlanes(
  e: Omit<EntornoDelPlan, 'shard' | 'shardNombre' | 'org'> & { shards: [string, BaseD1][] },
): Promise<{ vencidas: string[]; fallas: string[] }> {
  const vencidas: string[] = [];
  const fallas: string[] = [];
  for (const [nombre, db] of e.shards) {
    const { results } = await db
      .prepare(
        "SELECT org_id FROM tienda WHERE plan_vence IS NOT NULL AND plan_vence <= ? AND estado <> 'baja' LIMIT ?",
      )
      .bind(e.instante, PLANES_POR_VUELTA)
      .all<{ org_id: string }>();
    for (const { org_id: org } of results) {
      const r = await db
        .prepare(
          'UPDATE tienda SET plan = ?, plan_vence = NULL WHERE org_id = ? AND plan_vence <= ?',
        )
        .bind(PLAN_GRATUITO, org, e.instante)
        .run();
      if ((r.meta?.changes ?? 0) === 0) continue;
      vencidas.push(org);
      const hecho = await aplicarElPlan(
        { ...e, shard: db, shardNombre: nombre, org },
        'sistema:plan',
      );
      if (hecho.estado === 'fallida' || hecho.estado === 'compuerta')
        fallas.push(
          `${org}: ${hecho.estado === 'fallida' ? hecho.motivo : 'la compuerta no la dejó'}`,
        );
    }
  }
  return { vencidas, fallas };
}
