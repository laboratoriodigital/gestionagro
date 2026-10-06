/**
 * Lo que la cuenta del ecosistema lee del CORE (HU-C7.4, ADR-28, ED1 §16).
 *
 * - `POST /api/core/cuenta/espacios`: los espacios de la persona en todos los productos, con su
 *   rol, su plan (con la gracia ya aplicada) y la dirección que abre la app de cada uno.
 *
 * Solo con un token de la cuenta (`aud = cuenta`): un token de una app ve las organizaciones de su
 * producto, nunca las de todos. Lo que se ve sale de la membresía (CA3): quitar a alguien borra su
 * membresía, y con ella el espacio de esta lista.
 */
import { TokenInvalido, verificarAcceso } from '@ed1/tokens';
import type { Context } from 'hono';
import type { Entorno } from './entrar.ts';
import { origenesDelProducto, planEnElToken, planesDe } from './productos.ts';
import { directorioDeUsuario } from './repositorio.ts';

export const PRODUCTO_CUENTA = 'cuenta';

export interface Espacio {
  org_id: string;
  nombre: string;
  producto: string;
  producto_nombre: string;
  rol: string;
  plan: string;
  plan_nombre: string;
  /** Hasta cuándo vale el plan pagado, con la gracia (ISO); null si no vence. */
  plan_vence: string | null;
  /** La app del producto, para abrir el espacio; null si el producto no tiene a dónde volver. */
  abrir: string | null;
}

export async function espaciosDeLaCuenta(
  c: Context,
  e: Entorno & { destino: string | undefined },
): Promise<Response> {
  const token = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
  let reclamos: Awaited<ReturnType<typeof verificarAcceso>> | null = null;
  try {
    reclamos = token ? await verificarAcceso(e.firmante.publica, token, e.ahora()) : null;
  } catch (error) {
    if (!(error instanceof TokenInvalido)) throw error;
  }
  if (!reclamos) {
    return c.json(
      { estado: 'sin-sesion', motivo: 'Entra a tu cuenta para ver tus espacios.' },
      401,
    );
  }
  if (reclamos.aud !== PRODUCTO_CUENTA) {
    return c.json({ estado: 'prohibido', motivo: 'Esta lista solo se ve desde tu cuenta.' }, 403);
  }
  const ahora = e.ahora();
  const directorio = await directorioDeUsuario(e.db, reclamos.sub, ahora);
  const espacios: Espacio[] = directorio.map((org) => {
    const producto = e.catalogo.productos.find((p) => p.id === org.producto);
    const { plan, plan_vence } = planEnElToken(e.catalogo, org, ahora);
    const origenes = producto ? origenesDelProducto(producto, e.origenes) : [];
    // En producción, el origen de producción; en staging, el de staging (el último declarado).
    const origen = e.destino === 'staging' ? origenes.at(-1) : origenes[0];
    const ruta = producto?.app.rutas_de_vuelta[0];
    return {
      org_id: org.org_id,
      nombre: org.nombre,
      producto: org.producto,
      producto_nombre: producto?.nombre ?? org.producto,
      rol: org.rol,
      plan,
      plan_nombre: planesDe(e.catalogo, org.producto).find((p) => p.id === plan)?.nombre ?? plan,
      plan_vence: plan_vence === null ? null : new Date(plan_vence * 1000).toISOString(),
      abrir: origen && ruta ? `${origen}${ruta}` : null,
    };
  });
  return c.json({ espacios });
}
