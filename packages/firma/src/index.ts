/**
 * Firmas Ed25519 en el fragmento de un enlace (ADR-36, ADR-39). Salió de `@ed1/trazabilidad`
 * (HU-Q8.1): el agro firma sus QR con la llave de la celda (`datos.firma`) y el parqueadero firma
 * sus recibos sin red con la llave de cada caja, que la celda certifica
 * (`datos.firma.certificado`).
 *
 * - **base64url** sin relleno, el de los JWT y los fragmentos.
 * - **El certificado de un dispositivo** (PARQUEADERO §11.4): binario y de largo fijo salvo la
 *   serie, para que el enlace firmado quepa en un QR de pantalla. Lo firma la celda con su llave
 *   de recibos; dice qué llave pública tiene el dispositivo, de qué organización es, con qué serie
 *   numera y hasta cuándo vale.
 *
 *   | Bytes | Qué |
 *   |---|---|
 *   | 1 | versión del certificado (1) |
 *   | 12 | `kid` de la llave de la celda que firma (los 16 caracteres base64url de `@ed1/tokens`) |
 *   | 32 | llave pública Ed25519 del dispositivo |
 *   | 16 | organización (UUID) |
 *   | 4 | vence, en segundos Unix (sin signo, big-endian) |
 *   | 1–3 | serie del dispositivo (`A`, `B`, …, `AA`), en ASCII |
 *   | 64 | firma Ed25519 de la celda sobre todo lo anterior |
 *
 * - **La cadena:** la página verifica el certificado con las llaves públicas de las celdas que
 *   lleva dentro y después la firma del dispositivo con la llave del certificado. Ed25519 entra
 *   inyectado: la página usa una librería, que también corre en teléfonos sin Ed25519 en
 *   WebCrypto, y la celda y las pruebas, WebCrypto.
 *
 * Sin dependencias ni nombres de producto: lo usan el agro y el parqueadero.
 */

const texto = new TextEncoder();

export function base64url(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** Lanza si no es base64url. Acepta cualquier forma que decodifique; ver `esCanonico`. */
export function desdeBase64url(valor: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(valor)) throw new Error('no es base64url');
  const b64 = valor.replaceAll('-', '+').replaceAll('_', '/');
  const binario = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

/** Si es la única forma base64url de sus bytes: dos textos distintos nunca firman lo mismo. */
export function esCanonico(valor: string): boolean {
  if (!/^[A-Za-z0-9_-]+$/.test(valor) || valor.length % 4 === 1) return false;
  try {
    return base64url(desdeBase64url(valor)) === valor;
  } catch {
    return false;
  }
}

/** Ed25519: `true` si `firma` es de `mensaje` con `publica` (32 bytes). */
export type VerificarEd25519 = (
  publica: Uint8Array<ArrayBuffer>,
  mensaje: Uint8Array<ArrayBuffer>,
  firma: Uint8Array<ArrayBuffer>,
) => Promise<boolean>;

/** Ed25519 con la llave privada, que puede no ser exportable: devuelve los 64 bytes. */
export type FirmarEd25519 = (mensaje: Uint8Array<ArrayBuffer>) => Promise<Uint8Array>;

/** Una llave pública de celda tal como la página la lleva dentro. */
export interface LlavePublica {
  kid: string;
  /** La llave Ed25519 en base64url (JWK `x`). */
  x: string;
}

export interface Certificado {
  /** La llave de la celda que lo firmó. */
  kid: string;
  /** La llave pública del dispositivo, en base64url (32 bytes). */
  llave: string;
  /** La organización, un UUID. */
  org: string;
  serie: string;
  /** Hasta cuándo vale, en segundos Unix. */
  hasta: number;
}

export const VERSION_DEL_CERTIFICADO = 1;
const LARGO_KID = 12;
const LARGO_LLAVE = 32;
const LARGO_FIRMA = 64;
const FIJO = 1 + LARGO_KID + LARGO_LLAVE + 16 + 4;
const SERIE = /^[A-Z0-9]{1,3}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

function uuidDe(bytes: Uint8Array): string {
  const h = hex(bytes);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Los bytes que firma la celda. Lanza si algún campo no cabe en el formato. */
export function cuerpoDelCertificado(c: Certificado): Uint8Array<ArrayBuffer> {
  const kid = desdeBase64url(c.kid);
  const llave = desdeBase64url(c.llave);
  const org = c.org.toLowerCase();
  if (kid.length !== LARGO_KID) throw new Error('el kid de la celda no son 12 bytes');
  if (llave.length !== LARGO_LLAVE) throw new Error('la llave del dispositivo no son 32 bytes');
  if (!UUID.test(org)) throw new Error('la organización no es un UUID');
  if (!SERIE.test(c.serie)) throw new Error('la serie son de 1 a 3 letras o cifras en mayúscula');
  if (!Number.isInteger(c.hasta) || c.hasta < 0 || c.hasta > 0xffffffff) {
    throw new Error('el vencimiento no es un instante en segundos');
  }
  const cuerpo = new Uint8Array(FIJO + c.serie.length);
  cuerpo[0] = VERSION_DEL_CERTIFICADO;
  cuerpo.set(kid, 1);
  cuerpo.set(llave, 1 + LARGO_KID);
  cuerpo.set(
    Uint8Array.from(org.replaceAll('-', '').match(/../g) ?? [], (b) => Number.parseInt(b, 16)),
    1 + LARGO_KID + LARGO_LLAVE,
  );
  new DataView(cuerpo.buffer).setUint32(FIJO - 4, c.hasta);
  cuerpo.set(texto.encode(c.serie), FIJO);
  return cuerpo;
}

/** El certificado en base64url, firmado por la celda. */
export async function firmarCertificado(c: Certificado, firmar: FirmarEd25519): Promise<string> {
  const cuerpo = cuerpoDelCertificado(c);
  const firma = await firmar(cuerpo);
  if (firma.length !== LARGO_FIRMA) throw new Error('la firma Ed25519 no son 64 bytes');
  const todo = new Uint8Array(cuerpo.length + LARGO_FIRMA);
  todo.set(cuerpo);
  todo.set(firma, cuerpo.length);
  return base64url(todo);
}

export interface CertificadoLeido {
  certificado: Certificado;
  cuerpo: Uint8Array<ArrayBuffer>;
  firma: Uint8Array<ArrayBuffer>;
}

/** Lee un certificado sin verificarlo; `null` si no tiene la forma de la versión 1. */
export function leerCertificado(valor: string): CertificadoLeido | null {
  if (!esCanonico(valor)) return null;
  const todo = desdeBase64url(valor);
  const largoSerie = todo.length - FIJO - LARGO_FIRMA;
  if (todo[0] !== VERSION_DEL_CERTIFICADO || largoSerie < 1 || largoSerie > 3) return null;
  const cuerpo = todo.slice(0, todo.length - LARGO_FIRMA);
  const serie = new TextDecoder().decode(cuerpo.slice(FIJO));
  if (!SERIE.test(serie)) return null;
  return {
    certificado: {
      kid: base64url(cuerpo.slice(1, 1 + LARGO_KID)),
      llave: base64url(cuerpo.slice(1 + LARGO_KID, 1 + LARGO_KID + LARGO_LLAVE)),
      org: uuidDe(cuerpo.slice(1 + LARGO_KID + LARGO_LLAVE, FIJO - 4)),
      serie,
      hasta: new DataView(cuerpo.buffer).getUint32(FIJO - 4),
    },
    cuerpo,
    firma: todo.slice(todo.length - LARGO_FIRMA),
  };
}

export type Cadena =
  /** La celda certificó al dispositivo y el dispositivo firmó esto, con el certificado vigente. */
  | { estado: 'verificado'; certificado: Certificado }
  /** Todo coincide, pero se firmó después de que el certificado venció. */
  | { estado: 'vencido'; certificado: Certificado }
  /** El certificado es de una celda cuya llave esta página no lleva: no se puede decir nada. */
  | { estado: 'llave-desconocida'; certificado: Certificado }
  /** La firma, el certificado o lo firmado no coinciden: algo cambió. */
  | { estado: 'modificado' };

/**
 * Verifica la cadena celda → dispositivo → mensaje. `emitido` es el instante (s) que lo firmado
 * dice que es suyo: con el certificado vencido para ese instante, el estado es `vencido`. Nunca
 * lanza: lo que no se lee es `modificado`.
 */
export async function verificarCadena(entrada: {
  mensaje: Uint8Array<ArrayBuffer>;
  firma: string;
  certificado: string;
  llaves: readonly LlavePublica[];
  emitido: number;
  verificar: VerificarEd25519;
}): Promise<Cadena> {
  const leido = leerCertificado(entrada.certificado);
  if (!leido || !esCanonico(entrada.firma)) return { estado: 'modificado' };
  const { certificado } = leido;
  const celda = entrada.llaves.find((l) => l.kid === certificado.kid);
  if (!celda) return { estado: 'llave-desconocida', certificado };
  try {
    const firma = desdeBase64url(entrada.firma);
    if (firma.length !== LARGO_FIRMA) return { estado: 'modificado' };
    const valido =
      (await entrada.verificar(desdeBase64url(celda.x), leido.cuerpo, leido.firma)) &&
      (await entrada.verificar(desdeBase64url(certificado.llave), entrada.mensaje, firma));
    if (!valido) return { estado: 'modificado' };
  } catch {
    return { estado: 'modificado' };
  }
  return entrada.emitido > certificado.hasta
    ? { estado: 'vencido', certificado }
    : { estado: 'verificado', certificado };
}
