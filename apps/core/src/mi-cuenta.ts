/**
 * Lo que la cuenta del ecosistema muestra de la persona, además de sus espacios (EC7, ED1 §16):
 *
 * - **Dónde has entrado** (HU-C7.5): sus sesiones abiertas, por producto, con el dispositivo y el
 *   último uso. Cerrar una, o todas menos esta, pide una entrada con Google de hace menos de 10
 *   minutos (`auth_time`) y queda en la auditoría. Cerrar invalida el refresh: el próximo refresco
 *   con él recibe 401 (`refrescar` en `sesiones.ts` ya rechaza una sesión revocada).
 * - **Mis pagos** (HU-C7.6): los pagos de los espacios que administra, con el periodo cubierto.
 * - **La actividad** (HU-C7.8): la auditoría de los espacios que administra, en frases.
 *
 * Todo con un token de la cuenta (`aud = cuenta`), como `cuenta.ts`. Quien no administra un espacio
 * no ve sus pagos ni su actividad: la consulta solo trae los espacios donde su rol administra.
 */
import { hashDe, TokenInvalido, verificarAcceso } from '@ed1/tokens';
import type { Context } from 'hono';
import { type Accion, filaDeAuditoria } from './auditoria.ts';
import { PRODUCTO_CUENTA } from './cuenta.ts';
import type { Entorno } from './entrar.ts';
import { planesDe, rolAdministra } from './productos.ts';
import { VIDA_REFRESH_MS } from './sesiones.ts';
import { revocarConcesion } from './token-oauth.ts';

/** Cuánto vale una entrada con Google para cerrar sesiones (CA2). */
export const ENTRADA_RECIENTE_MS = 10 * 60 * 1000;
const SIN_CANJEAR = 'sin-canjear';
const iso = (ms: number) => new Date(ms).toISOString();

type Reclamos = Awaited<ReturnType<typeof verificarAcceso>>;

/** Los reclamos de un token de la cuenta, o la respuesta que corresponde. */
export async function deLaCuenta(c: Context, e: Entorno): Promise<Reclamos | Response> {
  const token = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
  let reclamos: Reclamos | null = null;
  try {
    reclamos = token ? await verificarAcceso(e.firmante.publica, token, e.ahora()) : null;
  } catch (error) {
    if (!(error instanceof TokenInvalido)) throw error;
  }
  if (!reclamos)
    return c.json({ estado: 'sin-sesion', motivo: 'Entra a tu cuenta para continuar.' }, 401);
  if (reclamos.aud !== PRODUCTO_CUENTA)
    return c.json({ estado: 'prohibido', motivo: 'Esto solo se ve desde tu cuenta.' }, 403);
  return reclamos;
}

async function cuerpo(c: Context): Promise<Record<string, unknown>> {
  const leido = (await c.req.json().catch(() => ({}))) as unknown;
  return typeof leido === 'object' && leido !== null ? (leido as Record<string, unknown>) : {};
}

const nombreDelProducto = (e: Entorno, id: string) =>
  e.catalogo.productos.find((p) => p.id === id)?.nombre ?? id;

// ── HU-C7.5 · Dónde has entrado ─────────────────────────────────────────────

export interface SesionVisible {
  id: string;
  producto: string;
  producto_nombre: string;
  /** El dispositivo como lo declaró la app; solo sus últimos caracteres, para distinguirlo. */
  dispositivo: string;
  creado: string;
  /** El último giro del refresh: se renueva una vez al día de uso (`sesiones.ts`). */
  ultimo_uso: string;
  /** La sesión de este navegador, si mandó su refresh. */
  esta: boolean;
}

export async function verSesiones(c: Context, e: Entorno): Promise<Response> {
  const r = await deLaCuenta(c, e);
  if (r instanceof Response) return r;
  const { refresh } = await cuerpo(c);
  const propio = typeof refresh === 'string' ? await hashDe(refresh) : null;
  const { results } = await e.db
    .prepare(
      `SELECT id, producto, dispositivo, creado, expira, refresh_hash FROM sesion
        WHERE usuario_id = ? AND revocado IS NULL AND expira > ? AND dispositivo <> ?
        ORDER BY expira DESC LIMIT 50`,
    )
    .bind(r.sub, iso(e.ahora()), SIN_CANJEAR)
    .all<{
      id: string;
      producto: string;
      dispositivo: string;
      creado: string;
      expira: string;
      refresh_hash: string;
    }>();
  const sesiones: SesionVisible[] = results.map((s) => ({
    id: s.id,
    producto: s.producto,
    producto_nombre: nombreDelProducto(e, s.producto),
    dispositivo: s.dispositivo.slice(-6),
    creado: s.creado,
    ultimo_uso: iso(Date.parse(s.expira) - VIDA_REFRESH_MS),
    esta: s.refresh_hash === propio,
  }));
  return c.json({ sesiones });
}

export async function cerrarSesiones(c: Context, e: Entorno): Promise<Response> {
  const r = await deLaCuenta(c, e);
  if (r instanceof Response) return r;
  const ahora = e.ahora();
  // CA2: una entrada reciente, con Google o con el correo (HU-C10.2). Renovar no la cambia
  // (auth_time, HU-C4.3).
  if (!r.auth_time || ahora - r.auth_time * 1000 > ENTRADA_RECIENTE_MS) {
    return c.json(
      {
        estado: 'entrar-de-nuevo',
        motivo:
          'Para cerrar sesiones, vuelve a entrar. Así sabemos que eres tú y no alguien con tu teléfono.',
      },
      403,
    );
  }
  const b = await cuerpo(c);
  const una = typeof b['sesion'] === 'string' ? b['sesion'] : null;
  const salvo = typeof b['todas_menos'] === 'string' ? await hashDe(b['todas_menos']) : null;
  if (!una && !salvo)
    return c.json({ estado: 'invalido', motivo: 'Elige qué sesión cerrar.' }, 400);
  const accion: Accion = 'sesion_cerrada';
  const hecho = {
    instante: iso(ahora),
    producto: PRODUCTO_CUENTA,
    org_id: null,
    usuario_id: r.sub,
    accion,
    detalle: una ? { sesion: una } : { todas_menos_esta: true },
  };
  const [cierre] = await e.db.batch(
    una
      ? [
          e.db
            .prepare(
              'UPDATE sesion SET revocado = ? WHERE id = ? AND usuario_id = ? AND revocado IS NULL',
            )
            .bind(iso(ahora), una, r.sub),
          filaDeAuditoria(e.db, hecho, {
            sql: 'SELECT 1 FROM sesion WHERE id = ? AND usuario_id = ? AND revocado = ?',
            valores: [una, r.sub, iso(ahora)],
          }),
        ]
      : [
          e.db
            .prepare(
              'UPDATE sesion SET revocado = ? WHERE usuario_id = ? AND revocado IS NULL AND refresh_hash <> ?',
            )
            .bind(iso(ahora), r.sub, salvo),
          filaDeAuditoria(e.db, hecho, {
            sql: 'SELECT 1 FROM sesion WHERE usuario_id = ? AND revocado = ?',
            valores: [r.sub, iso(ahora)],
          }),
        ],
  );
  return c.json({ cerradas: cierre?.meta.changes ?? 0 });
}

// ── HU-C7.6 · Mis pagos, y HU-C7.8 · la actividad ───────────────────────────

/** Los espacios donde la persona tiene un rol que administra. */
async function espaciosQueAdministra(e: Entorno, usuario: string) {
  const { results } = await e.db
    .prepare(
      `SELECT o.id, o.nombre, o.producto, m.rol FROM membresia m
         JOIN organizacion o ON o.id = m.org_id WHERE m.usuario_id = ?`,
    )
    .bind(usuario)
    .all<{ id: string; nombre: string; producto: string; rol: string }>();
  return results.filter((o) => rolAdministra(e.catalogo, o.producto, o.rol));
}

export interface PagoVisible {
  espacio: string;
  producto_nombre: string;
  plan_nombre: string;
  meses: number;
  monto_cop: number;
  estado: string;
  creado: string;
  periodo_desde: string | null;
  periodo_hasta: string | null;
}

export async function verPagos(c: Context, e: Entorno): Promise<Response> {
  const r = await deLaCuenta(c, e);
  if (r instanceof Response) return r;
  const espacios = await espaciosQueAdministra(e, r.sub);
  if (espacios.length === 0) return c.json({ pagos: [] });
  const { results } = await e.db
    .prepare(
      `SELECT org_id, producto, plan, meses, monto_cop, estado, creado, periodo_desde, periodo_hasta
         FROM pago WHERE org_id IN (${espacios.map(() => '?').join(', ')})
        ORDER BY creado DESC LIMIT 50`,
    )
    .bind(...espacios.map((o) => o.id))
    .all<{
      org_id: string;
      producto: string;
      plan: string;
      meses: number;
      monto_cop: number;
      estado: string;
      creado: string;
      periodo_desde: string | null;
      periodo_hasta: string | null;
    }>();
  const pagos: PagoVisible[] = results.map((p) => ({
    espacio: espacios.find((o) => o.id === p.org_id)?.nombre ?? '',
    producto_nombre: nombreDelProducto(e, p.producto),
    plan_nombre: planesDe(e.catalogo, p.producto).find((x) => x.id === p.plan)?.nombre ?? p.plan,
    meses: p.meses,
    monto_cop: p.monto_cop,
    estado: p.estado,
    creado: p.creado,
    periodo_desde: p.periodo_desde,
    periodo_hasta: p.periodo_hasta,
  }));
  return c.json({ pagos });
}

const pesos = (n: number) => `COP ${n.toLocaleString('es-CO')}`;
const meses = (n: number) => (n === 1 ? 'un mes' : `${n} meses`);

/** Un hecho de la auditoría en una frase (HU-C7.8 CA1). Sin datos técnicos: lo lee el productor. */
export function frase(
  h: { accion: string; detalle: Record<string, unknown> | null; quien: string | null },
  nombreDe: (usuario: string) => string,
): string {
  const quien = h.quien ?? 'Alguien';
  const d = h.detalle ?? {};
  const persona = typeof d['persona'] === 'string' ? nombreDe(d['persona']) : 'una persona';
  switch (h.accion) {
    case 'entrada':
      // HU-C10.2: una entrada sin proveedor es de antes del correo, cuando solo había Google.
      return d['proveedor'] === 'correo'
        ? `${quien} entró con un enlace a su correo.`
        : `${quien} entró con Google.`;
    case 'invitacion_aceptada':
      return `${quien} se unió como ${String(d['rol'] ?? 'parte del equipo')}.`;
    case 'rol_cambiado':
      return typeof d['antes'] === 'string'
        ? `${quien} cambió a ${persona} de ${d['antes']} a ${String(d['rol'])}.`
        : `${quien} cambió el rol de ${persona} a ${String(d['rol'])}.`;
    case 'persona_quitada':
      return `${quien} quitó a ${persona} del espacio.`;
    case 'telefono_retirado':
      return `${quien} retiró el acceso de un teléfono.`;
    case 'pago_cerrado': {
      const plan = String(d['plan'] ?? '');
      const cuanto = typeof d['monto_cop'] === 'number' ? ` (${pesos(d['monto_cop'])})` : '';
      const tiempo = typeof d['meses'] === 'number' ? ` por ${meses(d['meses'])}` : '';
      if (d['estado'] === 'aprobado') return `${quien} pagó el plan ${plan}${tiempo}${cuanto}.`;
      if (d['estado'] === 'rechazado')
        return `Un pago de ${quien} por el plan ${plan} no se aprobó.`;
      return `Un pago de ${quien} por el plan ${plan} quedó en revisión.`;
    }
    case 'refresh_rechazado':
      return `Se bloqueó un intento de usar la sesión de ${quien} desde otra aplicación.`;
    default:
      return `${quien}: ${h.accion.replace(/_/g, ' ')}.`;
  }
}

export async function verActividad(c: Context, e: Entorno): Promise<Response> {
  const r = await deLaCuenta(c, e);
  if (r instanceof Response) return r;
  const espacios = await espaciosQueAdministra(e, r.sub);
  if (espacios.length === 0) return c.json({ hechos: [] });
  const { results } = await e.db
    .prepare(
      `SELECT a.org_id, a.instante, a.accion, a.detalle, u.nombre AS quien
         FROM auditoria a LEFT JOIN usuario u ON u.id = a.usuario_id
        WHERE a.org_id IN (${espacios.map(() => '?').join(', ')})
        ORDER BY a.id DESC LIMIT 50`,
    )
    .bind(...espacios.map((o) => o.id))
    .all<{
      org_id: string;
      instante: string;
      accion: string;
      detalle: string | null;
      quien: string | null;
    }>();
  const filas = results.map((f) => ({
    ...f,
    detalle: f.detalle ? (JSON.parse(f.detalle) as Record<string, unknown>) : null,
  }));
  const personas = [
    ...new Set(
      filas.map((f) => f.detalle?.['persona']).filter((p): p is string => typeof p === 'string'),
    ),
  ];
  const nombres = new Map<string, string>();
  if (personas.length > 0) {
    const { results: gente } = await e.db
      .prepare(`SELECT id, nombre FROM usuario WHERE id IN (${personas.map(() => '?').join(', ')})`)
      .bind(...personas)
      .all<{ id: string; nombre: string }>();
    for (const g of gente) nombres.set(g.id, g.nombre);
  }
  return c.json({
    hechos: filas.map((f) => ({
      espacio: espacios.find((o) => o.id === f.org_id)?.nombre ?? '',
      instante: f.instante,
      frase: frase(f, (id) => nombres.get(id) ?? 'una persona que ya no está'),
    })),
  });
}

// ── HU-C9.6 · Los asistentes con acceso ─────────────────────────────────────

export interface AsistenteVisible {
  id: string;
  cliente: string;
  espacio: string;
  producto_nombre: string;
  /** Lo que puede hacer, en palabras: la descripción de cada alcance. */
  puede: string[];
  creada: string;
  ultimo_uso: string | null;
}

/** Las concesiones vivas que la persona dio, con lo que pueden hacer y su último uso. */
export async function verAsistentes(c: Context, e: Entorno): Promise<Response> {
  const r = await deLaCuenta(c, e);
  if (r instanceof Response) return r;
  const { results } = await e.db
    .prepare(
      `SELECT k.id, k.producto, k.alcances, k.creada, k.ultimo_uso, cl.nombre AS cliente, o.nombre AS espacio
         FROM concesion_oauth k
         JOIN cliente_oauth cl ON cl.id = k.cliente_id
         JOIN organizacion o ON o.id = k.org_id
        WHERE k.usuario_id = ? AND k.revocada IS NULL
        ORDER BY k.creada DESC LIMIT 50`,
    )
    .bind(r.sub)
    .all<{
      id: string;
      producto: string;
      alcances: string;
      creada: string;
      ultimo_uso: string | null;
      cliente: string;
      espacio: string;
    }>();
  const descripciones = await e.db
    .prepare('SELECT producto, id, descripcion FROM alcance')
    .all<{ producto: string; id: string; descripcion: string }>();
  const asistentes: AsistenteVisible[] = results.map((k) => ({
    id: k.id,
    cliente: k.cliente,
    espacio: k.espacio,
    producto_nombre: nombreDelProducto(e, k.producto),
    puede: (JSON.parse(k.alcances) as string[]).map(
      (id) =>
        descripciones.results.find((d) => d.producto === k.producto && d.id === id)?.descripcion ??
        id,
    ),
    creada: k.creada,
    ultimo_uso: k.ultimo_uso,
  }));
  return c.json({ asistentes });
}

/** «Quitar acceso»: la concesión cae y su próximo uso se rechaza en el recurso (CA2). */
export async function quitarAsistente(c: Context, e: Entorno): Promise<Response> {
  const r = await deLaCuenta(c, e);
  if (r instanceof Response) return r;
  const { id } = await cuerpo(c);
  const concesion =
    typeof id === 'string'
      ? await e.db
          .prepare(
            'SELECT id, usuario_id, org_id, producto, cliente_id, recurso, alcances, revocada FROM concesion_oauth WHERE id = ? AND usuario_id = ?',
          )
          .bind(id, r.sub)
          .first<Parameters<typeof revocarConcesion>[1]>()
      : null;
  // Nunca la de otra persona, ni con el id en el cuerpo.
  if (!concesion) return c.json({ estado: 'no-encontrado', motivo: 'Ese acceso no es tuyo.' }, 404);
  if (!concesion.revocada) await revocarConcesion(e, concesion, e.ahora(), 'la persona lo quitó');
  return c.json({ quitado: true });
}
