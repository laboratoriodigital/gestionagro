/**
 * Los términos de la nube y el contrato de transmisión (HU-Q7.11; PARQUEADERO §13.2). El texto y
 * la versión viven en `content/parqueadero/privacidad/terminos.json` (P2): la caja lo muestra y la
 * celda solo conoce la versión.
 *
 * - **CA3:** cada pedido a `/api/v1/*` dice en `?terminos=` qué versión aceptó la caja. Sin la
 *   vigente, la celda no lo atiende: 403 `sin-terminos`. Una caja vieja que no sabe de una versión
 *   nueva queda quieta y lo dice, en vez de seguir subiendo con lo que ya no es cierto.
 * - **CA1:** `POST /api/v1/terminos` guarda en la fila de la caja la versión y el instante en que
 *   se aceptaron. La caja lo manda una vez por versión, antes de sincronizar.
 */
import terminos from '../../../content/parqueadero/privacidad/terminos.json' with { type: 'json' };
import type { ContextoCelda } from './worker.ts';

export const VERSION_DE_LOS_TERMINOS: string = terminos.version;

export const SIN_TERMINOS = {
  estado: 'sin-terminos',
  motivo: `Esta caja no tiene aceptados los términos vigentes de la nube (versión ${VERSION_DE_LOS_TERMINOS}). Ábralos en «Cuenta y nube»; mientras tanto la caja sigue registrando.`,
} as const;

/** Un instante ISO-8601 en UTC, como los guarda la celda (anexo A, regla 3). */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/** `POST /api/v1/terminos` (CA1): la caja aceptó esta versión en este instante. Idempotente. */
export async function registrarTerminos(c: ContextoCelda): Promise<Response> {
  const { org, db } = c.get('sesion');
  let cuerpo: Record<string, unknown> | null = null;
  try {
    cuerpo = (await c.req.json()) as Record<string, unknown> | null;
  } catch {
    cuerpo = null;
  }
  const dispositivo = cuerpo?.['dispositivo'];
  const aceptados = cuerpo?.['aceptados'];
  if (typeof dispositivo !== 'string' || dispositivo.length === 0 || dispositivo.length > 120) {
    return c.json({ estado: 'invalido', motivo: 'Falta la caja' }, 400);
  }
  if (cuerpo?.['version'] !== VERSION_DE_LOS_TERMINOS) return c.json(SIN_TERMINOS, 403);
  if (
    typeof aceptados !== 'string' ||
    !ISO.test(aceptados) ||
    Number.isNaN(Date.parse(aceptados))
  ) {
    return c.json({ estado: 'invalido', motivo: 'Falta cuándo se aceptaron' }, 400);
  }
  const r = await db
    .prepare(
      'UPDATE dispositivo SET terminos_version = ?, terminos_aceptados = ? WHERE org_id = ? AND id = ?',
    )
    .bind(VERSION_DE_LOS_TERMINOS, aceptados, org, dispositivo)
    .run();
  if ((r.meta.changes ?? 0) === 0) {
    return c.json(
      { estado: 'sin-alta', motivo: 'Esta caja todavía no está en este parqueadero.' },
      404,
    );
  }
  return c.json({ resultado: 'aceptados', version: VERSION_DE_LOS_TERMINOS, aceptados });
}
