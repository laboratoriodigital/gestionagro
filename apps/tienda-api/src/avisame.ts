/**
 * «Avísame cuando haya» (HU-T6.5, TIENDA-3.0 §5.3 y §14.3): suma uno a las personas que esperan
 * una variante agotada, **sin guardar ningún dato de nadie** (ni la IP: el límite por IP lo cuenta
 * el limitador de Workers, que no escribe en la base). El contacto queda en el WhatsApp del
 * comercio, como en la 2.0; el comercio ve cuántos esperan.
 */
import type { BaseD1 } from '@ed1/d1';
import { z } from 'zod';

export const PeticionDeAvisame = z.object({ variante: z.string().min(1).max(64) });

export type ResultadoDeAvisame = 'anotado' | 'disponible' | 'no-existe';

export async function avisame(
  db: BaseD1,
  org: string,
  variante: string,
  ahora: string,
): Promise<ResultadoDeAvisame> {
  const v = await db
    .prepare(
      `SELECT v.stock, v.reservado FROM variante v
       JOIN producto p ON p.org_id = v.org_id AND p.id = v.producto_id
       WHERE v.org_id = ? AND v.id = ? AND v.activa = 1 AND p.estado = 'activo' AND p.borrado IS NULL`,
    )
    .bind(org, variante)
    .first<{ stock: number | null; reservado: number }>();
  if (!v) return 'no-existe';
  // Sin inventario (`stock` nulo) nunca se agota; con él, se agota cuando no queda nada libre.
  if (v.stock === null || v.stock - v.reservado > 0) return 'disponible';
  await db
    .prepare(
      `INSERT INTO interes_reposicion (org_id, variante_id, personas, desde, ultimo) VALUES (?, ?, 1, ?, ?)
       ON CONFLICT (org_id, variante_id) DO UPDATE SET personas = personas + 1, ultimo = excluded.ultimo`,
    )
    .bind(org, variante, ahora, ahora)
    .run();
  return 'anotado';
}
