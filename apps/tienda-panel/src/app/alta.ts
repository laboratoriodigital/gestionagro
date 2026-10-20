/**
 * El alta de una tienda desde el panel (HU-T13.4): la dirección libre mientras se escribe, la
 * organización en el CORE y la tienda en la API. El id de la organización nace en el teléfono y se
 * guarda hasta que la tienda abre: si algo falla a mitad, volver a intentar usa el mismo id y el CORE
 * responde la misma organización, sin crear otra.
 */
import { uuidv7 } from '@ed1/ids';
import { type Conexion, pedirAlPanel } from './api.ts';
import { opNueva } from './catalogo.ts';
import { ErrorDeSesion, leerSesion, renovar, type Sesion } from './sesion.ts';

const CLAVE_DEL_ALTA = 'alta:org';

export type Disponibilidad =
  | { disponible: true; slug: string; direccion: string; turnstile: string | null }
  | { disponible: false; motivo: string; turnstile: string | null };

/** Una sesión con su acceso vigente, renovándola si hace falta. */
async function acceso(c: Conexion): Promise<string> {
  const sesion = await leerSesion(c.almacen);
  if (!sesion) throw new ErrorDeSesion('Entra con tu cuenta.');
  if (sesion.acceso_vence > (c.ahora ?? Date.now)()) return sesion.acceso;
  const r = await renovar(c.almacen, c.core, c.fetchFn ? { fetchFn: c.fetchFn } : {});
  if (!r.sesion) throw new ErrorDeSesion(r.motivo ?? 'Tu sesión venció. Vuelve a entrar.');
  return r.sesion.acceso;
}

/** Si la dirección está libre, y la clave del sitio de Turnstile. */
export async function consultarDireccion(c: Conexion, slug: string): Promise<Disponibilidad> {
  const token = await acceso(c);
  const r = await (c.fetchFn ?? fetch)(`/api/alta/v1/disponible?slug=${encodeURIComponent(slug)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (r.status === 401) throw new ErrorDeSesion('Tu sesión venció. Vuelve a entrar.');
  if (!r.ok)
    return { disponible: false, motivo: 'No pudimos revisar la dirección ahora.', turnstile: null };
  return (await r.json()) as Disponibilidad;
}

export type ResultadoDelAlta =
  | { tipo: 'abierta'; sesion: Sesion; direccion: string }
  | { tipo: 'problema'; campo: string; mensaje: string };

/** Crea la organización en el CORE (una sola vez) y abre la tienda en ella. */
export async function abrirMiTienda(
  c: Conexion,
  d: { nombre: string; slug: string; turnstile: string },
): Promise<ResultadoDelAlta> {
  const token = await acceso(c);
  const id = (await c.almacen.leer<string>(CLAVE_DEL_ALTA)) ?? uuidv7();
  await c.almacen.guardar(CLAVE_DEL_ALTA, id);
  const core = await (c.fetchFn ?? fetch)(`${c.core}/api/core/organizaciones`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ id, nombre: d.nombre }),
  });
  if (core.status === 401) throw new ErrorDeSesion('Tu sesión venció. Vuelve a entrar.');
  if (!core.ok) {
    const cuerpo = (await core.json().catch(() => ({}))) as { motivo?: string };
    return {
      tipo: 'problema',
      campo: 'nombre',
      mensaje: cuerpo.motivo ?? 'No pudimos crear tu tienda ahora. Intenta en unos minutos.',
    };
  }
  // La sesión, hacia la organización nueva: ya trae su celda y su shard.
  const r = await renovar(c.almacen, c.core, {
    org: id,
    ...(c.fetchFn ? { fetchFn: c.fetchFn } : {}),
  });
  if (!r.sesion?.org_id) {
    return {
      tipo: 'problema',
      campo: 'nombre',
      mensaje: r.motivo ?? 'Tu tienda quedó a medias. Intenta otra vez: seguimos donde quedó.',
    };
  }
  const alta = await pedirAlPanel<{ estado: 'guardado'; direccion: string }>(c, 'alta', {
    cuerpo: { op: opNueva(), ...d },
  });
  if (alta.tipo === 'sin-sesion') throw new ErrorDeSesion(alta.motivo);
  if (alta.tipo !== 'ok') {
    const p = alta.problemas?.[0];
    return { tipo: 'problema', campo: p?.campo ?? 'slug', mensaje: p?.mensaje ?? alta.motivo };
  }
  await c.almacen.borrar(CLAVE_DEL_ALTA);
  return { tipo: 'abierta', sesion: r.sesion, direccion: alta.datos.direccion };
}
