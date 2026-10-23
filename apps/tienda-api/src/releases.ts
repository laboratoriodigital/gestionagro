/**
 * HU-T4.6: una release nueva de la vitrina nunca tumba todas las tiendas a la vez (TIENDA §10.6, P10).
 *
 * - **Las releases viejas se siguen sirviendo (CA2 y CA3).** Los archivos comunes de una release
 *   (`/_t/<release>/`) salen de los assets del despacho, y cada despliegue los reemplaza por los de
 *   la nueva. Una página horneada con la anterior se quedaba sin estilos ni JavaScript hasta volver
 *   a hornearse. Por eso cada despliegue sube su release al almacén de la celda
 *   (`vitrina/<release>/…`, `guardarRelease`) y el despacho sirve desde ahí la que ya no tiene en
 *   sus assets. Se conserva 90 días y mientras alguna versión publicada la use (`RELEASES_VIEJAS`).
 * - **Por anillos (CA1).** Cada hora, `REHORNEAR_POR_RELEASE` vuelve a hornear lo publicado de unas
 *   pocas tiendas con la release de ahora (`rehornearExistencias`: lo publicado, no lo que el
 *   comercio todavía no publica). Primero el anillo 1, las piloto; el resto, cuando pasaron 24 horas
 *   desde que llegó la release y ninguna del anillo 1 falló. Una falla para la ronda y avisa.
 */
import type { BaseD1 } from '@ed1/d1';
import { enviarTelegram } from '@ed1/telegram';
import { rehornearExistencias } from './publicar.ts';
import type { AlmacenDeRespaldos } from './respaldos.ts';
import type { EntornoDeTareas, Tarea } from './tareas.ts';

export const CARPETA_DE_RELEASES = 'vitrina/';
/** Las tiendas que se re-hornean por shard en cada vuelta: el CPU de una corrida del cron es poco. */
export const TIENDAS_POR_VUELTA = 3;
export const HORAS_DEL_ANILLO_1 = 24;
export const DIAS_DE_UNA_RELEASE = 90;
const RELEASE = /^[0-9a-f]{12}$/;
const RUTA = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.[a-z0-9]+$/i;
const HORA_MS = 3_600_000;

/** Lo que se sabe de una release en el almacén: cuándo llegó y qué tiendas fallaron con ella. */
export interface DatosDeLaRelease {
  release: string;
  subida: string;
  archivos: number;
  fallas: { org: string; motivo: string; instante: string }[];
}

const claveDeDatos = (release: string) => `${CARPETA_DE_RELEASES}${release}/release.json`;

const TIPOS: Record<string, string> = {
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  woff2: 'font/woff2',
  txt: 'text/plain; charset=utf-8',
  json: 'application/json',
};
export const tipoDelArchivo = (ruta: string) =>
  TIPOS[ruta.slice(ruta.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream';

/** El almacén de la celda, con lo que las releases necesitan: también los bytes. */
export interface AlmacenDeReleases extends AlmacenDeRespaldos {
  put(
    clave: string,
    valor: string | ArrayBuffer | Uint8Array,
    opciones?: unknown,
  ): Promise<unknown>;
}

export async function leerDatos(
  almacen: AlmacenDeRespaldos,
  release: string,
): Promise<DatosDeLaRelease | null> {
  const o = await almacen.get(claveDeDatos(release));
  if (!o) return null;
  try {
    return JSON.parse(await o.text()) as DatosDeLaRelease;
  } catch {
    return null;
  }
}

/**
 * CA2: los archivos de una release, en el almacén de la celda. La sube el despliegue; si ya
 * estaba, no se toca (una release no cambia nunca: su nombre es la huella de su contenido).
 */
export async function guardarRelease(
  almacen: AlmacenDeReleases,
  release: string,
  archivos: Record<string, string>,
  ahora: string,
): Promise<
  { estado: 'guardada' | 'ya-estaba'; archivos: number } | { estado: 'problemas'; motivo: string }
> {
  if (!RELEASE.test(release)) return { estado: 'problemas', motivo: 'la release no es una huella' };
  const rutas = Object.keys(archivos);
  if (
    rutas.length === 0 ||
    rutas.length > 200 ||
    !rutas.every((r) => RUTA.test(r) && !r.includes('..'))
  )
    return { estado: 'problemas', motivo: 'los archivos de la release no son los de la vitrina' };
  const ya = await leerDatos(almacen, release);
  if (ya && ya.archivos === rutas.length) return { estado: 'ya-estaba', archivos: rutas.length };
  for (const [ruta, b64] of Object.entries(archivos)) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    await almacen.put(`${CARPETA_DE_RELEASES}${release}/${ruta}`, bytes, {
      httpMetadata: {
        contentType: tipoDelArchivo(ruta),
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
  }
  const datos: DatosDeLaRelease = {
    release,
    subida: ya?.subida ?? ahora,
    archivos: rutas.length,
    fallas: ya?.fallas ?? [],
  };
  await almacen.put(claveDeDatos(release), JSON.stringify(datos), {
    httpMetadata: { contentType: 'application/json' },
  });
  return { estado: 'guardada', archivos: rutas.length };
}

/**
 * Las tiendas de un shard cuya versión publicada se horneó con otra release, del anillo 1 primero.
 * Recorre las tiendas del shard (pocas por celda) y su versión publicada por la llave primaria. Una
 * tienda dada de baja no se vuelve a hornear (HU-T18.13).
 */
async function pendientes(db: BaseD1, release: string) {
  const { results } = await db
    .prepare(
      `SELECT t.org_id, t.anillo FROM tienda t
         JOIN publicacion p ON p.org_id = t.org_id AND p.version = t.version_publicada
        WHERE p.release IS NOT ? AND t.estado <> 'baja' ORDER BY t.anillo, t.org_id LIMIT 50`,
    )
    .bind(release)
    .all<{ org_id: string; anillo: number }>();
  return results;
}

/** CA1: la vuelta de cada hora. */
export const REHORNEAR_POR_RELEASE: Tarea = {
  nombre: 'rehornear-por-release',
  frecuencia: 'hora',
  async correr(e: EntornoDeTareas, instante: number) {
    const release = e.release;
    if (!release) throw new Error('el cron no sabe la release de la vitrina (VITRINA_RELEASE)');
    if (!e.almacen) throw new Error('el cron no tiene el almacén de la celda (SITIOS)');
    const almacen = e.almacen as AlmacenDeReleases;
    const ahora = new Date(instante).toISOString();
    // El reloj del anillo 1 empieza cuando la release llega: con el despliegue, o aquí si no subió.
    let datos = await leerDatos(almacen, release);
    if (!datos) {
      datos = { release, subida: ahora, archivos: 0, fallas: [] };
      await almacen.put(claveDeDatos(release), JSON.stringify(datos), {
        httpMetadata: { contentType: 'application/json' },
      });
    }
    const abierta =
      datos.fallas.length === 0 &&
      instante - Date.parse(datos.subida) >= HORAS_DEL_ANILLO_1 * HORA_MS;
    let hechas = 0;
    let esperan = 0;
    const fallas: DatosDeLaRelease['fallas'] = [];
    for (const [nombre, db] of e.shards) {
      let enEsteShard = 0;
      for (const t of await pendientes(db, release)) {
        if (t.anillo > 1 && !abierta) {
          esperan++;
          continue;
        }
        if (enEsteShard >= TIENDAS_POR_VUELTA) break;
        if (
          datos.fallas.length > 0 &&
          t.anillo === 1 &&
          datos.fallas.some((f) => f.org === t.org_id)
        )
          continue;
        enEsteShard++;
        const r = await rehornearExistencias({
          shard: db,
          shardNombre: nombre,
          control: e.control,
          sitios: almacen,
          hosts: e.hosts,
          celda: e.celda,
          release,
          ...(e.medios ? { medios: e.medios } : {}),
          org: t.org_id,
          pedidaPor: 'sistema:release',
          ahora,
        });
        if (r.estado === 'publicada' || r.estado === 'nada-cambio' || r.estado === 'sin-publicar')
          hechas++;
        else if (r.estado === 'fallida' || r.estado === 'compuerta')
          fallas.push({
            org: t.org_id,
            motivo: r.estado === 'fallida' ? r.motivo : 'la compuerta no la dejó',
            instante: ahora,
          });
      }
    }
    if (fallas.length > 0) {
      await almacen.put(
        claveDeDatos(release),
        JSON.stringify({ ...datos, fallas: [...datos.fallas, ...fallas] }),
        { httpMetadata: { contentType: 'application/json' } },
      );
      const aviso = await enviarTelegram(
        e.telegram,
        `Tienda · la release ${release} de la vitrina falló en ${fallas.length} tienda(s); el resto espera:\n${fallas
          .slice(0, 5)
          .map((f) => `${f.org}: ${f.motivo}`)
          .join('\n')}`,
        e.fetch,
      );
      if (aviso) console.error(`tienda-api: no se pudo avisar por Telegram (${aviso})`);
      throw new Error(`la release ${release} falló en ${fallas.length} tienda(s)`);
    }
    return `${hechas} tiendas con la release ${release}${esperan > 0 ? `; ${esperan} esperan las 24 h del anillo 1` : ''}`;
  },
};

/** CA2: borra las releases de más de 90 días que ninguna versión publicada usa. */
export const RELEASES_VIEJAS: Tarea = {
  nombre: 'releases-viejas',
  frecuencia: 'semana',
  async correr(e, instante) {
    if (!e.almacen) throw new Error('el cron no tiene el almacén de la celda (SITIOS)');
    const almacen = e.almacen;
    const carpetas: string[] = [];
    let cursor: string | undefined;
    do {
      const p = await almacen.list({
        prefix: CARPETA_DE_RELEASES,
        delimiter: '/',
        ...(cursor ? { cursor } : {}),
      });
      carpetas.push(...(p.delimitedPrefixes ?? []));
      cursor = p.truncated ? p.cursor : undefined;
    } while (cursor);
    let borradas = 0;
    for (const carpeta of carpetas) {
      const release = carpeta.slice(CARPETA_DE_RELEASES.length).replace(/\/$/, '');
      if (!RELEASE.test(release) || release === e.release) continue;
      const datos = await leerDatos(almacen, release);
      if (!datos || instante - Date.parse(datos.subida) < DIAS_DE_UNA_RELEASE * 24 * HORA_MS)
        continue;
      let enUso = false;
      for (const [, db] of e.shards) {
        const n = await db
          .prepare(
            "SELECT count(*) AS n FROM publicacion WHERE release = ? AND estado = 'publicada'",
          )
          .bind(release)
          .first<{ n: number }>();
        if ((n?.n ?? 0) > 0) enUso = true;
      }
      if (enUso) continue;
      const claves: string[] = [];
      let c2: string | undefined;
      do {
        const p = await almacen.list({ prefix: carpeta, ...(c2 ? { cursor: c2 } : {}) });
        claves.push(...p.objects.map((o) => o.key));
        c2 = p.truncated ? p.cursor : undefined;
      } while (c2);
      if (claves.length > 0) await almacen.delete(claves);
      borradas++;
    }
    return `${borradas} releases viejas borradas de ${carpetas.length}`;
  },
};
