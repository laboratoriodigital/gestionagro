/**
 * Cifrado de sobre de la Tienda (TIENDA-3.0 §9.2 y §14.2, HU-T1.3).
 *
 * - **KEK** (llave maestra): 32 bytes, secreto del Worker (`TIENDA_KEK_V<n>`). Nunca en la base.
 * - **DEK**: una por tienda y propósito (`credenciales`, `datos_personales`, `indices`), envuelta
 *   con la KEK y con `org|proposito|version` como datos asociados (AAD). Borrar la de datos
 *   personales deja ilegibles los contactos de esa tienda: borrado criptográfico.
 * - **Campo**: AES-256-GCM, IV de 12 bytes al azar por escritura, AAD `org|tabla|campo|id`. Copiar
 *   un cifrado a otra fila o a otra tienda no se descifra.
 * - **Índice ciego**: HMAC-SHA256 con la DEK `indices`, truncado a 128 bits. Busca un celular sin
 *   guardarlo en claro.
 *
 * Solo WebCrypto (`crypto.subtle`), que es la misma API en el navegador, Node y workerd (P17). Los
 * errores no dicen nada del contenido (P13), y el azar se recibe como parámetro para probarlo (P8).
 */

export type Proposito = 'credenciales' | 'datos_personales' | 'indices';
export type Aleatorio = (bytes: number) => Uint8Array;

const aleatorioDelSistema: Aleatorio = (n) => crypto.getRandomValues(new Uint8Array(n));
const VERSION_FORMATO = 'v1';

/** Falló el descifrado. A propósito no dice por qué ni qué había: eso sería una pista (P13). */
export class DescifradoFallido extends Error {
  constructor() {
    super('No se pudo descifrar: la llave o los datos asociados no corresponden');
    this.name = 'DescifradoFallido';
  }
}

export interface Kek {
  id: string;
  llave: CryptoKey;
}

export interface Dek {
  org: string;
  proposito: Proposito;
  version: number;
  llave: CryptoKey;
}

/** Lo que se guarda en la tabla `llave`: la DEK cifrada con una KEK, nunca en claro. */
export interface DekEnvuelta {
  org: string;
  proposito: Proposito;
  version: number;
  kekId: string;
  envuelta: string;
}

export interface Contexto {
  org: string;
  tabla: string;
  campo: string;
  id: string;
}

// --- utilidades sin Buffer (no existe en workerd) ---------------------------------------------

function aBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(texto: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(texto)) throw new DescifradoFallido();
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const s = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

const codificador = new TextEncoder();

function aad(partes: readonly string[]): Uint8Array<ArrayBuffer> {
  for (const p of partes) {
    if (p.length === 0 || p.includes('|')) {
      throw new RangeError('Cada parte de los datos asociados es no vacía y sin «|»');
    }
  }
  return codificador.encode(partes.join('|'));
}

function copia(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

async function sellar(
  llave: CryptoKey,
  datos: Uint8Array,
  asociados: Uint8Array<ArrayBuffer>,
  aleatorio: Aleatorio,
): Promise<string> {
  const iv = copia(aleatorio(12));
  if (iv.length !== 12) throw new RangeError('El IV de AES-GCM es de 12 bytes');
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: asociados },
      llave,
      copia(datos),
    ),
  );
  return `${VERSION_FORMATO}.${aBase64Url(iv)}.${aBase64Url(ct)}`;
}

async function abrir(
  llave: CryptoKey,
  sellado: string,
  asociados: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array> {
  const [version, iv, ct] = sellado.split('.');
  if (version !== VERSION_FORMATO || iv === undefined || ct === undefined)
    throw new DescifradoFallido();
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: copia(deBase64Url(iv)), additionalData: asociados },
        llave,
        copia(deBase64Url(ct)),
      ),
    );
  } catch {
    throw new DescifradoFallido();
  }
}

async function llaveAes(bruta: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', copia(bruta), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

async function llaveDe(proposito: Proposito, bruta: Uint8Array): Promise<CryptoKey> {
  if (proposito === 'indices') {
    return crypto.subtle.importKey('raw', copia(bruta), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
    ]);
  }
  return llaveAes(bruta);
}

// --- KEK ---------------------------------------------------------------------------------------

/** Importa la KEK de 32 bytes que llega por el secreto del Worker. No es extraíble. */
export async function importarKek(id: string, bytes: Uint8Array): Promise<Kek> {
  if (bytes.length !== 32) throw new RangeError('La KEK es de 32 bytes');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw new RangeError('Id de KEK inválido');
  return { id, llave: await llaveAes(bytes) };
}

// --- DEK ---------------------------------------------------------------------------------------

/** Crea una DEK nueva al azar y la devuelve abierta (para usarla) y envuelta (para guardarla). */
export async function crearDek(
  org: string,
  proposito: Proposito,
  version: number,
  kek: Kek,
  aleatorio: Aleatorio = aleatorioDelSistema,
): Promise<{ dek: Dek; envuelta: DekEnvuelta }> {
  if (!Number.isSafeInteger(version) || version < 1)
    throw new RangeError('Versión de DEK inválida');
  const bruta = aleatorio(32);
  if (bruta.length !== 32) throw new RangeError('La DEK es de 32 bytes');
  const envuelta = await sellar(
    kek.llave,
    bruta,
    aad([org, proposito, String(version)]),
    aleatorio,
  );
  const dek: Dek = { org, proposito, version, llave: await llaveDe(proposito, bruta) };
  bruta.fill(0);
  return { dek, envuelta: { org, proposito, version, kekId: kek.id, envuelta } };
}

/** Abre una DEK guardada con la KEK que la envolvió. */
export async function abrirDek(
  envuelta: DekEnvuelta,
  keks: ReadonlyMap<string, Kek>,
): Promise<Dek> {
  const kek = keks.get(envuelta.kekId);
  if (!kek) throw new DescifradoFallido();
  const { org, proposito, version } = envuelta;
  const bruta = await abrir(kek.llave, envuelta.envuelta, aad([org, proposito, String(version)]));
  try {
    return { org, proposito, version, llave: await llaveDe(proposito, bruta) };
  } finally {
    bruta.fill(0);
  }
}

/** Rotación de la KEK: la misma DEK, envuelta con la KEK nueva. Los campos no se tocan. */
export async function reenvolverDek(
  envuelta: DekEnvuelta,
  keks: ReadonlyMap<string, Kek>,
  nueva: Kek,
  aleatorio: Aleatorio = aleatorioDelSistema,
): Promise<DekEnvuelta> {
  const vieja = keks.get(envuelta.kekId);
  if (!vieja) throw new DescifradoFallido();
  const asociados = aad([envuelta.org, envuelta.proposito, String(envuelta.version)]);
  const bruta = await abrir(vieja.llave, envuelta.envuelta, asociados);
  try {
    return {
      ...envuelta,
      kekId: nueva.id,
      envuelta: await sellar(nueva.llave, bruta, asociados, aleatorio),
    };
  } finally {
    bruta.fill(0);
  }
}

/** Una KEK se puede retirar solo cuando ninguna DEK guardada la usa (P21). */
export function kekEnUso(kekId: string, envueltas: readonly DekEnvuelta[]): boolean {
  return envueltas.some((e) => e.kekId === kekId);
}

// --- campos ------------------------------------------------------------------------------------

function exigir(dek: Dek, proposito: Proposito, org: string) {
  if (dek.proposito !== proposito)
    throw new RangeError(`Esta operación pide la DEK de ${proposito}`);
  if (dek.org !== org) throw new DescifradoFallido();
}

/** Cifra un campo atado a su fila. Lleva la versión de la DEK para leerlo después de rotarla. */
export async function cifrarCampo(
  dek: Dek,
  contexto: Contexto,
  texto: string,
  aleatorio: Aleatorio = aleatorioDelSistema,
): Promise<string> {
  if (dek.proposito === 'indices') throw new RangeError('La DEK de índices no cifra campos');
  if (dek.org !== contexto.org) throw new RangeError('La DEK no es de esta tienda');
  const { org, tabla, campo, id } = contexto;
  const sellado = await sellar(
    dek.llave,
    codificador.encode(texto),
    aad([org, tabla, campo, id]),
    aleatorio,
  );
  return `${dek.version}:${sellado}`;
}

/** Descifra un campo con la DEK de su versión. Cualquier falla es la misma `DescifradoFallido`. */
export async function descifrarCampo(
  deks: ReadonlyMap<number, Dek>,
  contexto: Contexto,
  cifrado: string,
): Promise<string> {
  const corte = cifrado.indexOf(':');
  const dek = deks.get(Number(cifrado.slice(0, corte)));
  if (corte < 1 || !dek || dek.proposito === 'indices' || dek.org !== contexto.org) {
    throw new DescifradoFallido();
  }
  const { org, tabla, campo, id } = contexto;
  const bytes = await abrir(dek.llave, cifrado.slice(corte + 1), aad([org, tabla, campo, id]));
  return new TextDecoder().decode(bytes);
}

/**
 * Un campo cifrado en las tres columnas del anexo A (`sobre`, `iv`, `llave_version`), como lo
 * guardan `pedido_contacto` y `solicitud`: los mismos AES-256-GCM y datos asociados que
 * `cifrarCampo`, con el IV aparte porque la base exige que mida 12 bytes.
 */
export interface Sobre {
  sobre: Uint8Array;
  iv: Uint8Array;
  version: number;
}

/** Cifra un campo en columnas, atado a su fila (`org|tabla|campo|id`). */
export async function cifrarSobre(
  dek: Dek,
  contexto: Contexto,
  texto: string,
  aleatorio: Aleatorio = aleatorioDelSistema,
): Promise<Sobre> {
  if (dek.proposito === 'indices') throw new RangeError('La DEK de índices no cifra campos');
  if (dek.org !== contexto.org) throw new RangeError('La DEK no es de esta tienda');
  const { org, tabla, campo, id } = contexto;
  const iv = copia(aleatorio(12));
  if (iv.length !== 12) throw new RangeError('El IV de AES-GCM es de 12 bytes');
  const sobre = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aad([org, tabla, campo, id]) },
      dek.llave,
      codificador.encode(texto),
    ),
  );
  return { sobre, iv, version: dek.version };
}

/** Descifra un campo en columnas con la DEK de su versión. Cualquier falla es `DescifradoFallido`. */
export async function descifrarSobre(
  deks: ReadonlyMap<number, Dek>,
  contexto: Contexto,
  s: Sobre,
): Promise<string> {
  const dek = deks.get(s.version);
  if (!dek || dek.proposito === 'indices' || dek.org !== contexto.org || s.iv.length !== 12) {
    throw new DescifradoFallido();
  }
  const { org, tabla, campo, id } = contexto;
  try {
    const bytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: copia(s.iv), additionalData: aad([org, tabla, campo, id]) },
      dek.llave,
      copia(s.sobre),
    );
    return new TextDecoder().decode(bytes);
  } catch {
    throw new DescifradoFallido();
  }
}

/** Índice ciego: 128 bits de HMAC-SHA256 en hexadecimal. Igual valor, igual índice, en esa tienda. */
export async function indiceCiego(dek: Dek, valor: string): Promise<string> {
  exigir(dek, 'indices', dek.org);
  const firma = new Uint8Array(
    await crypto.subtle.sign('HMAC', dek.llave, codificador.encode(valor)),
  );
  return Array.from(firma.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}
