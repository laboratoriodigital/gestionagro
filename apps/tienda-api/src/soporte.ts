/**
 * El soporte por comercio (HU-T14.7, HU-T0.3): el dueño anota cada atención con el flujo
 * «anotar-soporte-tienda» (`POST /api/despliegue/soporte`, con el secreto del despacho). Solo la
 * tienda, el día, los minutos y el tema: nada de texto libre, para que ningún dato de una persona
 * llegue a la base ni al reporte. El reporte semanal suma los minutos de la semana.
 */
import type { BaseD1 } from '@ed1/d1';
import { z } from 'zod';

export const TEMAS_DE_SOPORTE = [
  'alta',
  'catalogo',
  'pedidos',
  'cobro',
  'dominio',
  'otro',
] as const;

const Atencion = z.object({
  org: z.uuid(),
  minutos: z.number().int().min(1).max(600),
  tema: z.enum(TEMAS_DE_SOPORTE),
  /** El día de Colombia, `AAAA-MM-DD`; sin él, hoy. */
  dia: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type ResultadoDelSoporte =
  | { estado: 'anotado'; dia: string; minutos: number }
  | { estado: 'problemas'; motivo: string }
  | { estado: 'no-existe' };

/** Anota una atención, si la tienda existe en la base de control. */
export async function anotarSoporte(
  control: BaseD1,
  cuerpo: unknown,
  instante: number,
): Promise<ResultadoDelSoporte> {
  const r = Atencion.safeParse(cuerpo);
  if (!r.success)
    return {
      estado: 'problemas',
      motivo: 'faltan la tienda, los minutos (de 1 a 600) o el tema',
    };
  const existe = await control
    .prepare('SELECT 1 AS si FROM slug WHERE org_id = ?')
    .bind(r.data.org)
    .first<{ si: number }>();
  if (!existe) return { estado: 'no-existe' };
  const hoy = new Date(instante - 5 * 3_600_000).toISOString().slice(0, 10);
  const dia = r.data.dia ?? hoy;
  await control
    .prepare('INSERT INTO soporte (org_id, dia, minutos, tema, anotado) VALUES (?, ?, ?, ?, ?)')
    .bind(r.data.org, dia, r.data.minutos, r.data.tema, new Date(instante).toISOString())
    .run();
  return { estado: 'anotado', dia, minutos: r.data.minutos };
}
