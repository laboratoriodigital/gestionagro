/**
 * La llave de la caja y su certificado (HU-Q8.1, PARQUEADERO §11.4) y la firma de sus recibos
 * (HU-Q8.2).
 *
 * - **La llave** se genera en el navegador con WebCrypto, **no exportable**: IndexedDB guarda la
 *   `CryptoKey`, pero sus bytes no salen de ella, ni en el respaldo. La pública sí se lee.
 * - **El certificado** lo pide la vuelta de la nube (`nube.ts`) cuando falta, cuando cambió la llave
 *   o en su última semana. La celda pone la serie y el parqueadero; vence a los 30 días.
 * - **Firmar** no espera la red: con certificado, aun vencido, el enlace sale firmado (la página lo
 *   dice en ámbar). Solo se firman recibos con la serie del certificado: una caja responde por sus
 *   números, no por los que bajó de otra.
 * - **CA3:** si el navegador no firma con Ed25519, la caja emite sin firma y lo dice en «Cuenta y
 *   nube». **Nunca** cambia a una llave exportable: la única llave que se genera es la no
 *   exportable, y una prueba lo exige.
 */
import { base64url } from '@ed1/firma';
import { conFirma, mensajeAFirmar, serieDe } from '@ed1/parqueadero-recibos';
import type { BaseDeLaCaja, Meta } from './datos.ts';
import { conTerminos } from './terminos.ts';

const DIA_MS = 24 * 60 * 60 * 1000;
/** Se renueva en la última semana, como la celda (`certificados.ts`). */
export const RENOVAR_ANTES_MS = 7 * DIA_MS;

type Lista = Extract<Meta, { clave: 'firma'; estado: 'lista' }>;
type Sutil = Pick<SubtleCrypto, 'generateKey' | 'exportKey' | 'sign'>;

/**
 * La llave de la caja: la que tiene, o una nueva no exportable. `sin-ed25519` si el navegador no
 * la genera; se vuelve a probar en cada vuelta, por si el navegador se actualizó.
 */
export async function asegurarLlave(
  db: Pick<BaseDeLaCaja, 'meta'>,
  ahora: () => number,
  sutil: Sutil = crypto.subtle,
): Promise<Extract<Meta, { clave: 'firma' }>> {
  const actual = await db.meta.get('firma');
  if (actual?.clave === 'firma' && actual.estado === 'lista') return actual;
  let nueva: Extract<Meta, { clave: 'firma' }>;
  try {
    const par = (await sutil.generateKey({ name: 'Ed25519' }, false, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
    if (par.privateKey.extractable) throw new Error('la llave privada salió exportable');
    nueva = {
      clave: 'firma',
      estado: 'lista',
      privada: par.privateKey,
      llave: base64url(new Uint8Array(await sutil.exportKey('raw', par.publicKey))),
      certificado: null,
      hasta: null,
      serie: null,
    };
  } catch (e) {
    console.warn('caja: este navegador no firma con Ed25519; los recibos salen sin firma', e);
    nueva = { clave: 'firma', estado: 'sin-ed25519', probado: ahora() };
  }
  await db.meta.put(nueva);
  return nueva;
}

export type EstadoDeLaFirma =
  | { readonly es: 'sin-llave' }
  | { readonly es: 'sin-ed25519' }
  /** Hay llave; el certificado llega con la próxima vuelta de la nube. */
  | { readonly es: 'sin-certificado' }
  | { readonly es: 'vigente'; readonly hasta: number; readonly serie: string }
  /** Firma, pero la página lo dirá en ámbar hasta que se renueve. */
  | { readonly es: 'vencido'; readonly hasta: number; readonly serie: string };

export async function estadoDeLaFirma(
  db: Pick<BaseDeLaCaja, 'meta'>,
  ahora: number,
): Promise<EstadoDeLaFirma> {
  const f = await db.meta.get('firma');
  if (f?.clave !== 'firma') return { es: 'sin-llave' };
  if (f.estado === 'sin-ed25519') return { es: 'sin-ed25519' };
  if (!f.certificado || f.hasta === null || f.serie === null) return { es: 'sin-certificado' };
  return { es: f.hasta < ahora ? 'vencido' : 'vigente', hasta: f.hasta, serie: f.serie };
}

const pideCertificado = (f: Lista, ahora: number) =>
  !f.certificado || f.hasta === null || f.hasta - ahora <= RENOVAR_ANTES_MS;

/**
 * Pide el certificado a la celda si hace falta (CA1). `true` si quedó uno nuevo. No lanza por una
 * respuesta de la celda: sin certificado la caja sigue emitiendo, sin firma; lanza sin señal, y la
 * vuelta de la nube lo deja para la siguiente.
 */
export async function certificar(
  db: Pick<BaseDeLaCaja, 'meta'>,
  destino: { readonly api: string; readonly acceso: string; readonly dispositivo: string },
  o: { readonly ahora: () => number; readonly fetchFn?: typeof fetch },
): Promise<boolean> {
  const f = await asegurarLlave(db, o.ahora);
  if (f.estado !== 'lista' || !pideCertificado(f, o.ahora())) return false;
  const r = await (o.fetchFn ?? fetch)(
    conTerminos(`${destino.api}/api/v1/dispositivos/certificado`),
    {
      method: 'POST',
      headers: { authorization: `Bearer ${destino.acceso}`, 'content-type': 'application/json' },
      body: JSON.stringify({ dispositivo: destino.dispositivo, llave: f.llave }),
    },
  );
  if (!r.ok) return false;
  const c = (await r.json().catch(() => ({}))) as {
    certificado?: unknown;
    hasta?: unknown;
    serie?: unknown;
  };
  if (
    typeof c.certificado !== 'string' ||
    typeof c.hasta !== 'number' ||
    typeof c.serie !== 'string'
  ) {
    return false;
  }
  // La llave pudo cambiar mientras tanto (otra pestaña): se guarda solo sobre la misma.
  const ahora = await db.meta.get('firma');
  if (ahora?.clave !== 'firma' || ahora.estado !== 'lista' || ahora.llave !== f.llave) return false;
  await db.meta.put({ ...ahora, certificado: c.certificado, hasta: c.hasta, serie: c.serie });
  return true;
}

/**
 * El enlace completo con la firma de esta caja, o como vino si no se puede firmar (HU-Q8.2 CA1):
 * sin llave, sin certificado, con el certificado de otra serie o si la firma falla.
 */
export async function firmarEnlace(
  db: Pick<BaseDeLaCaja, 'meta'>,
  enlace: string,
  numero: string,
): Promise<string> {
  const f = await db.meta.get('firma');
  if (f?.clave !== 'firma' || f.estado !== 'lista' || !f.certificado) return enlace;
  if (f.serie !== serieDe(numero)) return enlace;
  try {
    const firma = new Uint8Array(
      await crypto.subtle.sign({ name: 'Ed25519' }, f.privada, mensajeAFirmar(enlace)),
    );
    return conFirma(enlace, firma, f.certificado);
  } catch (e) {
    console.warn('caja: el recibo sale sin firma', e);
    return enlace;
  }
}
