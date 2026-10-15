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
} from '@ed1/cifrado';
import type { BaseD1 } from '@ed1/d1';

/** El id de la KEK vigente: el sufijo de su secreto (`TIENDA_KEK_V1`). */
export const KEK_VIGENTE = 'v1';

/** La KEK del secreto del Worker (32 bytes en base64); `null` si falta o no se puede leer. */
export async function kekDelEntorno(texto: string | undefined): Promise<Kek | null> {
  if (!texto) return null;
  try {
    const bytes = Uint8Array.from(atob(texto.trim()), (c) => c.charCodeAt(0));
    return await importarKek(KEK_VIGENTE, bytes);
  } catch {
    return null;
  }
}

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
  return abrirDek(aEnvuelta(org, proposito, vigente), new Map([[kek.id, kek]]));
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
