/**
 * El formato de la copia fuera de Cloudflare (HU-C11.4, ADR-30): qué bases entran, de qué semana es
 * y cómo va cifrada. Sin red ni base: lo usan el cron del CORE para hacerla (`copia.ts`) y el
 * simulacro para abrirla en el computador del dueño (`scripts/copia/simulacro.ts`), así que los dos
 * leen y escriben lo mismo (P2).
 *
 * **El archivo** (`<semana>_<base>.sql.ed1`): `ED1C` y la versión `1`, el IV de 12 bytes y el
 * texto cifrado con AES-256-GCM. En claro adentro: una línea de JSON con la base, la semana, la
 * huella del volcado y las filas de cada tabla, y después el volcado SQL tal como lo da D1. Los
 * datos asociados (`ed1-copia/1|<base>|<semana>`) atan la copia a su nombre: renombrar un archivo
 * no hace pasar la copia de una base por la de otra.
 *
 * **Por qué no `@ed1/cifrado`:** sus llaves son por tienda y propósito, envueltas por la KEK, para
 * campos de una fila. La copia es un archivo entero con una sola llave que vive fuera de Google
 * (CA4); compartir el paquete obligaría a fingir una tienda.
 */
import celdas from '../../../infrastructure/celdas.json' with { type: 'json' };

const MAGIA = new TextEncoder().encode('ED1C');
const VERSION = 1;
/** Lo que el cabezal de la copia dice de su contenido. */
export interface Manifiesto {
  formato: 'ed1-copia/1';
  base: string;
  semana: string;
  /** SHA-256 en hexadecimal del volcado en claro. */
  huella: string;
  /** Filas de cada tabla en el volcado. */
  filas: Record<string, number>;
}

export class CopiaIlegible extends Error {
  override name = 'CopiaIlegible';
}

/**
 * Las bases que se copian en un destino, de `celdas.json` (P2): la del CORE y cada shard de cada
 * celda activa. En staging, con su `_staging`, como las nombra el despliegue.
 */
export function basesDeLaCopia(
  config: {
    core: { d1: string };
    celdas: readonly { estado: string; shards: readonly string[] }[];
  },
  destino: string | undefined,
): string[] {
  const sufijo = destino === 'produccion' ? '' : '_staging';
  const bases = [
    config.core.d1,
    ...config.celdas.filter((c) => c.estado === 'activa').flatMap((c) => c.shards),
  ];
  return [...new Set(bases)].map((b) => `${b}${sufijo}`);
}

export const BASES_DE_CELDAS = (destino: string | undefined) => basesDeLaCopia(celdas, destino);

const DIA_MS = 24 * 60 * 60 * 1000;
const BOGOTA_MS = -5 * 60 * 60 * 1000;

/** La semana de la copia: el lunes de Bogotá en que empieza, `AAAA-MM-DD`. */
export function semanaDe(ahora: number): string {
  const bogota = new Date(ahora + BOGOTA_MS);
  const desdeLunes = (bogota.getUTCDay() + 6) % 7;
  return new Date(bogota.getTime() - desdeLunes * DIA_MS).toISOString().slice(0, 10);
}

/** El nombre del archivo en Drive. */
export const nombreDelArchivo = (semana: string, base: string) => `${semana}_${base}.sql.ed1`;

export async function huellaDe(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...h].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Las filas de cada tabla en un volcado de D1: una sentencia `INSERT INTO` por fila, con el nombre
 * de la tabla con o sin comillas. Las tablas internas (`_cf_*`, `sqlite_*`, `d1_migrations`) cuentan
 * igual: el simulacro las restaura también.
 */
export function filasDelVolcado(sql: string): Record<string, number> {
  const filas: Record<string, number> = {};
  for (const m of sql.matchAll(/^INSERT INTO\s+(?:"([^"]+)"|`([^`]+)`|([A-Za-z0-9_]+))/gm)) {
    const tabla = m[1] ?? m[2] ?? m[3] ?? '';
    filas[tabla] = (filas[tabla] ?? 0) + 1;
  }
  return filas;
}

/** La llave de 32 bytes del secreto `COPIA_LLAVE`, en base64. */
export async function importarLlave(base64: string): Promise<CryptoKey> {
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = Uint8Array.from(atob(base64.trim()), (c) => c.charCodeAt(0));
  } catch {
    throw new RangeError('COPIA_LLAVE no es base64');
  }
  if (bytes.length !== 32) throw new RangeError('COPIA_LLAVE no mide 32 bytes');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

const asociados = (base: string, semana: string) =>
  new TextEncoder().encode(`ed1-copia/1|${base}|${semana}`);

/** Cifra el volcado con su manifiesto. Devuelve el archivo y el manifiesto que lleva adentro. */
export async function cifrarCopia(
  llave: CryptoKey,
  datos: { base: string; semana: string; volcado: Uint8Array<ArrayBuffer> },
  aleatorio: (n: number) => Uint8Array<ArrayBuffer> = (n) =>
    crypto.getRandomValues(new Uint8Array(n)),
): Promise<{ archivo: Uint8Array<ArrayBuffer>; manifiesto: Manifiesto }> {
  const manifiesto: Manifiesto = {
    formato: 'ed1-copia/1',
    base: datos.base,
    semana: datos.semana,
    huella: await huellaDe(datos.volcado),
    filas: filasDelVolcado(new TextDecoder().decode(datos.volcado)),
  };
  const cabeza = new TextEncoder().encode(`${JSON.stringify(manifiesto)}\n`);
  const claro = new Uint8Array(cabeza.length + datos.volcado.length);
  claro.set(cabeza);
  claro.set(datos.volcado, cabeza.length);
  const iv = aleatorio(12);
  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: asociados(datos.base, datos.semana) },
      llave,
      claro,
    ),
  );
  const archivo = new Uint8Array(MAGIA.length + 1 + iv.length + cifrado.length);
  archivo.set(MAGIA);
  archivo[MAGIA.length] = VERSION;
  archivo.set(iv, MAGIA.length + 1);
  archivo.set(cifrado, MAGIA.length + 1 + iv.length);
  return { archivo, manifiesto };
}

/**
 * Abre una copia y comprueba que es de esa base y semana y que el volcado es el que dice su
 * huella. Cualquier falla es `CopiaIlegible`, con la causa en palabras (CA3).
 */
export async function descifrarCopia(
  llave: CryptoKey,
  esperada: { base: string; semana: string },
  archivo: Uint8Array<ArrayBuffer>,
): Promise<{ manifiesto: Manifiesto; volcado: Uint8Array<ArrayBuffer> }> {
  const cabeza = archivo.subarray(0, MAGIA.length);
  if (cabeza.length < MAGIA.length || cabeza.some((b, i) => b !== MAGIA[i])) {
    throw new CopiaIlegible('el archivo no es una copia de la plataforma');
  }
  if (archivo[MAGIA.length] !== VERSION) {
    throw new CopiaIlegible(`la copia es de una versión que no conozco (${archivo[MAGIA.length]})`);
  }
  const iv = archivo.subarray(MAGIA.length + 1, MAGIA.length + 13);
  let claro: Uint8Array<ArrayBuffer>;
  try {
    claro = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: asociados(esperada.base, esperada.semana) },
        llave,
        archivo.subarray(MAGIA.length + 13),
      ),
    );
  } catch {
    throw new CopiaIlegible(
      'no se pudo descifrar: la llave no es la de esta copia, o el archivo no es de esa base y semana, o se dañó',
    );
  }
  const salto = claro.indexOf(10);
  if (salto < 0) throw new CopiaIlegible('la copia no trae su manifiesto');
  let manifiesto: Manifiesto;
  try {
    manifiesto = JSON.parse(new TextDecoder().decode(claro.subarray(0, salto))) as Manifiesto;
  } catch {
    throw new CopiaIlegible('el manifiesto de la copia no se puede leer');
  }
  const volcado = claro.subarray(salto + 1);
  if ((await huellaDe(volcado)) !== manifiesto.huella) {
    throw new CopiaIlegible('el volcado no es el que dice su huella');
  }
  return { manifiesto, volcado };
}

/**
 * Qué copias se quedan (CA1c): las de las 8 semanas más recientes, y de las anteriores la primera
 * semana de cada mes, hasta 12 meses. Recibe y devuelve semanas (`AAAA-MM-DD`).
 */
export function semanasQueSeQuedan(semanas: readonly string[]): Set<string> {
  const orden = [...new Set(semanas)].sort().reverse();
  const quedan = new Set(orden.slice(0, 8));
  const meses = new Set<string>();
  for (const s of [...orden.slice(8)].reverse()) {
    const mes = s.slice(0, 7);
    if (!meses.has(mes)) {
      meses.add(mes);
      quedan.add(s);
    }
  }
  const mesesOrdenados = [...meses].sort().reverse().slice(0, 12);
  for (const s of orden.slice(8)) {
    if (quedan.has(s) && !mesesOrdenados.includes(s.slice(0, 7))) quedan.delete(s);
  }
  return quedan;
}
