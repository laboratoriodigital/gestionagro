/**
 * Invitaciones del equipo en el teléfono (HU-E4.4).
 *
 * - El propietario crea una y la comparte por WhatsApp. El código va en el fragmento del enlace
 *   (`/agro/app/unirme/#invitacion=…`): no llega a ningún servidor al abrirlo (CA2, P13).
 * - Quien la recibe: la pantalla «Unirme» guarda el código en la base local (sobrevive a la ida y
 *   vuelta por Google), lo quita de la barra de direcciones y lo manda al CORE en el cuerpo de un
 *   POST para verla y para aceptarla.
 * - Aceptar baja la finca a este teléfono con `bajarFinca` (HU-E5.3): un teléfono con otra finca
 *   no se mezcla.
 */
import type { CuadernoDb } from './db.ts';
import { ErrorDeSesion, leerSesion, type Sesion } from './sesion.ts';
import { bajarFinca } from './vinculo.ts';

export const CLAVE_INVITACION = 'invitacion_pendiente';

export const NOMBRE_ROL: Readonly<Record<string, string>> = {
  propietario: 'propietario',
  supervisor: 'supervisor',
  operario: 'operario',
  asesor: 'asesor',
  auditor: 'auditor',
};

export const ROLES_PARA_INVITAR = ['operario', 'supervisor', 'asesor', 'propietario'] as const;

export type Invitacion =
  | { estado: 'vigente'; finca: string; rol: string; invita: string; expira: string }
  | { estado: 'no-sirve'; motivo: string };

/** El código de invitación del fragmento (`#invitacion=…`), o null. */
export function codigoDelFragmento(fragmento: string): string | null {
  return new URLSearchParams(fragmento.replace(/^#/, '')).get('invitacion');
}

export async function guardarCodigo(db: CuadernoDb, codigo: string): Promise<void> {
  await db.meta.put({
    clave: CLAVE_INVITACION,
    valor: codigo,
    actualizado: new Date().toISOString(),
  });
}

export async function codigoPendiente(db: CuadernoDb): Promise<string | null> {
  const v = (await db.meta.get(CLAVE_INVITACION))?.valor;
  return typeof v === 'string' ? v : null;
}

async function post(
  fetchFn: typeof fetch,
  url: string,
  cuerpo: unknown,
  acceso?: string,
): Promise<{ estado: number; datos: Record<string, unknown> }> {
  let r: Response;
  try {
    r = await fetchFn(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(acceso ? { authorization: `Bearer ${acceso}` } : {}),
      },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorDeSesion('Sin señal: inténtalo cuando haya señal.');
  }
  return { estado: r.status, datos: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

export async function verInvitacion(
  core: string,
  codigo: string,
  fetchFn: typeof fetch = fetch,
): Promise<Invitacion> {
  const r = await post(fetchFn, `${core}/api/core/invitaciones/ver`, { codigo });
  if (r.estado === 200) return r.datos as unknown as Invitacion;
  return {
    estado: 'no-sirve',
    motivo: String(r.datos['motivo'] ?? 'No se pudo revisar la invitación. Intenta de nuevo.'),
  };
}

/** Crea una invitación con ese rol (solo el propietario) y devuelve el enlace y el mensaje. */
export async function crearInvitacion(
  db: CuadernoDb,
  core: string,
  rol: string,
  opciones: { origen: string; finca: string; fetchFn?: typeof fetch },
): Promise<{ enlace: string; mensaje: string; expira: string }> {
  const sesion = await leerSesion(db);
  if (!sesion) throw new ErrorDeSesion('Entra con tu cuenta para invitar.');
  const r = await post(
    opciones.fetchFn ?? fetch,
    `${core}/api/core/invitaciones`,
    { rol },
    sesion.acceso,
  );
  if (r.estado !== 201) {
    throw new ErrorDeSesion(
      String(r.datos['motivo'] ?? `No se pudo crear la invitación (${r.estado}).`),
    );
  }
  const enlace = `${opciones.origen}/agro/app/unirme/#invitacion=${String(r.datos['codigo'])}`;
  const expira = String(r.datos['expira']);
  const hasta = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Bogota',
  }).format(Date.parse(expira));
  const mensaje = `Hola. Te invito al cuaderno de campo de ${opciones.finca} como ${NOMBRE_ROL[rol] ?? rol}. Abre este enlace y entra con tu cuenta de Google: ${enlace} (sirve una sola vez, hasta el ${hasta}).`;
  return { enlace, mensaje, expira };
}

/** Enlace de WhatsApp con el mensaje listo, sin destinatario: la persona elige a quién (CA1). */
export const enlaceDeWhatsApp = (mensaje: string) =>
  `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

/**
 * Acepta la invitación pendiente con la sesión actual y baja la finca a este teléfono (CA4).
 * Devuelve la sesión ya apuntando a esa finca.
 */
export async function aceptarInvitacion(
  db: CuadernoDb,
  core: string,
  opciones: { fetchFn?: typeof fetch; ahora?: () => number } = {},
): Promise<{ sesion: Sesion; finca: string; rol: string }> {
  const fetchFn = opciones.fetchFn ?? fetch;
  const codigo = await codigoPendiente(db);
  if (!codigo) throw new ErrorDeSesion('No hay una invitación pendiente en este teléfono.');
  const sesion = await leerSesion(db);
  if (!sesion) throw new ErrorDeSesion('Entra con tu cuenta para unirte.');
  if (await db.finca.toCollection().first()) {
    throw new ErrorDeSesion(
      'Este teléfono ya tiene una finca. Para no mezclar datos, únete desde un teléfono sin finca.',
    );
  }
  const r = await post(fetchFn, `${core}/api/core/invitaciones/aceptar`, { codigo }, sesion.acceso);
  if (r.estado !== 200) {
    throw new ErrorDeSesion(
      String(r.datos['motivo'] ?? `No se pudo aceptar la invitación (${r.estado}).`),
    );
  }
  const orgId = String(r.datos['org_id']);
  const nueva = await bajarFinca(db, core, orgId, {
    fetchFn,
    ...(opciones.ahora ? { ahora: opciones.ahora } : {}),
  });
  await db.meta.delete(CLAVE_INVITACION);
  return { sesion: nueva, finca: String(r.datos['finca']), rol: String(r.datos['rol']) };
}
