/**
 * El plan de la tienda y sus límites (HU-T13.5, TIENDA §1.4). El plan lo decide el CORE: llega
 * firmado en el token del panel, con su vencimiento y la gracia ya sumada (`plan_vence`), y la
 * tienda guarda una copia en su fila (`tienda.plan`, `tienda.plan_vence`) para que la vitrina, el
 * cobro y las tareas lo sepan sin sesión. Los límites salen de `content/tienda/funciones.json` (P2).
 */
import type { BaseD1 } from '@ed1/d1';
import {
  type FuncionesPorPlan,
  funcionesDelPlan,
  type LimitesDelPlan,
  limitesDelPlan,
} from '@ed1/tienda-schema';
import funciones from '../../../content/tienda/funciones.json' with { type: 'json' };
import planes from '../../../content/tienda/planes.json' with { type: 'json' };

/** El plan gratuito de la Tienda, el de `planes.json`. */
export const PLAN_GRATUITO: string =
  planes.planes.find((p) => 'gratuito' in p && p.gratuito === true)?.id ?? 'gratis';

/** Los límites de un plan; sin plan, o con uno que el archivo no nombra, los del gratuito (P1). */
export const limitesDeLaTienda = (plan: string | null | undefined): LimitesDelPlan =>
  limitesDelPlan(funciones as unknown as FuncionesPorPlan, plan ?? PLAN_GRATUITO, PLAN_GRATUITO);

/** El plan guardado de la tienda. */
export async function planDeLaTienda(db: BaseD1, org: string): Promise<string | null> {
  const fila = await db
    .prepare('SELECT plan FROM tienda WHERE org_id = ?')
    .bind(org)
    .first<{ plan: string }>();
  return fila?.plan ?? null;
}

/** Si el plan guardado de la tienda enciende una función de `funciones.json` (HU-P1.4 y las que vengan). */
export async function tieneLaFuncion(db: BaseD1, org: string, funcion: string): Promise<boolean> {
  const plan = (await planDeLaTienda(db, org)) ?? PLAN_GRATUITO;
  return funcionesDelPlan(funciones as unknown as FuncionesPorPlan, plan)?.[funcion] === true;
}
