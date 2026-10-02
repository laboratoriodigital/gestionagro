/**
 * La finca del teléfono y su organización en la nube (HU-E4.3).
 *
 * - **Subir la finca:** crea la organización en el CORE con un id generado aquí (si la respuesta se
 *   pierde, reintentar no crea otra), renueva la sesión hacia esa organización, guarda el vínculo
 *   y pone en la cola de salida todo lo que todavía no estaba: lo importado de un respaldo, que
 *   nunca entró a la cola (HU-E3.13). Se encola por lotes, para no bloquear un teléfono barato.
 * - **No mezclar (CA3):** si este teléfono ya está vinculado a una organización que no es de la
 *   cuenta con la que se entró, no se sube nada y se pide entrar con la cuenta correcta.
 * - El vínculo vive en `meta` (clave `vinculo`): los datos locales no se reescriben, la celda pone
 *   la organización del token en cada fila (HU-E5.1).
 */
import { uuidv7 } from '@gestionagro/agro-schema';
import { ENTIDADES_DE_CATALOGO } from '@gestionagro/sync';
import type { CuadernoDb, OperacionSalida } from './db.ts';
import {
  CLAVE_SESION,
  ErrorDeSesion,
  leerSesion,
  renovarSiHaceFalta,
  type Sesion,
} from './sesion.ts';

export const CLAVE_VINCULO = 'vinculo';
/** Id de la organización que se está creando: el mismo en cada reintento. */
export const CLAVE_ORG_PENDIENTE = 'org_pendiente';
const TAMANO_DE_LOTE_LOCAL = 500;

export interface Vinculo {
  org_id: string;
  /** Null en un teléfono que baja la finca de la nube, hasta que llegue (HU-E5.3). */
  finca_id: string | null;
  vinculado: string;
}

export type EstadoDelVinculo =
  | 'sin-finca'
  | 'sin-cuenta'
  /** La cuenta no tiene esta finca en la nube: se ofrece subirla. */
  | 'sin-subir'
  | 'vinculada'
  /** Vinculada a una organización que no es de esta cuenta: no se mezcla (CA3). */
  | 'otra-cuenta'
  /** Teléfono sin finca y cuenta con fincas en la nube: se ofrece bajarla (HU-E5.3, CA4). */
  | 'para-bajar';

export async function leerVinculo(db: CuadernoDb): Promise<Vinculo | null> {
  return ((await db.meta.get(CLAVE_VINCULO))?.valor as Vinculo | undefined) ?? null;
}

export async function estadoDelVinculo(
  db: CuadernoDb,
  sesion: Sesion | null,
): Promise<EstadoDelVinculo> {
  const finca = await db.finca.toCollection().first();
  const vinculo = await leerVinculo(db);
  if (!sesion) return finca || vinculo ? 'sin-cuenta' : 'sin-finca';
  if (!vinculo) {
    if (finca) return 'sin-subir';
    return sesion.organizaciones.length > 0 ? 'para-bajar' : 'sin-finca';
  }
  return sesion.organizaciones.some((o) => o.org_id === vinculo.org_id)
    ? 'vinculada'
    : 'otra-cuenta';
}

/**
 * La sesión con la que este teléfono sincroniza su finca (bitácora agro 25). Una cuenta que está
 * en dos fincas (la suya y la que la invitó) recibe del CORE una sesión sin finca si no pide cuál:
 * el teléfono pide siempre la de su vínculo, y si tiene la de otra, la renueva en ese momento.
 */
export async function sesionDeLaFinca(
  db: CuadernoDb,
  core: string,
  opciones: Parameters<typeof renovarSiHaceFalta>[2] = {},
): ReturnType<typeof renovarSiHaceFalta> {
  const vinculo = await leerVinculo(db);
  const org = vinculo?.org_id ?? null;
  const r = await renovarSiHaceFalta(db, core, { ...opciones, org });
  const otra =
    r.sesion &&
    vinculo &&
    r.sesion.org_id !== vinculo.org_id &&
    r.sesion.organizaciones.some((o) => o.org_id === vinculo.org_id);
  return otra ? renovarSiHaceFalta(db, core, { ...opciones, org, forzar: true }) : r;
}

/** Pone en la cola lo que falte, sin duplicar lo que ya está. Devuelve cuántas operaciones agregó. */
export async function encolarTodo(
  db: CuadernoDb,
  ahora: () => number = () => Date.now(),
): Promise<number> {
  let agregadas = 0;
  const instante = new Date(ahora()).toISOString();
  for (const entidad of [...ENTIDADES_DE_CATALOGO, 'registro'] as const) {
    const filas = (await db.table(entidad).toArray()) as { id: string; version?: number }[];
    for (let i = 0; i < filas.length; i += TAMANO_DE_LOTE_LOCAL) {
      const tramo = filas.slice(i, i + TAMANO_DE_LOTE_LOCAL);
      const ops: OperacionSalida[] = tramo.map((f) => ({
        id: entidad === 'registro' ? f.id : `${f.id}@v${f.version ?? 1}`,
        entidad,
        entidad_id: f.id,
        version: entidad === 'registro' ? 1 : (f.version ?? 1),
        op: 'crear',
        creado: instante,
      }));
      await db.transaction('rw', db.outbox, async () => {
        const ya = await db.outbox.bulkGet(ops.map((o) => o.id));
        const faltan = ops.filter((_, k) => !ya[k]);
        await db.outbox.bulkAdd(faltan);
        agregadas += faltan.length;
      });
    }
  }
  return agregadas;
}

async function pedir(
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
    throw new ErrorDeSesion('Sin señal: no se pudo subir la finca. Inténtalo cuando haya señal.');
  }
  return { estado: r.status, datos: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

/**
 * Sube la finca de este teléfono a la cuenta (CA1). Requiere una sesión activa (se renueva
 * antes en la pantalla). Devuelve la sesión ya apuntando a la organización nueva.
 */
export async function subirFinca(
  db: CuadernoDb,
  core: string,
  opciones: { fetchFn?: typeof fetch; ahora?: () => number } = {},
): Promise<{ sesion: Sesion; encoladas: number }> {
  const { fetchFn = fetch, ahora = () => Date.now() } = opciones;
  const sesion = await leerSesion(db);
  if (!sesion) throw new ErrorDeSesion('Entra con tu cuenta para subir la finca.');
  const finca = await db.finca.toCollection().first();
  if (!finca) throw new ErrorDeSesion('Primero configura tu finca.');
  if (await leerVinculo(db)) throw new ErrorDeSesion('Este teléfono ya tiene su finca vinculada.');

  const pendiente = (await db.meta.get(CLAVE_ORG_PENDIENTE))?.valor;
  const orgId = typeof pendiente === 'string' ? pendiente : uuidv7(ahora);
  await db.meta.put({
    clave: CLAVE_ORG_PENDIENTE,
    valor: orgId,
    actualizado: new Date(ahora()).toISOString(),
  });

  const creada = await pedir(
    fetchFn,
    `${core}/api/core/organizaciones`,
    { id: orgId, nombre: finca.nombre },
    sesion.acceso,
  );
  if (creada.estado !== 200 && creada.estado !== 201) {
    throw new ErrorDeSesion(
      String(creada.datos['motivo'] ?? `No se pudo crear la finca en la nube (${creada.estado}).`),
    );
  }
  const renovada = await pedir(fetchFn, `${core}/api/core/auth/refrescar`, {
    refresh: sesion.refresh,
    org_id: orgId,
  });
  if (renovada.estado !== 200 || renovada.datos['org_id'] !== orgId) {
    throw new ErrorDeSesion(
      String(
        renovada.datos['motivo'] ??
          'La finca se creó, pero no se pudo renovar la sesión. Vuelve a intentarlo.',
      ),
    );
  }
  const nueva = {
    ...(renovada.datos as unknown as Sesion),
    refresh: (renovada.datos['refresh'] as string | null) ?? sesion.refresh,
  };
  const instante = new Date(ahora()).toISOString();
  await db.transaction('rw', db.meta, async () => {
    await db.meta.put({ clave: CLAVE_SESION, valor: nueva, actualizado: instante });
    await db.meta.put({
      clave: CLAVE_VINCULO,
      valor: { org_id: orgId, finca_id: finca.id, vinculado: instante },
      actualizado: instante,
    });
    await db.meta.delete(CLAVE_ORG_PENDIENTE);
  });
  return { sesion: nueva, encoladas: await encolarTodo(db, ahora) };
}

/**
 * Baja a este teléfono la finca de una organización de la cuenta (HU-E5.3, CA4): renueva la sesión
 * hacia ella y guarda el vínculo; la sincronización baja todo con el pull. Solo en un teléfono sin
 * finca: nunca mezcla dos fincas en un teléfono.
 */
export async function bajarFinca(
  db: CuadernoDb,
  core: string,
  orgId: string,
  opciones: { fetchFn?: typeof fetch; ahora?: () => number } = {},
): Promise<Sesion> {
  const { fetchFn = fetch, ahora = () => Date.now() } = opciones;
  const sesion = await leerSesion(db);
  if (!sesion) throw new ErrorDeSesion('Entra con tu cuenta para bajar la finca.');
  if ((await db.finca.toCollection().first()) || (await leerVinculo(db))) {
    throw new ErrorDeSesion(
      'Este teléfono ya tiene una finca: no se mezclan dos fincas en un teléfono.',
    );
  }
  const renovada = await pedir(fetchFn, `${core}/api/core/auth/refrescar`, {
    refresh: sesion.refresh,
    org_id: orgId,
  });
  if (renovada.estado !== 200 || renovada.datos['org_id'] !== orgId) {
    throw new ErrorDeSesion(
      String(renovada.datos['motivo'] ?? 'No se pudo abrir esa finca. Vuelve a intentarlo.'),
    );
  }
  const nueva = {
    ...(renovada.datos as unknown as Sesion),
    refresh: (renovada.datos['refresh'] as string | null) ?? sesion.refresh,
  };
  const instante = new Date(ahora()).toISOString();
  await db.transaction('rw', db.meta, async () => {
    await db.meta.put({ clave: CLAVE_SESION, valor: nueva, actualizado: instante });
    const vinculo: Vinculo = { org_id: orgId, finca_id: null, vinculado: instante };
    await db.meta.put({ clave: CLAVE_VINCULO, valor: vinculo, actualizado: instante });
  });
  return nueva;
}
