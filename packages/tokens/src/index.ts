/**
 * Tokens del CORE (ADR-10, ARQUITECTURA §5.4, HU-E4.2).
 *
 * - **Access token:** JWT firmado con Ed25519, 12 h, con `sub`, `org`, `rol`, `celda`, `shard` y
 *   `anillo`. Las celdas lo verifican con la clave **pública**, sin llamar al CORE (CA5).
 * - **Refresh token y código de entrada:** secretos opacos al azar. En D1 solo se guarda su hash
 *   SHA-256: quien lea la base no puede usarlos.
 *
 * Dos formatos conviven mientras dura la transición de PLATAFORMA §4.6 (P10): v1 (`agro-core`,
 * sin producto) y v2 (`ed1-core`, con `aud`, `plan` y `ver: 2`). Fase N (HU-C4.1): las celdas
 * aceptan los dos y el CORE sigue emitiendo v1. En N+1 (HU-C4.3) emite v2; en N+2 se contrae.
 *
 * La clave privada solo existe como secreto del Worker (`CORE_JWT_PRIVATE_KEY`, PKCS#8 en
 * base64). La genera el despliegue la primera vez y nunca la escribe en disco ni en el
 * repositorio. Solo WebCrypto: corre igual en el Worker, en Node y en las pruebas.
 */

export const DURACION_ACCESO_MS = 12 * 60 * 60 * 1000;
export const EMISOR = 'agro-core';
export const EMISOR_V2 = 'ed1-core';
const EMISORES = [EMISOR, EMISOR_V2] as const;
/** Un token sin `aud` (v1) solo puede ser del agro: es el único producto que existía al emitirlo. */
export const PRODUCTO_SIN_AUD = 'agro';
/** Sin `plan` en el token, el mínimo: dicho aquí y no adivinado en cada celda. */
export const PLAN_SIN_RECLAMO = 'gratuito';

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
  /** v2: el producto de la organización. Una celda solo acepta el suyo. */
  aud?: string;
  /** v2: el plan vigente, con vencimiento y gracia ya aplicados por el CORE. */
  plan?: string;
  plan_vence?: number | null;
  /** v2: instante (s) de la última entrada interactiva; lo que mueve dinero pide una reciente. */
  auth_time?: number;
  ver?: 2;
}

/** Lo que una celda usa, ya con los valores de v1 resueltos: el producto y el plan nunca faltan. */
export interface Acceso extends Reclamos {
  producto: string;
  plan: string;
}

export type DatosDeAcceso = Omit<Reclamos, 'iss' | 'iat' | 'exp' | 'ver'>;

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

/**
 * Firma un token de acceso. El CORE emite v1 hasta HU-C4.3; v2 exige `aud`, porque un token v2
 * sin producto es justo lo que la transición quiere dejar de tener.
 */
export async function firmarAcceso(
  firmante: Firmante,
  datos: DatosDeAcceso,
  ahoraMs: number,
  version: 1 | 2 = 1,
): Promise<{ token: string; vence: number }> {
  const iat = Math.floor(ahoraMs / 1000);
  const exp = iat + DURACION_ACCESO_MS / 1000;
  if (version === 2 && !datos.aud) throw new Error('Un token v2 nombra su producto (aud)');
  const reclamos: Reclamos =
    version === 2
      ? { iss: EMISOR_V2, iat, exp, ...datos, ver: 2 }
      : { iss: EMISOR, iat, exp, ...datos };
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
  if (!(EMISORES as readonly string[]).includes(reclamos.iss)) {
    throw new TokenInvalido(`Emisor desconocido: ${reclamos.iss}`);
  }
  // v2 se reconoce sin adivinar: su emisor, su versión y su producto van juntos.
  if (reclamos.iss === EMISOR_V2 && (reclamos.ver !== 2 || !reclamos.aud)) {
    throw new TokenInvalido('Un token de ed1-core trae ver 2 y su producto');
  }
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

/**
 * Lo que decide una celda de `producto` (fase N): un token v2 vale solo con su `aud`; uno sin
 * `aud` (v1) vale solo en el agro. Devuelve el producto y el plan resueltos.
 */
export function aceptarEnProducto(reclamos: Reclamos, producto: string): Acceso {
  const delToken = reclamos.aud ?? PRODUCTO_SIN_AUD;
  if (delToken !== producto) {
    throw new TokenInvalido(
      reclamos.aud
        ? `El token es de ${reclamos.aud} y esta celda es de ${producto}`
        : `Un token sin producto solo vale en ${PRODUCTO_SIN_AUD}, no en ${producto}`,
    );
  }
  return { ...reclamos, producto: delToken, plan: reclamos.plan ?? PLAN_SIN_RECLAMO };
}

// ── Tokens de agentes (OAuth 2.1, PLATAFORMA §5.4, HU-C9.5) ──────────────────────────────────

/**
 * Emisor propio de los tokens de agentes: ningún verificador de las apps (`verificarAcceso`, que
 * solo conoce `agro-core` y `ed1-core`) los acepta. Un token de agente sirve solo en su recurso.
 */
export const EMISOR_AGENTES = 'ed1-core-agentes';
export const DURACION_ACCESO_DE_AGENTE_MS = 60 * 60 * 1000;

export interface ReclamosDeAgente {
  iss: typeof EMISOR_AGENTES;
  sub: string;
  /** El recurso (RFC 8707): el servidor MCP o la API que lo acepta. */
  aud: string;
  /** El cliente que pidió el acceso (`azp`). */
  azp: string;
  /** La concesión: revocarla corta este token en su recurso (HU-C9.6). */
  cnc: string;
  org: string;
  /** Los alcances, separados por espacio (RFC 8693 §4.2). */
  scope: string;
  iat: number;
  exp: number;
}

export async function firmarAccesoDeAgente(
  firmante: Firmante,
  datos: Omit<ReclamosDeAgente, 'iss' | 'iat' | 'exp'>,
  ahoraMs: number,
): Promise<{ token: string; vence: number }> {
  const iat = Math.floor(ahoraMs / 1000);
  const exp = iat + DURACION_ACCESO_DE_AGENTE_MS / 1000;
  const reclamos: ReclamosDeAgente = { iss: EMISOR_AGENTES, iat, exp, ...datos };
  const cuerpo = `${parte({ alg: 'EdDSA', typ: 'at+jwt', kid: firmante.publica.kid })}.${parte(reclamos)}`;
  const firma = new Uint8Array(
    await crypto.subtle.sign({ name: 'Ed25519' }, firmante.privada, texto.encode(cuerpo)),
  );
  return { token: `${cuerpo}.${base64url(firma)}`, vence: exp * 1000 };
}

/**
 * Lo que hace un recurso con un token de agente: la clave que nombra (`kid`), la firma, el emisor
 * de agentes, que el `aud` sea **este** recurso (CA3 de HU-C9.7) y el vencimiento.
 */
export async function verificarAccesoDeAgente(
  claves: readonly ClavePublica[],
  token: string,
  recurso: string,
  ahoraMs: number,
): Promise<ReclamosDeAgente> {
  const [cabecera, cuerpo, firma] = token.split('.');
  if (!cabecera || !cuerpo || !firma) throw new TokenInvalido('El token no tiene tres partes');
  let kid: string | undefined;
  try {
    const c = JSON.parse(new TextDecoder().decode(desdeBase64url(cabecera))) as {
      kid?: string;
      alg?: string;
    };
    if (c.alg !== 'EdDSA') throw new TokenInvalido(`Algoritmo no aceptado: ${c.alg}`);
    kid = c.kid;
  } catch (e) {
    if (e instanceof TokenInvalido) throw e;
    throw new TokenInvalido('El token no se puede leer');
  }
  const publica = claves.find((c) => c.kid === kid);
  if (!publica) throw new TokenInvalido(`Clave desconocida: ${String(kid)}`);
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
  const r = JSON.parse(new TextDecoder().decode(desdeBase64url(cuerpo))) as ReclamosDeAgente;
  if (r.iss !== EMISOR_AGENTES) throw new TokenInvalido('No es un token de agente');
  if (r.aud !== recurso) throw new TokenInvalido('El token es para otro recurso');
  if (r.exp * 1000 <= ahoraMs) throw new TokenInvalido('El token venció');
  return r;
}
