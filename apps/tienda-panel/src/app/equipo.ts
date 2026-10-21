/**
 * El equipo de la tienda (HU-T10.5 CA1): la invitación es del CORE (HU-E4.4, HU-C3.2), con el rol
 * `colaborador`, y se comparte por WhatsApp con el código en el fragmento del enlace
 * (`/unirme/#invitacion=…`), que no llega a ningún servidor (P13).
 *
 * - Quien invita: el CORE crea el código (solo quien administra la tienda) y aquí se arma el enlace y
 *   el mensaje.
 * - Quien recibe: «Unirme» guarda el código en el teléfono (sobrevive a la ida y vuelta por Google),
 *   lo quita de la barra, lo muestra con `ver` y lo acepta con su sesión; después la sesión se
 *   renueva hacia la tienda nueva.
 */
import type { Almacen } from './almacen.ts';
import { type Conexion, conAcceso } from './api.ts';
import { renovar, type Sesion } from './sesion.ts';

export const CLAVE_INVITACION = 'invitacion_pendiente';
export const ROL_INVITADO = 'colaborador';

export type Invitacion =
  | { estado: 'vigente'; tienda: string; rol: string; invita: string; expira: string }
  | { estado: 'no-sirve'; motivo: string };

/** El código del fragmento (`#invitacion=…`), o null. */
export function codigoDelFragmento(fragmento: string): string | null {
  return new URLSearchParams(fragmento.replace(/^#/, '')).get('invitacion');
}

const SIN_SENAL =
  'Sin conexión: no pudimos hablar con tu cuenta. Revisa la señal e intenta de nuevo.';

async function alCore(
  fetchFn: typeof fetch,
  url: string,
  cuerpo: unknown,
  acceso?: string,
): Promise<{ estado: number; datos: Record<string, unknown> } | null> {
  try {
    const r = await fetchFn(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(acceso ? { authorization: `Bearer ${acceso}` } : {}),
      },
      body: JSON.stringify(cuerpo),
    });
    return {
      estado: r.status,
      datos: (await r.json().catch(() => ({}))) as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

const hastaEl = (expira: string) =>
  new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Bogota',
  }).format(Date.parse(expira));

/** El mensaje para WhatsApp: a qué tienda, con qué rol, el enlace y hasta cuándo sirve. */
export function mensajeDeInvitacion(tienda: string, enlace: string, expira: string): string {
  return `Hola. Te invito a ayudarme con la tienda ${tienda} en su panel, como colaborador: pedidos, productos e inventario. Abre este enlace y entra con tu cuenta de Google: ${enlace} (sirve una sola vez, hasta el ${hastaEl(expira)}).`;
}

/** Enlace de WhatsApp con el mensaje listo, sin destinatario: quien invita elige a quién. */
export const enlaceDeWhatsApp = (mensaje: string) =>
  `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

/** Crea la invitación en el CORE. El código va solo en el fragmento del enlace. */
export async function crearInvitacion(
  c: Conexion,
  opciones: { origen: string; tienda: string },
): Promise<
  | { tipo: 'ok'; enlace: string; mensaje: string; expira: string }
  | { tipo: 'error'; motivo: string }
> {
  const { sesion, motivo } = await conAcceso(c);
  if (!sesion) return { tipo: 'error', motivo: motivo ?? 'Entra con tu cuenta para invitar.' };
  const r = await alCore(
    c.fetchFn ?? fetch,
    `${c.core}/api/core/invitaciones`,
    { rol: ROL_INVITADO },
    sesion.acceso,
  );
  if (!r) return { tipo: 'error', motivo: SIN_SENAL };
  if (r.estado !== 201) {
    return {
      tipo: 'error',
      motivo:
        r.estado === 403
          ? 'Solo quien administra la tienda puede invitar.'
          : String(r.datos['motivo'] ?? `No se pudo crear la invitación (${r.estado}).`),
    };
  }
  const enlace = `${opciones.origen}/unirme/#invitacion=${encodeURIComponent(String(r.datos['codigo']))}`;
  const expira = String(r.datos['expira']);
  return {
    tipo: 'ok',
    enlace,
    expira,
    mensaje: mensajeDeInvitacion(opciones.tienda, enlace, expira),
  };
}

export async function verInvitacion(
  core: string,
  codigo: string,
  fetchFn: typeof fetch = fetch,
): Promise<Invitacion> {
  const r = await alCore(fetchFn, `${core}/api/core/invitaciones/ver`, { codigo });
  if (!r) return { estado: 'no-sirve', motivo: SIN_SENAL };
  if (r.estado === 200) {
    // El CORE la llama «finca» (es del agro); aquí es la tienda.
    const d = r.datos as { finca?: string; rol?: string; invita?: string; expira?: string };
    return {
      estado: 'vigente',
      tienda: String(d.finca ?? ''),
      rol: String(d.rol ?? ''),
      invita: String(d.invita ?? ''),
      expira: String(d.expira ?? ''),
    };
  }
  return {
    estado: 'no-sirve',
    motivo: String(
      r.datos['motivo'] ?? 'No pudimos revisar la invitación. Intenta de nuevo en un momento.',
    ).replace(/la finca/g, 'la tienda'),
  };
}

export const guardarCodigo = (almacen: Almacen, codigo: string) =>
  almacen.guardar(CLAVE_INVITACION, codigo);
export const codigoPendiente = async (almacen: Almacen) =>
  (await almacen.leer<string>(CLAVE_INVITACION)) ?? null;

/** Acepta la invitación pendiente con la sesión de ahora y la renueva hacia la tienda nueva. */
export async function aceptarInvitacion(
  c: Conexion,
): Promise<{ tipo: 'ok'; sesion: Sesion; tienda: string } | { tipo: 'error'; motivo: string }> {
  const codigo = await codigoPendiente(c.almacen);
  if (!codigo)
    return { tipo: 'error', motivo: 'No hay una invitación pendiente en este teléfono.' };
  const { sesion, motivo } = await conAcceso(c);
  if (!sesion) return { tipo: 'error', motivo: motivo ?? 'Entra con tu cuenta para unirte.' };
  const r = await alCore(
    c.fetchFn ?? fetch,
    `${c.core}/api/core/invitaciones/aceptar`,
    { codigo },
    sesion.acceso,
  );
  if (!r) return { tipo: 'error', motivo: SIN_SENAL };
  if (r.estado !== 200) {
    return {
      tipo: 'error',
      motivo: String(
        r.datos['motivo'] ?? `No se pudo aceptar la invitación (${r.estado}).`,
      ).replace(/la finca/g, 'la tienda'),
    };
  }
  await c.almacen.borrar(CLAVE_INVITACION);
  const nueva = await renovar(c.almacen, c.core, {
    org: String(r.datos['org_id']),
    ...(c.fetchFn ? { fetchFn: c.fetchFn } : {}),
  });
  if (!nueva.sesion)
    return {
      tipo: 'error',
      motivo: nueva.motivo ?? 'Te uniste, pero tu sesión venció. Vuelve a entrar.',
    };
  return { tipo: 'ok', sesion: nueva.sesion, tienda: String(r.datos['finca'] ?? '') };
}

export interface Miembro {
  usuario_id: string;
  nombre: string;
  rol: string;
  /** Es quien está mirando: no se puede quitar a sí mismo. */
  tu: boolean;
}

/** Validación del 20 oct 2026: quiénes tienen acceso a la tienda, del CORE (`equipo/ver`). */
export async function verEquipo(
  c: Conexion,
): Promise<{ tipo: 'ok'; miembros: Miembro[] } | { tipo: 'error'; motivo: string }> {
  const { sesion, motivo } = await conAcceso(c);
  if (!sesion)
    return { tipo: 'error', motivo: motivo ?? 'Entra con tu cuenta para ver tu equipo.' };
  const r = await alCore(c.fetchFn ?? fetch, `${c.core}/api/core/equipo/ver`, {}, sesion.acceso);
  if (!r) return { tipo: 'error', motivo: SIN_SENAL };
  if (r.estado !== 200)
    return {
      tipo: 'error',
      motivo:
        r.estado === 403
          ? 'Solo quien administra la tienda ve su equipo.'
          : `No pudimos leer tu equipo (${r.estado}).`,
    };
  return { tipo: 'ok', miembros: (r.datos['miembros'] ?? []) as Miembro[] };
}

/** Quita a alguien de la tienda. En su próxima renovación (a más tardar 12 h) ya no entra. */
export async function quitarDelEquipo(
  c: Conexion,
  usuario: string,
): Promise<{ tipo: 'ok' } | { tipo: 'error'; motivo: string }> {
  const { sesion, motivo } = await conAcceso(c);
  if (!sesion) return { tipo: 'error', motivo: motivo ?? 'Entra con tu cuenta.' };
  const r = await alCore(
    c.fetchFn ?? fetch,
    `${c.core}/api/core/equipo/quitar`,
    { usuario_id: usuario },
    sesion.acceso,
  );
  if (!r) return { tipo: 'error', motivo: SIN_SENAL };
  if (r.estado !== 200)
    return {
      tipo: 'error',
      motivo: String(r.datos['motivo'] ?? 'No pudimos quitar a esa persona.').replace(
        /la finca/g,
        'la tienda',
      ),
    };
  return { tipo: 'ok' };
}
