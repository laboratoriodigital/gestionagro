/**
 * Revocar un teléfono o una persona, y cambiar roles (HU-E4.6, ARQUITECTURA §5.4 y §9).
 *
 * - `POST /api/core/equipo/ver` (propietario): quiénes tienen acceso a la finca y con qué rol.
 * - `POST /api/core/equipo/rol` (propietario): cambia el rol de alguien.
 * - `POST /api/core/equipo/quitar` (propietario): quita a alguien de la finca. En su próxima
 *   renovación (a más tardar 12 h, lo que dura su access) su token ya no trae la finca y la celda
 *   le niega todo. Sus registros se quedan en la finca (CA3): la membresía no es dueña de ellos.
 * - `POST /api/core/telefonos/ver` (cualquier sesión): los teléfonos donde la cuenta tiene sesión.
 * - `POST /api/core/telefonos/retirar` (cualquier sesión): retira uno. Su refresh deja de servir;
 *   el access que ya tiene vale hasta 12 h (CA1). Lo guardado en ese teléfono no se puede borrar
 *   a distancia (CA2): lo dice la pantalla.
 *
 * Nadie cambia su propio rol ni se quita a sí mismo: una finca nunca se queda sin quien la
 * administre por un toque equivocado.
 */
import { TokenInvalido, verificarAcceso } from '@gestionagro/tokens';
import type { Context } from 'hono';
import type { Entorno } from './entrar.ts';
import { ROLES_INVITABLES } from './invitaciones.ts';
import type { Rol } from './repositorio.ts';

/** `dispositivo` de una sesión cuyo código de entrada todavía no se canjeó (`sesiones.ts`). */
const SIN_CANJEAR = 'sin-canjear';
const iso = (ms: number) => new Date(ms).toISOString();

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

async function cuerpo(c: Context): Promise<Record<string, unknown>> {
  const leido = (await c.req.json().catch(() => ({}))) as unknown;
  return typeof leido === 'object' && leido !== null ? (leido as Record<string, unknown>) : {};
}

const sinSesion = (c: Context) =>
  c.json({ estado: 'sin-sesion', motivo: 'Entra con tu cuenta para continuar.' }, 401);

/** La sesión, si es de quien administra la finca del token; si no, la respuesta de error. */
async function propietarioDe(c: Context, e: Entorno) {
  const sesion = await sesionDe(c, e);
  if (!sesion) return { error: sinSesion(c) };
  if (!sesion.org || sesion.rol !== 'propietario') {
    return {
      error: c.json(
        { estado: 'prohibido', motivo: 'Solo quien administra la finca maneja el equipo.' },
        403,
      ),
    };
  }
  return { sesion: { ...sesion, org: sesion.org } };
}

/** El `usuario_id` del cuerpo, si no es el de quien pide. */
function otraPersona(c: Context, datos: Record<string, unknown>, propio: string) {
  const usuario_id = datos['usuario_id'];
  if (typeof usuario_id !== 'string' || !usuario_id) {
    return { error: c.json({ estado: 'invalido', motivo: 'Falta la persona.' }, 400) };
  }
  if (usuario_id === propio) {
    return {
      error: c.json(
        {
          estado: 'invalido',
          motivo:
            'No puedes cambiar tu propio acceso: pídeselo a otra persona que administre la finca.',
        },
        400,
      ),
    };
  }
  return { usuario: usuario_id };
}

export async function verEquipo(c: Context, e: Entorno): Promise<Response> {
  const p = await propietarioDe(c, e);
  if (p.error) return p.error;
  const filas = await e.db
    .prepare(
      `SELECT m.usuario_id, u.nombre, m.rol FROM membresia m JOIN usuario u ON u.id = m.usuario_id
        WHERE m.org_id = ? ORDER BY u.nombre`,
    )
    .bind(p.sesion.org)
    .all<{ usuario_id: string; nombre: string; rol: Rol }>();
  return c.json({
    miembros: filas.results.map((m) => ({ ...m, tu: m.usuario_id === p.sesion.sub })),
  });
}

export async function cambiarRol(c: Context, e: Entorno): Promise<Response> {
  const p = await propietarioDe(c, e);
  if (p.error) return p.error;
  const datos = await cuerpo(c);
  const quien = otraPersona(c, datos, p.sesion.sub);
  if (quien.error) return quien.error;
  const rol = datos['rol'];
  if (typeof rol !== 'string' || !ROLES_INVITABLES.includes(rol as Rol)) {
    return c.json({ estado: 'invalido', motivo: 'Elige un rol válido.' }, 400);
  }
  const r = await e.db
    .prepare('UPDATE membresia SET rol = ? WHERE usuario_id = ? AND org_id = ?')
    .bind(rol, quien.usuario, p.sesion.org)
    .run();
  if (r.meta.changes === 0) {
    return c.json({ estado: 'no-encontrado', motivo: 'Esa persona no está en la finca.' }, 404);
  }
  return c.json({ usuario_id: quien.usuario, rol });
}

export async function quitarDelEquipo(c: Context, e: Entorno): Promise<Response> {
  const p = await propietarioDe(c, e);
  if (p.error) return p.error;
  const quien = otraPersona(c, await cuerpo(c), p.sesion.sub);
  if (quien.error) return quien.error;
  const r = await e.db
    .prepare('DELETE FROM membresia WHERE usuario_id = ? AND org_id = ?')
    .bind(quien.usuario, p.sesion.org)
    .run();
  if (r.meta.changes === 0) {
    return c.json({ estado: 'no-encontrado', motivo: 'Esa persona no está en la finca.' }, 404);
  }
  return c.json({ usuario_id: quien.usuario, quitado: true });
}

export async function verTelefonos(c: Context, e: Entorno): Promise<Response> {
  const sesion = await sesionDe(c, e);
  if (!sesion) return sinSesion(c);
  const filas = await e.db
    .prepare(
      `SELECT id, dispositivo, creado FROM sesion
        WHERE usuario_id = ? AND revocado IS NULL AND expira > ? AND dispositivo != ?
        ORDER BY creado`,
    )
    .bind(sesion.sub, iso(e.ahora()), SIN_CANJEAR)
    .all<{ id: string; dispositivo: string; creado: string }>();
  return c.json({ telefonos: filas.results });
}

export async function retirarTelefono(c: Context, e: Entorno): Promise<Response> {
  const sesion = await sesionDe(c, e);
  if (!sesion) return sinSesion(c);
  const { id } = await cuerpo(c);
  if (typeof id !== 'string' || !id) {
    return c.json({ estado: 'invalido', motivo: 'Falta el teléfono.' }, 400);
  }
  const r = await e.db
    .prepare('UPDATE sesion SET revocado = ? WHERE id = ? AND usuario_id = ? AND revocado IS NULL')
    .bind(iso(e.ahora()), id, sesion.sub)
    .run();
  if (r.meta.changes === 0) {
    return c.json({ estado: 'no-encontrado', motivo: 'Ese teléfono ya no tiene acceso.' }, 404);
  }
  return c.json({ id, retirado: true });
}
