/**
 * Tokens del CORE (ADR-10, ARQUITECTURA §5.4, HU-E4.2).
 *
 * - **Access token:** JWT firmado con Ed25519, 12 h, con `sub`, `org`, `rol`, `celda`, `shard` y
 *   `anillo`. Las celdas lo verifican con la clave **pública**, sin llamar al CORE (CA5).
 * - **Refresh token y código de entrada:** secretos opacos al azar. En D1 solo se guarda su hash
 *   SHA-256: quien lea la base no puede usarlos.
 *
 * La clave privada solo existe como secreto del Worker (`CORE_JWT_PRIVATE_KEY`, PKCS#8 en
 * base64). La genera el despliegue la primera vez y nunca la escribe en disco ni en el
 * repositorio. Solo WebCrypto: corre igual en el Worker, en Node y en las pruebas.
 */

export const DURACION_ACCESO_MS = 12 * 60 * 60 * 1000;
export const EMISOR = 'agro-core';

export interface ClavePublica {
  kty: 'OKP';
  crv: 'Ed25519';
  x: string;
  kid: string;
  alg: 'EdDSA';
  use: 'sig';
}

export interface Firmante {
  privada: CryptoKey;
  publica: ClavePublica;
}

export interface Reclamos {
  iss: string;
  sub: string;
  iat: number;
  exp: number;
  /** Organización del token; null si el usuario aún no tiene ninguna (crea la suya en HU-E4.3). */
  org: string | null;
  rol: string | null;
  celda: string | null;
  shard: string | null;
  anillo: number | null;
}

const texto = new TextEncoder();

export function base64url(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function desdeBase64url(valor: string): Uint8Array<ArrayBuffer> {
  const b64 = valor.replaceAll('-', '+').replaceAll('_', '/');
  const binario = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

const desdeBase64 = (valor: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(valor.trim()), (c) => c.charCodeAt(0));

/** Secreto opaco de 256 bits (refresh token, código de entrada, `state` de OAuth). */
export function secretoAlAzar(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashDe(secreto: string): Promise<string> {
  const digesto = new Uint8Array(await crypto.subtle.digest('SHA-256', texto.encode(secreto)));
  return Array.from(digesto, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function publicaDe(privada: CryptoKey): Promise<ClavePublica> {
  const jwk = (await crypto.subtle.exportKey('jwk', privada)) as JsonWebKey;
  if (!jwk.x) throw new Error('La clave privada no trae su parte pública');
  const huella = new Uint8Array(await crypto.subtle.digest('SHA-256', texto.encode(jwk.x)));
  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: jwk.x,
    kid: base64url(huella).slice(0, 16),
    alg: 'EdDSA',
    use: 'sig',
  };
}

/** Firmante desde el secreto del Worker. Lanza si el secreto no es una clave Ed25519 PKCS#8. */
export async function firmanteDesde(pkcs8Base64: string): Promise<Firmante> {
  const privada = await crypto.subtle.importKey(
    'pkcs8',
    desdeBase64(pkcs8Base64),
    { name: 'Ed25519' },
    true,
    ['sign'],
  );
  return { privada, publica: await publicaDe(privada) };
}

/** Par nuevo (lo usa el despliegue cuando el Worker aún no tiene clave). */
export async function generarClavePrivada(): Promise<string> {
  const par = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', par.privateKey));
  let binario = '';
  for (const b of pkcs8) binario += String.fromCharCode(b);
  return btoa(binario);
}

const parte = (objeto: unknown) => base64url(texto.encode(JSON.stringify(objeto)));

export async function firmarAcceso(
  firmante: Firmante,
  datos: Omit<Reclamos, 'iss' | 'iat' | 'exp'>,
  ahoraMs: number,
): Promise<{ token: string; vence: number }> {
  const iat = Math.floor(ahoraMs / 1000);
  const exp = iat + DURACION_ACCESO_MS / 1000;
  const reclamos: Reclamos = { iss: EMISOR, iat, exp, ...datos };
  const cuerpo = `${parte({ alg: 'EdDSA', typ: 'JWT', kid: firmante.publica.kid })}.${parte(reclamos)}`;
  const firma = new Uint8Array(
    await crypto.subtle.sign({ name: 'Ed25519' }, firmante.privada, texto.encode(cuerpo)),
  );
  return { token: `${cuerpo}.${base64url(firma)}`, vence: exp * 1000 };
}

export class TokenInvalido extends Error {
  override name = 'TokenInvalido';
}

/** Verifica firma, emisor y vencimiento con la clave pública: lo que hará cada celda (CA5). */
export async function verificarAcceso(
  publica: ClavePublica,
  token: string,
  ahoraMs: number,
): Promise<Reclamos> {
  const [cabecera, cuerpo, firma] = token.split('.');
  if (!cabecera || !cuerpo || !firma) throw new TokenInvalido('El token no tiene tres partes');
  const clave = await crypto.subtle.importKey(
    'jwk',
    { kty: 'OKP', crv: 'Ed25519', x: publica.x },
    { name: 'Ed25519' },
    false,
    ['verify'],
  );
  const valida = await crypto.subtle.verify(
    { name: 'Ed25519' },
    clave,
    desdeBase64url(firma),
    texto.encode(`${cabecera}.${cuerpo}`),
  );
  if (!valida) throw new TokenInvalido('La firma no corresponde');
  const reclamos = JSON.parse(new TextDecoder().decode(desdeBase64url(cuerpo))) as Reclamos;
  if (reclamos.iss !== EMISOR) throw new TokenInvalido(`Emisor desconocido: ${reclamos.iss}`);
  if (reclamos.exp * 1000 <= ahoraMs) throw new TokenInvalido('El token venció');
  return reclamos;
}

/**
 * Verifica con la clave que nombra el token (`kid`), entre las que publica el CORE: la vigente y
 * la anterior mientras dure una rotación (ARQUITECTURA §7.5). Una clave desconocida no se prueba
 * contra las demás: se rechaza diciendo cuál.
 */
export async function verificarConClaves(
  claves: readonly ClavePublica[],
  token: string,
  ahoraMs: number,
): Promise<Reclamos> {
  let kid: string | undefined;
  try {
    const cabecera = JSON.parse(
      new TextDecoder().decode(desdeBase64url(token.split('.')[0] ?? '')),
    ) as { kid?: string; alg?: string };
    if (cabecera.alg !== 'EdDSA') throw new TokenInvalido(`Algoritmo no aceptado: ${cabecera.alg}`);
    kid = cabecera.kid;
  } catch (e) {
    if (e instanceof TokenInvalido) throw e;
    throw new TokenInvalido('El token no se puede leer');
  }
  const clave = claves.find((c) => c.kid === kid);
  if (!clave) throw new TokenInvalido(`Clave desconocida: ${String(kid)}`);
  return verificarAcceso(clave, token, ahoraMs);
}
