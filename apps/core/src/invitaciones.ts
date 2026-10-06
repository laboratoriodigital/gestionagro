/**
 * Invitar al equipo (HU-E4.4, ARQUITECTURA §5.4). Sin correo: el propietario comparte un enlace por
 * WhatsApp.
 *
 * - `POST /api/core/invitaciones` (propietario): crea un código de un solo uso con el rol elegido,
 *   que vence en 7 días (CA1). En D1 solo queda su hash.
 * - `POST /api/core/invitaciones/ver` (sin sesión): a qué finca, con qué rol, de parte de quién y
 *   hasta cuándo; o por qué ya no sirve (CA3). La pantalla «Unirme» lo muestra antes de entrar.
 * - `POST /api/core/invitaciones/aceptar` (con sesión): la persona queda en la organización con
 *   ese rol (CA4). Marcar el código como usado y crear la membresía van en un mismo batch, y la
 *   membresía solo se crea si el código quedó marcado para esta persona: dos teléfonos con el
 *   mismo enlace no entran los dos.
 *
 * El código viaja siempre en el cuerpo de un POST, nunca en una URL (CA2, P13): en el enlace va en
 * el fragmento `#`, que no llega a ningún servidor.
 */
import { hashDe, secretoAlAzar, TokenInvalido, verificarAcceso } from '@ed1/tokens';
import type { Context } from 'hono';
import { filaDeAuditoria } from './auditoria.ts';
import type { Entorno } from './entrar.ts';
import type { Rol } from './repositorio.ts';

export const VIDA_INVITACION_MS = 7 * 24 * 60 * 60 * 1000;
/** Roles que se pueden dar con una invitación. Auditor llega con su enlace propio (HU-E9.4). */
export const ROLES_INVITABLES: readonly Rol[] = ['operario', 'supervisor', 'asesor', 'propietario'];

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

const sinSesion = (c: Context) =>
  c.json({ estado: 'sin-sesion', motivo: 'Entra con tu cuenta para continuar.' }, 401);

async function cuerpo(c: Context): Promise<Record<string, unknown>> {
  const leido = (await c.req.json().catch(() => ({}))) as unknown;
  return typeof leido === 'object' && leido !== null ? (leido as Record<string, unknown>) : {};
}

export async function crearInvitacion(c: Context, e: Entorno): Promise<Response> {
  const sesion = await sesionDe(c, e);
  if (!sesion) return sinSesion(c);
  if (!sesion.org || sesion.rol !== 'propietario') {
    return c.json(
      { estado: 'prohibido', motivo: 'Solo quien administra la finca puede invitar.' },
      403,
    );
  }
  const { rol } = await cuerpo(c);
  if (typeof rol !== 'string' || !ROLES_INVITABLES.includes(rol as Rol)) {
    return c.json({ estado: 'invalido', motivo: 'Elige el rol de la persona que invitas.' }, 400);
  }
  const codigo = secretoAlAzar();
  const ahora = e.ahora();
  const expira = ahora + VIDA_INVITACION_MS;
  await e.db
    .prepare(
      'INSERT INTO invitacion (codigo_hash, org_id, rol, expira, creada_por, creada) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(await hashDe(codigo), sesion.org, rol, iso(expira), sesion.sub, iso(ahora))
    .run();
  return c.json({ codigo, rol, expira: iso(expira) }, 201);
}

interface Detalle {
  org_id: string;
  finca: string;
  rol: Rol;
  invita: string;
  expira: string;
  usada: string | null;
  usada_por: string | null;
}

async function detalle(e: Entorno, codigo: string): Promise<Detalle | null> {
  return e.db
    .prepare(
      `SELECT i.org_id, o.nombre AS finca, i.rol, u.nombre AS invita, i.expira, i.usada, i.usada_por
         FROM invitacion i
         JOIN organizacion o ON o.id = i.org_id
         JOIN usuario u ON u.id = i.creada_por
        WHERE i.codigo_hash = ?`,
    )
    .bind(await hashDe(codigo))
    .first<Detalle>();
}

/** Por qué una invitación ya no sirve, en palabras y con a quién pedir otra (CA3). */
function motivoDeNoServir(d: Detalle | null, ahora: number, usuario?: string): string | null {
  if (!d)
    return 'Este enlace de invitación no existe o está incompleto. Pídele a quien te invitó que te mande uno nuevo.';
  if (d.usada && d.usada_por !== usuario) {
    return `Este enlace ya se usó. Pídele a ${d.invita} que te mande uno nuevo.`;
  }
  if (!d.usada && Date.parse(d.expira) <= ahora) {
    return `Este enlace venció. Pídele a ${d.invita} que te mande uno nuevo.`;
  }
  return null;
}

const codigoDe = async (c: Context) => {
  const { codigo } = await cuerpo(c);
  return typeof codigo === 'string' && codigo.trim() ? codigo.trim() : null;
};

export async function verInvitacion(c: Context, e: Entorno): Promise<Response> {
  const codigo = await codigoDe(c);
  if (!codigo)
    return c.json({ estado: 'invalido', motivo: 'Falta el código de la invitación.' }, 400);
  const d = await detalle(e, codigo);
  const motivo = motivoDeNoServir(d, e.ahora());
  if (motivo || !d) return c.json({ estado: 'no-sirve', motivo }, 410);
  return c.json({
    estado: 'vigente',
    finca: d.finca,
    rol: d.rol,
    invita: d.invita,
    expira: d.expira,
  });
}

export async function aceptarInvitacion(c: Context, e: Entorno): Promise<Response> {
  const sesion = await sesionDe(c, e);
  if (!sesion) return sinSesion(c);
  const codigo = await codigoDe(c);
  if (!codigo)
    return c.json({ estado: 'invalido', motivo: 'Falta el código de la invitación.' }, 400);
  const ahora = e.ahora();
  const d = await detalle(e, codigo);
  const motivo = motivoDeNoServir(d, ahora, sesion.sub);
  if (motivo || !d) return c.json({ estado: 'no-sirve', motivo }, 410);
  const respuesta = { org_id: d.org_id, finca: d.finca, rol: d.rol };
  if (d.usada_por === sesion.sub) return c.json({ ...respuesta, ya_aceptada: true });

  const ya = await e.db
    .prepare('SELECT rol FROM membresia WHERE usuario_id = ? AND org_id = ?')
    .bind(sesion.sub, d.org_id)
    .first<{ rol: Rol }>();
  if (ya) {
    return c.json(
      {
        estado: 'ya-miembro',
        motivo: `Ya eres parte de ${d.finca} como ${ya.rol}. No necesitas esta invitación.`,
      },
      409,
    );
  }
  const hash = await hashDe(codigo);
  const [marca, alta] = await e.db.batch([
    e.db
      .prepare(
        'UPDATE invitacion SET usada_por = ?, usada = ? WHERE codigo_hash = ? AND usada IS NULL AND expira > ?',
      )
      .bind(sesion.sub, iso(ahora), hash, iso(ahora)),
    e.db
      .prepare(
        `INSERT INTO membresia (usuario_id, org_id, rol, creado)
         SELECT ?, org_id, rol, ? FROM invitacion WHERE codigo_hash = ? AND usada_por = ? AND usada = ?`,
      )
      .bind(sesion.sub, iso(ahora), hash, sesion.sub, iso(ahora)),
    // HU-C2.4: la fila queda solo si la invitación quedó usada por esta persona en este instante.
    filaDeAuditoria(
      e.db,
      {
        instante: iso(ahora),
        producto: 'agro',
        org_id: d.org_id,
        usuario_id: sesion.sub,
        accion: 'invitacion_aceptada',
        detalle: { rol: d.rol },
      },
      {
        sql: 'SELECT 1 FROM invitacion WHERE codigo_hash = ? AND usada_por = ? AND usada = ?',
        valores: [hash, sesion.sub, iso(ahora)],
      },
    ),
  ]);
  if (!marca?.meta.changes || !alta?.meta.changes) {
    // Otro teléfono la usó en el mismo instante: se dice como ya usada.
    return c.json(
      {
        estado: 'no-sirve',
        motivo: `Este enlace ya se usó. Pídele a ${d.invita} que te mande uno nuevo.`,
      },
      410,
    );
  }
  return c.json(respuesta);
}
