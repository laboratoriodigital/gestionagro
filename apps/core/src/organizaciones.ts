/**
 * `POST /api/core/organizaciones` (HU-E4.3): el teléfono crea en la nube la organización de su
 * finca local. La persona del token queda como propietaria; la celda, el shard y el anillo los
 * pone la regla de asignación (HU-E4.1, CA3). La finca cero entra por aquí, igual que las demás
 * (ADR-1, P6).
 *
 * Idempotente: el teléfono genera el id (UUIDv7). Si la respuesta se pierde y el teléfono
 * reintenta, recibe la misma organización y no se crea otra.
 *
 * Una cuenta tiene a lo sumo `limites.organizaciones_por_cuenta` organizaciones del plan gratuito
 * de su producto, entre las que administra (HU-E0.13); las de un plan pagado no cuentan. Sin ese
 * tope en el plan gratuito, sin límite.
 */
import { id as esquemaId } from '@ed1/ids';
import { TokenInvalido, verificarAcceso } from '@ed1/tokens';
import type { Context } from 'hono';
import { SinCeldaDisponible } from './asignacion.ts';
import type { Entorno } from './entrar.ts';
import {
  type CatalogoDelCore,
  PRODUCTO_POR_DEFECTO,
  planEnElToken,
  planesDe,
  productoDe,
  rolAdministra,
  topeDelPlan,
} from './productos.ts';
import { crearOrganizacion, ErrorDelCore } from './repositorio.ts';

/** Si la cuenta ya tiene todas las organizaciones gratuitas que caben; null si cabe otra. */
async function sinCupoGratuito(
  e: Entorno,
  catalogo: CatalogoDelCore,
  usuario: string,
  producto: string,
): Promise<{ tope: number; plan: string } | null> {
  const gratuito = planesDe(catalogo, producto).find((p) => p.gratuito);
  const tope =
    gratuito && topeDelPlan(catalogo, producto, gratuito.id, 'organizaciones_por_cuenta');
  if (!gratuito || !tope) return null;
  const suyas = await e.db
    .prepare(
      `SELECT o.producto, o.plan AS plan_pagado, o.plan_vence AS vence_pagado, m.rol
         FROM organizacion o JOIN membresia m ON m.org_id = o.id
        WHERE m.usuario_id = ? AND o.producto = ?`,
    )
    .bind(usuario, producto)
    .all<{ producto: string; plan_pagado: string; vence_pagado: string | null; rol: string }>();
  const gratis = suyas.results.filter(
    (o) =>
      rolAdministra(catalogo, producto, o.rol) &&
      planEnElToken(catalogo, o, e.ahora()).plan === gratuito.id,
  ).length;
  return gratis >= tope.tope ? tope : null;
}

export async function crearOrganizacionDeLaFinca(c: Context, e: Entorno): Promise<Response> {
  const token = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return c.json({ estado: 'sin-sesion', motivo: 'Entra con tu cuenta.' }, 401);
  let usuario: string;
  let aud: string | undefined;
  try {
    ({ sub: usuario, aud } = await verificarAcceso(e.firmante.publica, token, e.ahora()));
  } catch (error) {
    if (!(error instanceof TokenInvalido)) throw error;
    return c.json({ estado: 'sin-sesion', motivo: 'La sesión venció. Vuelve a intentarlo.' }, 401);
  }
  const cuerpo = (await c.req.json().catch(() => ({}))) as { id?: unknown; nombre?: unknown };
  const id = esquemaId.safeParse(cuerpo.id);
  if (!id.success || typeof cuerpo.nombre !== 'string') {
    return c.json({ estado: 'invalido', motivo: 'Faltan el id o el nombre de la finca' }, 400);
  }

  const existente = await e.db
    .prepare(
      `SELECT o.id, o.nombre, o.celda_id, o.shard, m.rol FROM organizacion o
         LEFT JOIN membresia m ON m.org_id = o.id AND m.usuario_id = ?
        WHERE o.id = ?`,
    )
    .bind(usuario, id.data)
    .first<{ id: string; nombre: string; celda_id: string; shard: string; rol: string | null }>();
  // HU-C3.2: el producto sale de la sesión, nunca del cuerpo (R2): el `aud` del token v2 (HU-C4.3).
  // Un v1 todavía vigente no lo trae y es del producto por defecto, como antes.
  const producto = aud ?? PRODUCTO_POR_DEFECTO;
  const delCatalogo = productoDe(e.catalogo, producto);
  const tipo = 'producto' in delCatalogo ? delCatalogo.producto.tipos[0] : undefined;
  if (!tipo) {
    return c.json(
      { estado: 'prohibido', motivo: 'Esta aplicación no tiene espacios que crear.' },
      403,
    );
  }
  if (existente) {
    if (!existente.rol || !rolAdministra(e.catalogo, producto, existente.rol)) {
      return c.json({ estado: 'ajena', motivo: 'Esa finca es de otra cuenta.' }, 409);
    }
    return c.json({ org_id: existente.id, nombre: existente.nombre, ya_existia: true });
  }
  const sinCupo = await sinCupoGratuito(e, e.catalogo, usuario, producto);
  if (sinCupo) {
    const cuantas = sinCupo.tope === 1 ? 'una finca' : `${sinCupo.tope} fincas`;
    return c.json(
      {
        estado: 'limite-del-plan',
        motivo: `Con el plan ${sinCupo.plan}, cada cuenta tiene ${cuantas} en la nube, y la tuya ya está. Para subir otra, pasa a otro plan la que ya tienes.`,
      },
      409,
    );
  }
  try {
    const org = await crearOrganizacion(
      e.db,
      {
        propietarioId: usuario,
        nombre: cuerpo.nombre,
        tipo,
        id: id.data,
        producto,
        // HU-C3.3: quien la crea queda con el primer rol que administra su producto.
        rolQueAdministra:
          e.catalogo.productos.find((p) => p.id === producto)?.roles.find((r) => r.administra)
            ?.id ?? 'propietario',
      },
      e.ahora,
    );
    return c.json({ org_id: org.id, nombre: org.nombre, ya_existia: false }, 201);
  } catch (error) {
    if (error instanceof ErrorDelCore)
      return c.json({ estado: 'invalido', motivo: error.message }, 400);
    if (error instanceof SinCeldaDisponible) {
      console.error('agro-core:', error.message);
      return c.json(
        {
          estado: 'sin-celda',
          motivo: 'No hay dónde guardar fincas nuevas ahora. Tus datos siguen en el teléfono.',
        },
        503,
      );
    }
    throw error;
  }
}
