/**
 * La celda al día con los planes (HU-C5.6, PLATAFORMA §4.13): en su vuelta programada, la celda le
 * pide al CORE el plan de sus organizaciones y guarda una copia en cada shard (`plan_de_org`).
 *
 * - **Por service binding, con RPC** (`CORE.planes`). No hay URL ni secreto compartido: el CORE y
 *   la celda están en la misma cuenta (cambio de forma de CA1, bitácora core).
 * - **Cada hora, lo que cambió; una vez al día, todo.** La vuelta de cada hora pide los pagos
 *   aprobados en las últimas 3 horas: se solapan a propósito, sin guardar nada para recordar
 *   dónde iba, y lo repetido no se escribe. La de las 06:00 UTC pide todas, porque un vencimiento
 *   no deja fila en el CORE. Así el CORE nunca llama a la celda (CA2, cambio de forma).
 * - **Solo se escribe lo distinto.** Cada fila de D1 escrita cuenta en la cuota diaria de la cuenta
 *   (HU-Q7.13): una vuelta sin cambios lee y no escribe nada.
 * - **Si el CORE no responde, la copia se queda como estaba** y el dueño recibe un aviso por
 *   Telegram, una sola vez por motivo (CA3, P1, P15). El plan nunca baja «por si acaso»: solo
 *   cambia con lo que el CORE dijo.
 */
import type { BaseD1 } from '@ed1/d1';
import { enviarTelegram, type Telegram } from './avisos.ts';
import type { KvDeFlags } from './vigia.ts';

/** Lo que el CORE entrega por organización (`apps/core/src/servicio.ts`, el mismo contrato). */
export interface PlanDeOrganizacion {
  org_id: string;
  shard: string;
  plan: string;
  plan_vence: string | null;
}

/** El service binding del CORE, con su entrada `ServicioDelCore`. */
export interface ServicioDelCore {
  planes(celda: string, desde: string | null): Promise<PlanDeOrganizacion[]>;
  /** Si la concesión de un token de agente sigue viva (HU-C9.6); la usa el MCP (HU-C9.7). */
  concesionVigente(id: string): Promise<boolean>;
}

/** La hora UTC de la vuelta completa: la 1:00 de Colombia, con la celda en calma. */
export const HORA_DE_LA_VUELTA_COMPLETA = 6;
/** Cuánto hacia atrás mira la vuelta de cada hora: tres vueltas, por si una falló. */
export const VENTANA_DE_CAMBIOS_MS = 3 * 60 * 60 * 1000;
export const CLAVE_AVISO_PLANES = 'aviso_planes';
const FILAS_POR_SENTENCIA = 500;

export interface VueltaDePlanes {
  completa: boolean;
  recibidos: number;
  escritos: number;
  fallas: string[];
  aviso: 'sin-aviso' | 'enviado' | 'recuperado' | `fallo: ${string}`;
}

export interface ContextoDePlanes {
  celda: string;
  destino: string;
  core: ServicioDelCore | undefined;
  shards: ReadonlyMap<string, BaseD1>;
  flags: KvDeFlags | undefined;
  telegram: Telegram;
}

/** Escribe en un shard solo las filas que cambiaron. Devuelve cuántas escribió. */
async function copiarEnElShard(
  db: BaseD1,
  planes: readonly PlanDeOrganizacion[],
  ahora: string,
): Promise<number> {
  const { results } = await db
    .prepare('SELECT org_id, plan, plan_vence FROM plan_de_org')
    .all<{ org_id: string; plan: string; plan_vence: string | null }>();
  const antes = new Map(results.map((f) => [f.org_id, f]));
  const distintos = planes.filter((p) => {
    const f = antes.get(p.org_id);
    return !f || f.plan !== p.plan || f.plan_vence !== p.plan_vence;
  });
  // Una sentencia por cada 500 filas, con las filas en un JSON: el plan gratuito de Workers cuenta
  // las consultas de cada invocación (50), y la vuelta comparte la suya con el vigía.
  for (let i = 0; i < distintos.length; i += FILAS_POR_SENTENCIA) {
    const lote = distintos.slice(i, i + FILAS_POR_SENTENCIA);
    await db
      .prepare(
        `INSERT INTO plan_de_org (org_id, plan, plan_vence, actualizado)
           SELECT value ->> 'org_id', value ->> 'plan', value ->> 'plan_vence', ? FROM json_each(?) WHERE true
           ON CONFLICT (org_id) DO UPDATE SET plan = excluded.plan, plan_vence = excluded.plan_vence, actualizado = excluded.actualizado`,
      )
      .bind(ahora, JSON.stringify(lote))
      .run();
  }
  return distintos.length;
}

export async function sincronizarPlanes(
  ctx: ContextoDePlanes,
  ahora: number,
  fetchFn: typeof fetch = fetch,
): Promise<VueltaDePlanes> {
  const completa = new Date(ahora).getUTCHours() === HORA_DE_LA_VUELTA_COMPLETA;
  const desde = completa ? null : new Date(ahora - VENTANA_DE_CAMBIOS_MS).toISOString();
  const vuelta: VueltaDePlanes = {
    completa,
    recibidos: 0,
    escritos: 0,
    fallas: [],
    aviso: 'sin-aviso',
  };

  let planes: PlanDeOrganizacion[] | null = null;
  if (!ctx.core) {
    vuelta.fallas.push('la celda no tiene el service binding CORE');
  } else {
    try {
      planes = await ctx.core.planes(ctx.celda, desde);
    } catch (e) {
      vuelta.fallas.push(`el CORE no respondió (${(e as Error).message})`);
    }
  }

  if (planes) {
    vuelta.recibidos = planes.length;
    const porShard = new Map<string, PlanDeOrganizacion[]>();
    for (const p of planes) porShard.set(p.shard, [...(porShard.get(p.shard) ?? []), p]);
    const marca = new Date(ahora).toISOString();
    for (const [shard, deEse] of porShard) {
      const db = ctx.shards.get(shard);
      if (!db) {
        vuelta.fallas.push(
          `${deEse.length} organizaciones del shard ${shard}, que esta celda no tiene`,
        );
        continue;
      }
      try {
        vuelta.escritos += await copiarEnElShard(db, deEse, marca);
      } catch (e) {
        vuelta.fallas.push(`${shard}: no se pudo escribir la copia (${(e as Error).message})`);
      }
    }
  }

  vuelta.aviso = await avisarDeLosPlanes(ctx, vuelta.fallas, fetchFn);
  return vuelta;
}

/**
 * Un aviso por motivo, como el vigía: la firma se guarda al enviarlo y no se repite cada hora. Al
 * volver a la normalidad, se dice una vez y se borra la firma.
 */
async function avisarDeLosPlanes(
  ctx: ContextoDePlanes,
  fallas: readonly string[],
  fetchFn: typeof fetch,
): Promise<VueltaDePlanes['aviso']> {
  if (!ctx.flags) return 'sin-aviso';
  const firma = fallas.join('|');
  const anterior = (await ctx.flags.get(CLAVE_AVISO_PLANES)) ?? '';
  if (firma === anterior) return 'sin-aviso';
  const prefijo = `${ctx.destino === 'staging' ? '[staging] ' : ''}Celda ${ctx.celda}`;
  const texto =
    fallas.length > 0
      ? `${prefijo}: no pudo ponerse al día con los planes. Cada organización sigue con el plan que tenía; nada baja por esto.\n${fallas.join('\n')}`
      : `${prefijo}: los planes volvieron a ponerse al día.`;
  const fallo = await enviarTelegram(ctx.telegram, texto, fetchFn);
  if (fallo) return `fallo: ${fallo}`;
  await ctx.flags.put(CLAVE_AVISO_PLANES, firma);
  return fallas.length > 0 ? 'enviado' : 'recuperado';
}
