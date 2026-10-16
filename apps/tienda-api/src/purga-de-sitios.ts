/**
 * Bitácora tienda3 28: lo que el sitio horneado deja en R2, purgado sin romper ninguna vitrina.
 *
 * Cada versión deja en el almacén su manifiesto y lo horneado (`sitios/<org>/<versión>/`). Los
 * archivos van por huella a `objetos/<hh>/<huella>`, y un objeto lo comparten todas las versiones y
 * todas las tiendas de la celda que tengan ese mismo archivo: borrar uno que todavía se usa rompe
 * una vitrina, y R2 no avisa.
 *
 * 1. Cada día, en la hora de cada tienda (`mantenerSitio`):
 *    - lee los manifiestos de sus versiones nuevas y anota, por huella, la versión más nueva que la
 *      usa, en su índice `sitios/<org>/vivos.json`;
 *    - con el índice al día, purga las versiones de más de 90 días que no son la vigente ni una de
 *      las 5 anteriores (TIENDA §351): borra su manifiesto y lo horneado, las marca `purgada` (ya no
 *      se puede volver a ellas) y saca del índice las huellas que solo usaban ellas.
 * 2. Cada semana (`barrerObjetos`), borra los objetos que no nombra el índice de ninguna tienda y
 *    que se subieron antes del índice más viejo, con margen. Si a una tienda con sitio le falta su
 *    índice, o lo tiene atrasado, no borra nada.
 *
 * Por qué el índice basta: lo que se purga es siempre lo más viejo (todo lo que queda debajo de la
 * quinta anterior y de los 90 días), salvo la vigente, que no se purga nunca. Una huella cuya versión
 * más nueva se purgó solo la usaban versiones purgadas, o la vigente si es más vieja (después de
 * «Volver a esta»): esa se vuelve a leer. Lo que se publica después del índice, o se sube, o viene
 * del manifiesto de la vigente, que ya está en el índice.
 *
 * `legal/` no se toca nunca (HU-T7.1 CA2), ni los respaldos ni las exportaciones.
 */
import type { BaseD1 } from '@ed1/d1';
import type { AlmacenDeRespaldos } from './respaldos.ts';

const HORA_MS = 60 * 60 * 1000;
/** TIENDA §351: se purgan las de más de 90 días que no sean la vigente ni una de las 5 anteriores. */
export const DIAS_DE_UNA_VERSION = 90;
export const VERSIONES_ANTERIORES = 5;
/**
 * Manifiestos que lee una corrida por tienda. El de una tienda de 2.000 productos pesa unos 260 KB
 * y leerlo es CPU del cron, que en el plan gratuito es poca: una tienda que publica más que esto al
 * día se pone al día en varios días, y mientras tanto no purga ni deja barrer.
 */
export const MANIFIESTOS_POR_CORRIDA = 20;
/** Versiones que purga una corrida: dos claves cada una, en un solo borrado de R2 (hasta 1.000). */
export const VERSIONES_POR_PURGA = 200;
/** Una publicación en curso que lleva más que esto ya se cortó: no va a subir nada más. */
const EN_CURSO_MS = HORA_MS;
/** Un objeto subido después del índice más viejo menos este margen no se barre. */
export const MARGEN_DEL_BARRIDO_MS = 6 * HORA_MS;
/** Un índice que no se puso al día en este plazo no deja barrer: su tienda tiene algo roto. */
export const INDICE_VIGENTE_MS = 2 * 24 * HORA_MS;
/** Páginas de 1.000 objetos que revisa un barrido. */
export const PAGINAS_POR_BARRIDO = 100;

export interface Indice {
  /** La versión más nueva cuyo manifiesto ya está leído. */
  hasta: number;
  /** Cuándo quedó al día; `null` si le faltan versiones por leer. */
  alDia: string | null;
  /** Por huella, la versión más nueva que la usa. */
  huellas: Record<string, number>;
}

export const claveDelIndice = (org: string) => `sitios/${org}/vivos.json`;
const claveDelManifiesto = (org: string, version: number) =>
  `sitios/${org}/${version}/manifiesto.json`;
const claveDeLoHorneado = (org: string, version: number) => `sitios/${org}/${version}/datos.json`;

const EN_CURSO = new Set(['en_cola', 'horneando', 'lista']);

async function huellasDe(almacen: AlmacenDeRespaldos, clave: string): Promise<string[] | null> {
  const objeto = await almacen.get(clave);
  if (!objeto) return null;
  const m = JSON.parse(await objeto.text()) as { archivos?: Record<string, { huella: string }> };
  return Object.values(m.archivos ?? {}).map((a) => a.huella);
}

async function leerIndice(almacen: AlmacenDeRespaldos, org: string): Promise<Indice | null> {
  const objeto = await almacen.get(claveDelIndice(org));
  if (!objeto) return null;
  try {
    const i = JSON.parse(await objeto.text()) as Indice;
    return typeof i.hasta === 'number' && i.huellas && typeof i.huellas === 'object' ? i : null;
  } catch {
    return null;
  }
}

interface FilaDeVersion {
  version: number;
  estado: string;
  pedida: string;
  vigente: number | null;
}

/**
 * Las versiones que se pueden purgar, de la más vieja a la más nueva: todas las que quedan debajo
 * de la quinta anterior a la vigente y de la primera de los últimos 90 días, menos la vigente.
 */
export function purgables(filas: readonly FilaDeVersion[], instante: number): number[] {
  const vigente = filas[0]?.vigente ?? null;
  const anteriores = filas.filter(
    (f) => (f.estado === 'publicada' || f.estado === 'reemplazada') && f.version !== vigente,
  );
  const quinta = anteriores.at(-VERSIONES_ANTERIORES);
  if (!quinta) return [];
  const corte = new Date(instante - DIAS_DE_UNA_VERSION * 24 * HORA_MS).toISOString();
  const reciente = filas.find((f) => f.pedida >= corte)?.version ?? Number.POSITIVE_INFINITY;
  const limite = Math.min(quinta.version, reciente);
  return filas
    .filter((f) => f.version < limite && f.version !== vigente)
    .map((f) => f.version)
    .slice(0, VERSIONES_POR_PURGA);
}

export interface Mantenimiento {
  leidas: number;
  purgadas: number;
  alDia: boolean;
}

/** El paso 1, para una tienda: ponerle al día el índice y, con él al día, purgar sus versiones. */
export async function mantenerSitio(
  db: BaseD1,
  org: string,
  almacen: AlmacenDeRespaldos,
  instante: number,
): Promise<Mantenimiento> {
  const { results: filas } = await db
    .prepare(
      `SELECT p.version, p.estado, p.pedida, t.version_publicada AS vigente
         FROM publicacion p JOIN tienda t ON t.org_id = p.org_id
        WHERE p.org_id = ? AND p.purgada IS NULL ORDER BY p.version`,
    )
    .bind(org)
    .all<FilaDeVersion>();
  if (filas.length === 0) return { leidas: 0, purgadas: 0, alDia: true };
  const hecho = new Date(instante).toISOString();
  const indice: Indice = (await leerIndice(almacen, org)) ?? { hasta: 0, alDia: null, huellas: {} };

  // Las versiones nuevas, en orden. La que se está horneando es siempre la más nueva: lo que suba
  // queda después del índice y el barrido no lo toca; mañana se lee.
  let leidas = 0;
  let alDia = true;
  for (const f of filas) {
    if (f.version <= indice.hasta) continue;
    if (EN_CURSO.has(f.estado) && Date.parse(f.pedida) > instante - EN_CURSO_MS) break;
    if (leidas === MANIFIESTOS_POR_CORRIDA) {
      alDia = false;
      break;
    }
    leidas++;
    for (const h of (await huellasDe(almacen, claveDelManifiesto(org, f.version))) ?? [])
      indice.huellas[h] = f.version;
    indice.hasta = f.version;
  }

  // Solo con el índice al día: si no, una huella que usa una versión sin leer saldría del índice.
  const purgar = alDia ? purgables(filas, instante) : [];
  if (purgar.length > 0) {
    // Primero R2 y después la base: si la base falla, mañana se vuelven a borrar (no cuesta).
    await almacen.delete(
      purgar.flatMap((v) => [claveDelManifiesto(org, v), claveDeLoHorneado(org, v)]),
    );
    await db
      .prepare(
        'UPDATE publicacion SET purgada = ? WHERE org_id = ? AND version IN (SELECT value FROM json_each(?))',
      )
      .bind(hecho, org, JSON.stringify(purgar))
      .run();
    const purgadas = new Set(purgar);
    for (const [h, v] of Object.entries(indice.huellas))
      if (purgadas.has(v)) delete indice.huellas[h];
    // La vigente, si es más vieja que lo purgado, sigue usando lo suyo.
    const vigente = filas[0]?.vigente ?? null;
    if (vigente !== null && vigente < (purgar.at(-1) ?? 0))
      for (const h of (await huellasDe(almacen, claveDelManifiesto(org, vigente))) ?? [])
        indice.huellas[h] ??= vigente;
  }
  indice.alDia = alDia ? hecho : null;
  await almacen.put(claveDelIndice(org), JSON.stringify(indice), {
    httpMetadata: { contentType: 'application/json' },
  });
  return { leidas, purgadas: purgar.length, alDia };
}

export type Barrido =
  | { estado: 'barrido'; revisados: number; borrados: number; incompleto: boolean }
  | { estado: 'sin-barrer'; motivo: string };

/** El paso 2, para toda la celda: los objetos que ya no nombra ninguna tienda. */
export async function barrerObjetos(
  almacen: AlmacenDeRespaldos,
  instante: number,
): Promise<Barrido> {
  // Las tiendas con sitio son las carpetas de `sitios/`, no las filas de la base: una tienda sin
  // fila pero con sitio también cuenta.
  const tiendas: string[] = [];
  let cursor: string | undefined;
  do {
    const pagina = await almacen.list({
      prefix: 'sitios/',
      delimiter: '/',
      ...(cursor ? { cursor } : {}),
    });
    for (const p of pagina.delimitedPrefixes ?? []) tiendas.push(p.slice('sitios/'.length, -1));
    cursor = pagina.truncated ? pagina.cursor : undefined;
  } while (cursor);
  if (tiendas.length === 0) return { estado: 'sin-barrer', motivo: 'no hay sitios publicados' };

  const vivas = new Set<string>();
  let masViejo = instante;
  for (const org of tiendas) {
    const indice = await leerIndice(almacen, org);
    if (!indice) return { estado: 'sin-barrer', motivo: `a la tienda ${org} le falta su índice` };
    const alDia = indice.alDia ? Date.parse(indice.alDia) : Number.NaN;
    if (!(alDia > instante - INDICE_VIGENTE_MS))
      return { estado: 'sin-barrer', motivo: `el índice de la tienda ${org} está atrasado` };
    masViejo = Math.min(masViejo, alDia);
    for (const h of Object.keys(indice.huellas)) vivas.add(h);
  }
  const corte = masViejo - MARGEN_DEL_BARRIDO_MS;

  let revisados = 0;
  let borrados = 0;
  let paginas = 0;
  cursor = undefined;
  do {
    const pagina = await almacen.list({ prefix: 'objetos/', ...(cursor ? { cursor } : {}) });
    paginas++;
    const sinUso = pagina.objects
      .filter((o) => {
        const subido = o.uploaded?.getTime();
        // Sin fecha de subida no se sabe si es de una publicación en curso: se queda.
        return subido !== undefined && subido < corte && !vivas.has(o.key.split('/')[2] ?? '');
      })
      .map((o) => o.key);
    revisados += pagina.objects.length;
    if (sinUso.length > 0) await almacen.delete(sinUso);
    borrados += sinUso.length;
    cursor = pagina.truncated ? pagina.cursor : undefined;
  } while (cursor && paginas < PAGINAS_POR_BARRIDO);
  return { estado: 'barrido', revisados, borrados, incompleto: cursor !== undefined };
}
