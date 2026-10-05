/**
 * Lista de espera de planes con precio visible (HU-E0.6, ARQUITECTURA §5.4).
 *
 * - `POST /api/core/interes` (propietario): «Me interesa» un plan para la finca del token. Una fila
 *   por persona, finca y plan; repetirlo no escribe otra vez (presupuesto ≤ 50 escrituras al día).
 *   Sin cobro ni tarjeta (CA1).
 * - `POST /api/core/interes/ver` (cualquier sesión con finca): qué planes ya marcó esta persona
 *   para esta finca, para que la pantalla diga «Ya nos avisaste».
 *
 * Solo quien administra la finca marca interés: es quien decidiría pagar. Un operario que toca
 * «Me interesa» no es intención de pago de la finca.
 */
import { TokenInvalido, verificarAcceso } from '@ed1/tokens';
import type { Context } from 'hono';
import type { Entorno } from './entrar.ts';

export const PLANES_CON_ESPERA = ['finca', 'exportador', 'cadena'] as const;
type PlanConEspera = (typeof PLANES_CON_ESPERA)[number];

async function sesionDe(c: Context, e: Entorno) {
  const token = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  try {
    return await verificarAcceso(e.firmante.publica, token, e.ahora());
  } catch (error) {
    if (error instanceof TokenInvalido) return null;
    throw error;
  }
}

const sinSesion = (c: Context) =>
  c.json({ estado: 'sin-sesion', motivo: 'Entra con tu cuenta para continuar.' }, 401);
const sinFinca = (c: Context) =>
  c.json(
    { estado: 'sin-finca', motivo: 'Sube tu finca a la nube desde Cuenta para avisarnos.' },
    403,
  );

export async function marcarInteres(c: Context, e: Entorno): Promise<Response> {
  const sesion = await sesionDe(c, e);
  if (!sesion) return sinSesion(c);
  if (!sesion.org) return sinFinca(c);
  if (sesion.rol !== 'propietario') {
    return c.json(
      {
        estado: 'prohibido',
        motivo: 'Lo avisa quien administra la finca: es quien decidiría el plan.',
      },
      403,
    );
  }
  const leido = (await c.req.json().catch(() => ({}))) as { plan?: unknown };
  const plan = leido.plan;
  if (typeof plan !== 'string' || !(PLANES_CON_ESPERA as readonly string[]).includes(plan)) {
    return c.json({ estado: 'invalido', motivo: 'Ese plan no existe.' }, 400);
  }
  const r = await e.db
    .prepare(
      'INSERT OR IGNORE INTO interes_plan (usuario_id, org_id, plan, creado) VALUES (?, ?, ?, ?)',
    )
    .bind(sesion.sub, sesion.org, plan as PlanConEspera, new Date(e.ahora()).toISOString())
    .run();
  return c.json({ plan, nuevo: (r.meta.changes ?? 0) > 0 });
}

export async function verInteres(c: Context, e: Entorno): Promise<Response> {
  const sesion = await sesionDe(c, e);
  if (!sesion) return sinSesion(c);
  if (!sesion.org) return c.json({ planes: [] });
  const filas = await e.db
    .prepare('SELECT plan FROM interes_plan WHERE usuario_id = ? AND org_id = ? ORDER BY plan')
    .bind(sesion.sub, sesion.org)
    .all<{ plan: string }>();
  return c.json({ planes: filas.results.map((f) => f.plan) });
}
