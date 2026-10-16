/**
 * Las credenciales del comercio con su pasarela (TIENDA-3.0 §9.2, anexo A `credencial`): cada campo
 * cifrado con la DEK `credenciales` de la tienda, atado a su fila (`org|credencial|campo|bold-pruebas`),
 * para que un cifrado copiado a otra tienda, otro ambiente u otro campo no se abra. Solo la API las
 * descifra, en el momento de firmar un cobro (HU-T11.4); nunca salen en una respuesta ni en un log.
 *
 * Guardarlas desde el panel, con la cláusula de custodia y la entrada reciente, es HU-T11.2. Aquí
 * está lo que las dos historias comparten: cómo se cifran y cómo se leen.
 */
import { type Aleatorio, cifrarSobre, type Dek, descifrarSobre, type Kek } from '@ed1/cifrado';
import type { BaseD1, SentenciaD1 } from '@ed1/d1';
import type { LlavesBold } from '@ed1/pagos';
import { deksDeLaTienda, dekVigente } from './llaves.ts';

export type Ambiente = 'pruebas' | 'produccion';

const contexto = (org: string, proveedor: string, ambiente: Ambiente, campo: string) => ({
  org,
  tabla: 'credencial',
  campo,
  id: `${proveedor}-${ambiente}`,
});

const bytes = (v: ArrayBuffer | Uint8Array | number[]) =>
  v instanceof Uint8Array ? v : new Uint8Array(v as ArrayBuffer);

/** La sentencia que guarda un campo cifrado; la huella son sus últimos 4 caracteres. */
export async function guardarCredencial(
  db: BaseD1,
  dek: Dek,
  c: { org: string; proveedor: string; ambiente: Ambiente; campo: string; valor: string },
  ahora: string,
  aleatorio?: Aleatorio,
): Promise<SentenciaD1> {
  const s = await cifrarSobre(
    dek,
    contexto(c.org, c.proveedor, c.ambiente, c.campo),
    c.valor,
    aleatorio,
  );
  return db
    .prepare(
      `INSERT INTO credencial (org_id, proveedor, ambiente, campo, cifrado, iv, llave_version, huella, guardada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (org_id, proveedor, ambiente, campo) DO UPDATE SET cifrado = excluded.cifrado,
         iv = excluded.iv, llave_version = excluded.llave_version, huella = excluded.huella,
         guardada = excluded.guardada, verificada = NULL`,
    )
    .bind(
      c.org,
      c.proveedor,
      c.ambiente,
      c.campo,
      s.sobre,
      s.iv,
      s.version,
      c.valor.slice(-4),
      ahora,
    );
}

/** La DEK de credenciales vigente de la tienda (la crea la primera vez). */
export const dekDeCredenciales = (db: BaseD1, org: string, kek: Kek, ahora: string) =>
  dekVigente(db, org, 'credenciales', kek, ahora);

/**
 * Las llaves de Bold de la tienda para ese ambiente, descifradas; `null` si falta alguna de las dos
 * o no se pueden abrir (otra KEK, un cifrado movido de fila). Quien llama lo registra sin el valor.
 */
export async function llavesDeBold(
  db: BaseD1,
  org: string,
  ambiente: Ambiente,
  kek: Kek,
): Promise<LlavesBold | null> {
  const { results } = await db
    .prepare(
      `SELECT campo, cifrado, iv, llave_version FROM credencial
        WHERE org_id = ? AND proveedor = 'bold' AND ambiente = ? AND campo IN ('identidad', 'secreta')`,
    )
    .bind(org, ambiente)
    .all<{
      campo: string;
      cifrado: ArrayBuffer | Uint8Array;
      iv: ArrayBuffer | Uint8Array;
      llave_version: number;
    }>();
  if (results.length !== 2) return null;
  try {
    const deks = await deksDeLaTienda(db, org, 'credenciales', new Map([[kek.id, kek]]));
    const valor: Record<string, string> = {};
    for (const f of results) {
      valor[f.campo] = await descifrarSobre(deks, contexto(org, 'bold', ambiente, f.campo), {
        sobre: bytes(f.cifrado),
        iv: bytes(f.iv),
        version: f.llave_version,
      });
    }
    const { identidad, secreta } = valor;
    return identidad && secreta ? { identidad, secreta, ambiente } : null;
  } catch {
    return null;
  }
}
