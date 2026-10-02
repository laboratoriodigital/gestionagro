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
 * - **Conflicto perdido (HU-E5.4):** si la versión que baja ganó en la nube contra una de este
 *   teléfono (`reemplazo` nombra a este teléfono y la versión que tiene), se guarda un aviso con
 *   lo que había aquí, para decirlo y ofrecer volver a ponerlo.
 * - **Rol (HU-E4.5):** la celda solo baja lo que el rol puede leer. Si el rol de esta persona
 *   cambia, el teléfono borra lo que ya no le toca ver (salvo lo que tiene pendiente por subir) y
 *   vuelve a bajar desde el principio, para recibir lo que antes no le tocaba.
 */
import {
  type CambioDeCatalogo,
  CURSOR_INICIAL,
  type Cursor,
  ENTIDADES_DE_CATALOGO,
  puede,
  type RespuestaPull,
  tiposNegados,
} from '@gestionagro/sync';
import type { CuadernoDb, VersionAnterior } from './db.ts';
import { idDispositivo } from './dispositivo.ts';

export const CLAVE_CURSOR = 'cursor_pull';
/** El rol con el que se bajó lo que hay en este teléfono. */
export const CLAVE_ROL = 'rol_pull';

/**
 * Deja el teléfono acorde al rol: si cambió, borra lo que el rol ya no puede leer (sin tocar lo
 * pendiente por subir) y reinicia el cursor. Devuelve si cambió.
 */
export async function ajustarAlRol(
  db: CuadernoDb,
  rol: string,
  instante: string,
): Promise<boolean> {
  if ((await db.meta.get(CLAVE_ROL))?.valor === rol) return false;
  const ocultas = ENTIDADES_DE_CATALOGO.filter((e) => !puede(rol, 'leer', e));
  const tipos = tiposNegados(rol, 'leer');
  const tablas = [db.meta, db.outbox, db.registro, ...ocultas.map((e) => db.table(e))];
  await db.transaction('rw', tablas, async () => {
    const pendientes = new Set((await db.outbox.toArray()).map((o) => o.entidad_id));
    for (const e of ocultas) {
      const ids = (await db.table(e).toCollection().primaryKeys()) as string[];
      await db.table(e).bulkDelete(ids.filter((id) => !pendientes.has(id)));
    }
    // Registros de un tipo que el rol no ve (los despachos llevan precios, HU-E6.3).
    if (tipos.length > 0) {
      const ids = (await db.registro.where('tipo').anyOf(tipos).primaryKeys()) as string[];
      await db.registro.bulkDelete(ids.filter((id) => !pendientes.has(id)));
    }
    await db.meta.put({ clave: CLAVE_CURSOR, valor: CURSOR_INICIAL, actualizado: instante });
    await db.meta.put({ clave: CLAVE_ROL, valor: rol, actualizado: instante });
  });
  return true;
}

export type ResultadoDeRecepcion =
  | {
      estado: 'al-dia';
      recibidos: number;
      conflictos: number;
      /** Nivel que dijo la celda; en `ahorro` se revisa cada 60 min (ARQUITECTURA §8.2). */
      nivel?: string;
    }
  | { estado: 'sin-senal'; recibidos: number; conflictos: number }
  | {
      estado: 'esperar';
      recibidos: number;
      conflictos: number;
      ms: number;
      motivo: string;
      causa?: string;
      reanuda?: string;
    }
  | { estado: 'sin-sesion' | 'error'; recibidos: number; conflictos: number; motivo: string };

export async function leerCursor(db: CuadernoDb): Promise<Cursor> {
  return ((await db.meta.get(CLAVE_CURSOR))?.valor as Cursor | undefined) ?? CURSOR_INICIAL;
}

/** Aplica una página con su cursor, en una transacción. Devuelve recibidos y conflictos. */
export async function aplicarPagina(
  db: CuadernoDb,
  pagina: RespuestaPull,
  instante: string,
  /** Este teléfono: para reconocer una versión suya que perdió un conflicto. */
  dispositivo = '',
): Promise<{ recibidos: number; conflictos: number }> {
  let recibidos = 0;
  let conflictos = 0;
  const tablas = [
    db.registro,
    db.outbox,
    db.historial,
    db.meta,
    db.reemplazo,
    ...new Set(pagina.catalogos.map((c) => db.table(c.entidad))),
  ];
  await db.transaction('rw', tablas, async () => {
    // Entidades con una edición local que todavía no sube: una lectura de la cola por página.
    const pendientes = new Set((await db.outbox.toArray()).map((o) => o.entidad_id));
    for (const cambio of pagina.catalogos) {
      const r = await aplicarCatalogo(
        db,
        cambio,
        pendientes.has(cambio.datos.id),
        instante,
        dispositivo,
      );
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
  { entidad, datos, reemplazo }: CambioDeCatalogo,
  pendiente: boolean,
  instante: string,
  dispositivo: string,
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
  // Lo que hay aquí es la versión de este teléfono que perdió en la nube: se avisa (HU-E5.4).
  if (
    local &&
    reemplazo &&
    dispositivo &&
    reemplazo.dispositivo === dispositivo &&
    reemplazo.version === local.version
  ) {
    await db.reemplazo.put({
      id: `${datos.id}@v${local.version}`,
      entidad,
      entidad_id: datos.id,
      version: local.version,
      datos: local,
      por_usuario: reemplazo.por_usuario,
      recibido: instante,
      resuelto: null,
    });
  }
  await tabla.put(datos);
  return 'recibido';
}

/** El teléfono guarda `org_id` en null hasta vincular; la nube lo llena. No cuenta como cambio. */
const stripOrg = (o: object) => ({ ...o, org_id: null });

export async function recibirCambios(
  db: CuadernoDb,
  destino: { api: string; acceso: string; rol?: string | null },
  opciones: { fetchFn?: typeof fetch; ahora?: () => number; maxPaginas?: number } = {},
): Promise<ResultadoDeRecepcion> {
  const { fetchFn = fetch, ahora = () => Date.now(), maxPaginas = 500 } = opciones;
  let recibidos = 0;
  let conflictos = 0;
  const dispositivo = await idDispositivo(db);
  if (destino.rol) await ajustarAlRol(db, destino.rol, new Date(ahora()).toISOString());
  for (let n = 0; n < maxPaginas; n++) {
    const c = await leerCursor(db);
    let r: Response;
    let cuerpo: Partial<RespuestaPull> & { motivo?: string; estado?: string; reanuda?: string };
    try {
      r = await fetchFn(
        `${destino.api}/api/v1/sync/pull?registro=${c.registro}&catalogo=${c.catalogo}`,
        {
          headers: { authorization: `Bearer ${destino.acceso}` },
        },
      );
    } catch {
      // Sin respuesta no se sabe qué guardó la celda: la cola queda igual (CA4).
      return { estado: 'sin-senal', recibidos, conflictos };
    }
    try {
      cuerpo = (await r.json()) as typeof cuerpo;
    } catch {
      // Una respuesta buena cortada a mitad es como no tenerla. Un error que no es JSON es un
      // error de la nube, no falta de señal: se dice como es (bitácora agro 23, P15).
      if (r.ok) return { estado: 'sin-senal', recibidos, conflictos };
      cuerpo = {};
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
        ...(cuerpo.estado ? { causa: cuerpo.estado } : {}),
        ...(cuerpo.reanuda ? { reanuda: cuerpo.reanuda } : {}),
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
    const hecho = await aplicarPagina(
      db,
      cuerpo as RespuestaPull,
      new Date(ahora()).toISOString(),
      dispositivo,
    );
    recibidos += hecho.recibidos;
    conflictos += hecho.conflictos;
    if (!cuerpo.mas) {
      return cuerpo.nivel
        ? { estado: 'al-dia', recibidos, conflictos, nivel: cuerpo.nivel }
        : { estado: 'al-dia', recibidos, conflictos };
    }
  }
  return { estado: 'al-dia', recibidos, conflictos };
}
