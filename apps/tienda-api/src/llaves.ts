/**
 * Las llaves de cada tienda (TIENDA-3.0 §14.2, HU-T1.3): una DEK por tienda y propósito, envuelta
 * con la KEK del Worker y guardada en la tabla `llave`. Nace la primera vez que la tienda la
 * necesita (HU-T6.4: la primera solicitud con un contacto), nunca antes.
 *
 * Dos solicitudes a la vez pueden intentar crearla: las dos escriben con `INSERT OR IGNORE` sobre
 * la misma versión, y las dos usan la que quedó en la base, que es la única que abre lo cifrado
 * después (P21: nada se escribe con una llave que no quedó guardada).
 */
import {
  type Aleatorio,
  abrirDek,
  crearDek,
  type Dek,
  type DekEnvuelta,
  importarKek,
  type Kek,
  type Proposito,
  reenvolverDek,
} from '@ed1/cifrado';
import type { BaseD1 } from '@ed1/d1';

/** El id de la primera KEK: el sufijo de su secreto (`TIENDA_KEK_V1`). */
export const KEK_VIGENTE = 'v1';

/**
 * Los secretos de las KEK (HU-T17.6, TIENDA §14.2): `TIENDA_KEK_V1`, `TIENDA_KEK_V2`… Rotar es
 * cargar la siguiente: la de número más alto envuelve lo nuevo, y las demás siguen abriendo lo que
 * envolvieron hasta que `reenvolverLlaves` las deja sin uso.
 */
export const PATRON_KEK = /^TIENDA_KEK_V([1-9][0-9]?)$/;

/** Una KEK cargada, con las demás del Worker para abrir lo que envolvió una anterior. */
export interface KekDeLaTienda extends Kek {
  todas: ReadonlyMap<string, Kek>;
}

/**
 * Las KEK del entorno del Worker, en el texto que viaja hasta las tareas: `v1:<base64>,v2:<base64>`.
 * `undefined` si no hay ninguna.
 */
export function textoDeLasKeks(env: Readonly<Record<string, unknown>>): string | undefined {
  const partes = Object.entries(env)
    .flatMap(([nombre, valor]) => {
      const m = PATRON_KEK.exec(nombre);
      return m && typeof valor === 'string' && valor.trim()
        ? [[Number(m[1]), valor.trim()] as const]
        : [];
    })
    .sort((a, b) => a[0] - b[0]);
  return partes.length > 0 ? partes.map(([n, v]) => `v${n}:${v}`).join(',') : undefined;
}

/**
 * La KEK vigente (la de número más alto) con todas las cargadas; `null` si falta o si alguna no se
 * puede leer (P1: una KEK rota no se ignora en silencio). Un texto sin `v<n>:` es la `v1` sola.
 */
export async function kekDelEntorno(texto: string | undefined): Promise<KekDeLaTienda | null> {
  if (!texto?.trim()) return null;
  try {
    const partes = texto.includes(':') ? texto.split(',') : [`${KEK_VIGENTE}:${texto}`];
    const todas = new Map<string, Kek>();
    let vigente: Kek | null = null;
    let mayor = 0;
    for (const parte of partes) {
      const [id = '', base64 = ''] = parte.split(':');
      const n = Number(/^v([1-9][0-9]?)$/.exec(id)?.[1]);
      if (!n) return null;
      const bytes = Uint8Array.from(atob(base64.trim()), (c) => c.charCodeAt(0));
      const kek = await importarKek(id, bytes);
      todas.set(id, kek);
      if (n > mayor) {
        mayor = n;
        vigente = kek;
      }
    }
    return vigente ? { ...vigente, todas } : null;
  } catch {
    return null;
  }
}

/** Las KEK con que se abre lo guardado: todas las del Worker si vienen, o la que se pasa. */
export const paraAbrir = (kek: Kek): ReadonlyMap<string, Kek> =>
  'todas' in kek ? (kek as KekDeLaTienda).todas : new Map([[kek.id, kek]]);

interface FilaDeLlave {
  version: number;
  envuelta: ArrayBuffer | Uint8Array | string;
  kek_id: string;
}

const comoTexto = (v: FilaDeLlave['envuelta']) =>
  typeof v === 'string'
    ? v
    : new TextDecoder().decode(v instanceof Uint8Array ? v : new Uint8Array(v));

const aEnvuelta = (org: string, proposito: Proposito, f: FilaDeLlave): DekEnvuelta => ({
  org,
  proposito,
  version: f.version,
  kekId: f.kek_id,
  envuelta: comoTexto(f.envuelta),
});

async function leer(db: BaseD1, org: string, proposito: Proposito): Promise<FilaDeLlave[]> {
  const { results } = await db
    .prepare(
      'SELECT version, envuelta, kek_id FROM llave WHERE org_id = ? AND proposito = ? ORDER BY version DESC',
    )
    .bind(org, proposito)
    .all<FilaDeLlave>();
  return results;
}

/** La DEK vigente de la tienda para un propósito: la crea y la guarda si todavía no existe. */
export async function dekVigente(
  db: BaseD1,
  org: string,
  proposito: Proposito,
  kek: Kek,
  ahora: string,
  aleatorio?: Aleatorio,
): Promise<Dek> {
  let filas = await leer(db, org, proposito);
  if (filas.length === 0) {
    const { envuelta } = await crearDek(org, proposito, 1, kek, aleatorio);
    await db
      .prepare(
        'INSERT OR IGNORE INTO llave (org_id, proposito, version, envuelta, kek_id, creada) VALUES (?, ?, 1, ?, ?, ?)',
      )
      .bind(org, proposito, new TextEncoder().encode(envuelta.envuelta), kek.id, ahora)
      .run();
    filas = await leer(db, org, proposito);
  }
  const vigente = filas[0];
  if (!vigente) throw new Error('la llave de la tienda no quedó guardada');
  return abrirDek(aEnvuelta(org, proposito, vigente), paraAbrir(kek));
}

/** Todas las DEK de la tienda para un propósito, por versión: lo cifrado con una vieja se sigue leyendo. */
export async function deksDeLaTienda(
  db: BaseD1,
  org: string,
  proposito: Proposito,
  keks: ReadonlyMap<string, Kek>,
): Promise<Map<number, Dek>> {
  const deks = new Map<number, Dek>();
  for (const f of await leer(db, org, proposito)) {
    deks.set(f.version, await abrirDek(aEnvuelta(org, proposito, f), keks));
  }
  return deks;
}

/**
 * HU-T17.6 CA1: cuántas DEK envuelve cada KEK en el shard. El despliegue lo pregunta antes de
 * retirar una KEK vieja: con una sola en uso, no se borra (CA2).
 */
export async function usoDeLasKeks(db: BaseD1): Promise<Record<string, number>> {
  const { results } = await db
    .prepare('SELECT kek_id, count(*) AS n FROM llave INDEXED BY llave_por_kek GROUP BY kek_id')
    .all<{ kek_id: string; n: number }>();
  return Object.fromEntries(results.map((f) => [f.kek_id, f.n]));
}

/** Las DEK que se reenvuelven en una vuelta: cada una abre y vuelve a sellar (poco CPU). */
export const REENVOLVER_POR_VUELTA = 40;

/**
 * HU-T17.6 CA1: la misma DEK, envuelta con la KEK vigente, para las que envuelve otra KEK cargada.
 * Los campos cifrados no se tocan. Cada cambio exige que la fila siga con la KEK que se leyó: dos
 * vueltas a la vez no se pisan. Con una sola KEK no lee nada.
 */
export async function reenvolverLlaves(
  db: BaseD1,
  kek: KekDeLaTienda,
  limite = REENVOLVER_POR_VUELTA,
  aleatorio?: Aleatorio,
): Promise<{ reenvueltas: number }> {
  const viejas = [...kek.todas.keys()].filter((id) => id !== kek.id);
  if (viejas.length === 0) return { reenvueltas: 0 };
  const { results } = await db
    .prepare(
      `SELECT org_id, proposito, version, envuelta, kek_id FROM llave INDEXED BY llave_por_kek
        WHERE kek_id IN (${viejas.map(() => '?').join(', ')}) LIMIT ?`,
    )
    .bind(...viejas, limite)
    .all<FilaDeLlave & { org_id: string; proposito: Proposito }>();
  if (results.length === 0) return { reenvueltas: 0 };
  const sentencias = [];
  for (const f of results) {
    const nueva = await reenvolverDek(
      aEnvuelta(f.org_id, f.proposito, f),
      kek.todas,
      kek,
      aleatorio,
    );
    sentencias.push(
      db
        .prepare(
          'UPDATE llave SET envuelta = ?, kek_id = ? WHERE org_id = ? AND proposito = ? AND version = ? AND kek_id = ?',
        )
        .bind(
          new TextEncoder().encode(nueva.envuelta),
          kek.id,
          f.org_id,
          f.proposito,
          f.version,
          f.kek_id,
        ),
    );
  }
  await db.batch(sentencias);
  return { reenvueltas: results.length };
}

/**
 * HU-T17.6 CA2: cuántas DEK del shard no abre la KEK vigente sola. Después de reenvolver tiene que
 * dar 0: es la prueba de que retirar las viejas no deja nada ilegible. Lee la tabla entera (tres
 * filas por tienda a lo sumo), y solo mientras hay más de una KEK cargada.
 */
export async function llavesQueNoAbre(db: BaseD1, kek: Kek): Promise<number> {
  const { results } = await db
    .prepare(
      'SELECT org_id, proposito, version, envuelta, kek_id FROM llave INDEXED BY llave_por_kek',
    )
    .all<FilaDeLlave & { org_id: string; proposito: Proposito }>();
  const sola = new Map([[kek.id, kek]]);
  let ilegibles = 0;
  for (const f of results) {
    try {
      await abrirDek(aEnvuelta(f.org_id, f.proposito, f), sola);
    } catch {
      ilegibles++;
    }
  }
  return ilegibles;
}
