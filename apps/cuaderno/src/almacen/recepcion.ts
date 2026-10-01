/**
 * Bajar lo que registraron los demás (HU-E5.3, ARQUITECTURA §5.6).
 *
 * - Pide páginas con los cursores guardados en `meta` (clave `cursor_pull`) hasta que no haya más.
 *   Cada página se aplica junto con su cursor en **una** transacción: si el teléfono se apaga a
 *   mitad, la página se vuelve a pedir y aplicar sin duplicar (los ids no se repiten).
 * - Lo que baja no entra a la cola de salida: ya está en la nube.
 * - **Registros:** inmutables. Si ya está, se deja como está.
 * - **Catálogos:** gana la versión mayor. Si este teléfono tiene una edición **pendiente** de esa
 *   entidad (en la cola de salida), no se pisa (CA2): la versión de la nube se guarda en el
 *   historial local como conflicto, para que la persona decida (HU-E5.4).
 */
import {
  type CambioDeCatalogo,
  CURSOR_INICIAL,
  type Cursor,
  type RespuestaPull,
} from '@gestionagro/sync';
import type { CuadernoDb, VersionAnterior } from './db.ts';

export const CLAVE_CURSOR = 'cursor_pull';

export type ResultadoDeRecepcion =
  | { estado: 'al-dia'; recibidos: number; conflictos: number }
  | { estado: 'sin-senal'; recibidos: number; conflictos: number }
  | { estado: 'esperar'; recibidos: number; conflictos: number; ms: number; motivo: string }
  | { estado: 'sin-sesion' | 'error'; recibidos: number; conflictos: number; motivo: string };

export async function leerCursor(db: CuadernoDb): Promise<Cursor> {
  return ((await db.meta.get(CLAVE_CURSOR))?.valor as Cursor | undefined) ?? CURSOR_INICIAL;
}

/** Aplica una página con su cursor, en una transacción. Devuelve recibidos y conflictos. */
export async function aplicarPagina(
  db: CuadernoDb,
  pagina: RespuestaPull,
  instante: string,
): Promise<{ recibidos: number; conflictos: number }> {
  let recibidos = 0;
  let conflictos = 0;
  const tablas = [
    db.registro,
    db.outbox,
    db.historial,
    db.meta,
    ...new Set(pagina.catalogos.map((c) => db.table(c.entidad))),
  ];
  await db.transaction('rw', tablas, async () => {
    // Entidades con una edición local que todavía no sube: una lectura de la cola por página.
    const pendientes = new Set((await db.outbox.toArray()).map((o) => o.entidad_id));
    for (const cambio of pagina.catalogos) {
      const r = await aplicarCatalogo(db, cambio, pendientes.has(cambio.datos.id), instante);
      if (r === 'recibido') recibidos++;
      if (r === 'conflicto') conflictos++;
    }
    const ids = pagina.registros.map((r) => r.id);
    const ya = await db.registro.bulkGet(ids);
    const nuevos = pagina.registros.filter((_, i) => !ya[i]);
    await db.registro.bulkAdd(nuevos);
    recibidos += nuevos.length;
    await db.meta.put({ clave: CLAVE_CURSOR, valor: pagina.cursor, actualizado: instante });
  });
  return { recibidos, conflictos };
}

async function aplicarCatalogo(
  db: CuadernoDb,
  { entidad, datos }: CambioDeCatalogo,
  pendiente: boolean,
  instante: string,
): Promise<'recibido' | 'conflicto' | 'nada'> {
  const tabla = db.table(entidad);
  const local = (await tabla.get(datos.id)) as { version: number } | undefined;
  if (local && local.version > datos.version) return 'nada'; // la nuestra es más nueva y sube
  if (local && pendiente) {
    if (
      local.version === datos.version &&
      JSON.stringify(stripOrg(local)) === JSON.stringify(stripOrg(datos))
    ) {
      return 'nada';
    }
    const conflicto: VersionAnterior = {
      id: `${datos.id}@v${datos.version}#nube`,
      entidad,
      entidad_id: datos.id,
      version: datos.version,
      datos,
      reemplazada: instante,
    };
    await db.historial.put(conflicto);
    return 'conflicto';
  }
  if (local && local.version === datos.version) return 'nada';
  await tabla.put(datos);
  return 'recibido';
}

/** El teléfono guarda `org_id` en null hasta vincular; la nube lo llena. No cuenta como cambio. */
const stripOrg = (o: object) => ({ ...o, org_id: null });

export async function recibirCambios(
  db: CuadernoDb,
  destino: { api: string; acceso: string },
  opciones: { fetchFn?: typeof fetch; ahora?: () => number; maxPaginas?: number } = {},
): Promise<ResultadoDeRecepcion> {
  const { fetchFn = fetch, ahora = () => Date.now(), maxPaginas = 500 } = opciones;
  let recibidos = 0;
  let conflictos = 0;
  for (let n = 0; n < maxPaginas; n++) {
    const c = await leerCursor(db);
    let r: Response;
    let cuerpo: Partial<RespuestaPull> & { motivo?: string };
    try {
      r = await fetchFn(
        `${destino.api}/api/v1/sync/pull?registro=${c.registro}&catalogo=${c.catalogo}`,
        {
          headers: { authorization: `Bearer ${destino.acceso}` },
        },
      );
      cuerpo = (await r.json()) as typeof cuerpo;
    } catch {
      return { estado: 'sin-senal', recibidos, conflictos };
    }
    if (r.status === 401)
      return { estado: 'sin-sesion', recibidos, conflictos, motivo: cuerpo.motivo ?? 'Sin sesión' };
    if (r.status === 429 || r.status === 503) {
      const pedido = Number(r.headers.get('retry-after'));
      return {
        estado: 'esperar',
        recibidos,
        conflictos,
        ms: Number.isFinite(pedido) && pedido > 0 ? pedido * 1000 : 60_000,
        motivo: cuerpo.motivo ?? 'La nube pidió una pausa.',
      };
    }
    if (
      !r.ok ||
      !Array.isArray(cuerpo.registros) ||
      !Array.isArray(cuerpo.catalogos) ||
      !cuerpo.cursor
    ) {
      return {
        estado: 'error',
        recibidos,
        conflictos,
        motivo: cuerpo.motivo ?? `La celda respondió ${r.status}`,
      };
    }
    const hecho = await aplicarPagina(db, cuerpo as RespuestaPull, new Date(ahora()).toISOString());
    recibidos += hecho.recibidos;
    conflictos += hecho.conflictos;
    if (!cuerpo.mas) return { estado: 'al-dia', recibidos, conflictos };
  }
  return { estado: 'al-dia', recibidos, conflictos };
}
