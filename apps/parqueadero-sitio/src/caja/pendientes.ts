/**
 * Las entregas pendientes (HU-Q3.3 CA4, bitácora parqueadero 42): los recibos que no salieron por
 * la impresora. Antes solo se contaban y nunca bajaban; ahora se ven, se reimprimen desde su
 * recibo y salen de la lista cuando el papel sale o el conductor escanea el recibo en pantalla.
 * El registro nunca estuvo en riesgo: lo que falta es el papel.
 */
import type { Registro } from '@ed1/parqueadero-schema';
import type { BaseDeLaCaja, EntregaPendiente } from './datos.ts';

/** Las entregas pendientes de un recibo, o las de impresiones que no son recibo (`reciboId` nulo). */
export interface GrupoPendiente {
  readonly reciboId: string | null;
  readonly ids: readonly number[];
  /** Cuántas veces no salió. */
  readonly veces: number;
  /** La última vez que no salió: su hora y su motivo. */
  readonly ultima: EntregaPendiente;
}

export interface Pendiente extends GrupoPendiente {
  /** El recibo, para abrirlo y reimprimirlo; nulo si no es un recibo o ya no está. */
  readonly registro: Registro | null;
}

/** Una fila por recibo, la más reciente arriba; las que no son recibo van juntas. */
export function agruparPendientes(entregas: readonly EntregaPendiente[]): GrupoPendiente[] {
  const grupos = new Map<string | null, EntregaPendiente[]>();
  for (const e of entregas) {
    const clave = e.reciboId ?? null;
    grupos.set(clave, [...(grupos.get(clave) ?? []), e]);
  }
  return [...grupos.entries()]
    .map(([reciboId, suyas]) => {
      const orden = [...suyas].sort((x, y) => x.creadaEn - y.creadaEn);
      const ultima = orden[orden.length - 1] as EntregaPendiente;
      return {
        reciboId,
        ids: orden.map((e) => e.id).filter((id): id is number => id !== undefined),
        veces: orden.length,
        ultima,
      };
    })
    .sort((x, y) => y.ultima.creadaEn - x.ultima.creadaEn);
}

/** Las entregas pendientes con su recibo, para la pantalla. */
export async function leerPendientes(db: BaseDeLaCaja): Promise<Pendiente[]> {
  const grupos = agruparPendientes(await db.entregas_pendientes.toArray());
  const ids = grupos.map((g) => g.reciboId).filter((id): id is string => id !== null);
  const registros = await db.registros.bulkGet(ids);
  const porId = new Map(registros.filter((r) => r !== undefined).map((r) => [r.id, r]));
  return grupos.map((g) => ({ ...g, registro: (g.reciboId && porId.get(g.reciboId)) || null }));
}

/** El cajero las quita de la lista: el recibo se entregó de otra forma, o no hace falta. */
export async function quitarPendientes(db: BaseDeLaCaja, ids: readonly number[]): Promise<void> {
  await db.entregas_pendientes.bulkDelete([...ids]);
}

/** Un recibo que salió ya no está pendiente. */
export async function quitarPendientesDe(db: BaseDeLaCaja, reciboId: string): Promise<void> {
  await db.entregas_pendientes.filter((e) => e.reciboId === reciboId).delete();
}
