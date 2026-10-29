/**
 * HU-P1.4 (sprint PF3): las ofertas programadas empiezan y terminan solas. Una oferta rige del
 * comienzo de su primer día al final del último, de Colombia (medianoche: las 5:00 UTC). La tarea
 * de cada hora busca, en cada shard, las tiendas con una oferta que empieza hoy o que terminó ayer,
 * y re-hornea lo publicado con la hora de ahora: el re-horneado mínimo (HU-T4.5) sube solo las
 * páginas que cambian de precio.
 *
 * - Toda la mañana, no solo a medianoche: si una vuelta no alcanza (el CPU de una corrida del cron
 *   es poco), la siguiente sigue con las que faltan. Lo hecho se anota en FLAGS por tienda y día.
 * - Mientras no se re-hornea, la cotización manda: cobra el precio de este instante y nunca uno
 *   vencido (CA3). La vitrina solo puede mostrar un precio que ya no rige por unas horas.
 */
import type { BaseD1 } from '@ed1/d1';
import { type Almacen, rehornearExistencias } from './publicar.ts';
import { TIENDAS_POR_VUELTA } from './releases.ts';
import type { EntornoDeTareas, Tarea } from './tareas.ts';

const DIA_MS = 24 * 60 * 60 * 1000;
/** Colombia está en UTC−5, sin horario de verano. */
const COLOMBIA_MS = 5 * 60 * 60 * 1000;

/** El día de Colombia de un instante, y el anterior: `AAAA-MM-DD`. */
export function diasDeColombia(instante: number): { hoy: string; ayer: string } {
  const local = instante - COLOMBIA_MS;
  return {
    hoy: new Date(local).toISOString().slice(0, 10),
    ayer: new Date(local - DIA_MS).toISOString().slice(0, 10),
  };
}

/** Las tiendas del shard con una oferta que empieza hoy o terminó ayer (con su índice cada una). */
export async function tiendasConOfertasQueCambian(
  db: BaseD1,
  hoy: string,
  ayer: string,
): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT org_id FROM producto INDEXED BY producto_oferta_empieza
        WHERE oferta IS NOT NULL AND json_extract(oferta, '$.desde') = ? AND borrado IS NULL
       UNION
       SELECT org_id FROM producto INDEXED BY producto_oferta_termina
        WHERE oferta IS NOT NULL AND json_extract(oferta, '$.hasta') = ? AND borrado IS NULL
       LIMIT 50`,
    )
    .bind(hoy, ayer)
    .all<{ org_id: string }>();
  return results.map((r) => r.org_id);
}

const claveDeHecha = (org: string, hoy: string) => `ofertas:${hoy}:${org}`;

export const OFERTAS_PROGRAMADAS: Tarea = {
  nombre: 'ofertas-programadas',
  frecuencia: 'hora',
  async correr(e: EntornoDeTareas, instante: number) {
    if (!e.almacen || !e.release)
      throw new Error('el cron no tiene el almacén (SITIOS) o la release');
    const { hoy, ayer } = diasDeColombia(instante);
    const ahora = new Date(instante).toISOString();
    let hechas = 0;
    let faltan = 0;
    const fallas: string[] = [];
    for (const [nombre, db] of e.shards) {
      let enEsteShard = 0;
      for (const org of await tiendasConOfertasQueCambian(db, hoy, ayer)) {
        if (await e.flags.get(claveDeHecha(org, hoy))) continue;
        if (enEsteShard >= TIENDAS_POR_VUELTA) {
          faltan++;
          continue;
        }
        enEsteShard++;
        const r = await rehornearExistencias({
          shard: db,
          shardNombre: nombre,
          control: e.control,
          sitios: e.almacen as unknown as Almacen,
          hosts: e.hosts,
          celda: e.celda,
          release: e.release,
          ...(e.medios ? { medios: e.medios } : {}),
          org,
          pedidaPor: 'sistema:ofertas',
          ahora,
        });
        if (r.estado === 'en-curso') {
          faltan++;
          continue;
        }
        if (r.estado === 'fallida' || r.estado === 'compuerta') {
          fallas.push(`${org}: ${r.estado === 'fallida' ? r.motivo : 'la compuerta no la dejó'}`);
          continue;
        }
        await e.flags.put(claveDeHecha(org, hoy), ahora, { expirationTtl: 3 * 24 * 60 * 60 });
        hechas++;
      }
    }
    if (fallas.length > 0)
      throw new Error(`ofertas que no se re-hornearon: ${fallas.slice(0, 5).join('; ')}`);
    return hechas + faltan === 0
      ? 'ninguna oferta empieza ni termina hoy'
      : `${hechas} tienda(s) con sus ofertas de hoy${faltan > 0 ? `; ${faltan} en la próxima vuelta` : ''}`;
  },
};
