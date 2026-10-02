/**
 * QR de trazabilidad de un lote (HU-E6.4, ARQUITECTURA §5.9, ADR-14).
 *
 * El QR apunta a `/agro/t/#<datos>[.<firma>]`. La página es estática y lee el fragmento, que no
 * viaja a ningún servidor: escanear no cuesta ninguna solicitud.
 *
 * - `datos`: JSON en base64url con lo que ve quien compra. Solo los campos de `CAMPOS`: ningún dato
 *   personal, ni nombres de personas, ni ids, ni correos (CA3, P13, Ley 1581).
 * - `firma`: Ed25519 de la celda sobre el texto `datos` (como un JWT). Con firma válida, la página
 *   dice «verificado»; sin firma, «sin verificar»; con una firma que no coincide, lo dice en rojo
 *   (CA2). Las claves públicas de las celdas van dentro de la página al publicarla.
 *
 * Sin dependencias: lo usan la celda (firma), el cuaderno (arma la etiqueta sin señal) y la página
 * (verifica con la función de Ed25519 que le pasen).
 */

export const RUTA_QR = '/agro/t/';

export interface DatosQr {
  /** Versión de este formato. */
  v: 1;
  /** Código del lote (`T-27MAR-2`). */
  l: string;
  /** Nombre público de la finca y su municipio. */
  f: string;
  m: string;
  /** Régimen: ecológico o convencional. */
  r: 'ecologico' | 'convencional';
  /** Cultivo y variedad; nulos si el lote no tiene un ciclo conocido. */
  c: string | null;
  va: string | null;
  /** Áreas de donde vienen las cosechas. */
  a: string[];
  /** Primera y última fecha de cosecha (AAAA-MM-DD). */
  d: [string, string];
  /** Clave de la celda que firmó; solo en un QR firmado. */
  k?: string;
}

/** Los únicos campos que puede llevar un QR (CA3). Una prueba lo exige. */
export const CAMPOS: readonly (keyof DatosQr)[] = [
  'v',
  'l',
  'f',
  'm',
  'r',
  'c',
  'va',
  'a',
  'd',
  'k',
];

const texto = new TextEncoder();
const lector = new TextDecoder();

export function base64url(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function desdeBase64url(valor: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(valor)) throw new Error('no es base64url');
  const b64 = valor.replaceAll('-', '+').replaceAll('_', '/');
  const binario = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

/** Solo los campos permitidos, en un orden fijo: el mismo lote da siempre el mismo texto. */
function limpiar(datos: DatosQr): DatosQr {
  const limpio: Record<string, unknown> = {};
  for (const campo of CAMPOS) if (datos[campo] !== undefined) limpio[campo] = datos[campo];
  return limpio as unknown as DatosQr;
}

export const codificar = (datos: DatosQr): string =>
  base64url(texto.encode(JSON.stringify(limpiar(datos))));

/** El mensaje que firma la celda: el texto codificado, como en un JWT. */
export const mensajeAFirmar = (codificado: string): Uint8Array<ArrayBuffer> =>
  texto.encode(codificado);

/** El fragmento del QR (sin `#`): `datos` o `datos.firma`. */
export const fragmento = (codificado: string, firma?: Uint8Array): string =>
  firma ? `${codificado}.${base64url(firma)}` : codificado;

export const enlaceQr = (origen: string, frag: string): string => `${origen}${RUTA_QR}#${frag}`;

export interface ClavePublicaQr {
  kid: string;
  /** La clave pública Ed25519 en base64url (JWK `x`). */
  x: string;
}

export type Verificacion =
  | { estado: 'verificado'; datos: DatosQr }
  | { estado: 'sin-verificar'; datos: DatosQr }
  | { estado: 'no-coincide'; datos: DatosQr | null }
  | { estado: 'clave-desconocida'; datos: DatosQr }
  | { estado: 'danado' };

function leerDatos(codificado: string): DatosQr | null {
  try {
    const d = JSON.parse(lector.decode(desdeBase64url(codificado))) as Partial<DatosQr>;
    if (
      d.v !== 1 ||
      typeof d.l !== 'string' ||
      typeof d.f !== 'string' ||
      !Array.isArray(d.a) ||
      !Array.isArray(d.d)
    ) {
      return null;
    }
    return d as DatosQr;
  } catch {
    return null;
  }
}

/**
 * Lee y verifica un fragmento. `verificar` es Ed25519: la página la toma de una librería y las
 * pruebas de WebCrypto. Una firma que no coincide nunca se muestra como «sin verificar» (CA2).
 */
export async function leerQr(
  frag: string,
  claves: readonly ClavePublicaQr[],
  verificar: (
    publica: Uint8Array<ArrayBuffer>,
    mensaje: Uint8Array<ArrayBuffer>,
    firma: Uint8Array<ArrayBuffer>,
  ) => Promise<boolean>,
): Promise<Verificacion> {
  const [codificado = '', firma, ...resto] = frag.replace(/^#/, '').split('.');
  if (resto.length > 0) return { estado: 'danado' };
  const datos = leerDatos(codificado);
  if (firma === undefined) return datos ? { estado: 'sin-verificar', datos } : { estado: 'danado' };
  if (!datos) return { estado: 'no-coincide', datos: null };
  const clave = claves.find((c) => c.kid === datos.k);
  if (!clave) return { estado: 'clave-desconocida', datos };
  try {
    const valida = await verificar(
      desdeBase64url(clave.x),
      mensajeAFirmar(codificado),
      desdeBase64url(firma),
    );
    return valida ? { estado: 'verificado', datos } : { estado: 'no-coincide', datos };
  } catch {
    return { estado: 'no-coincide', datos };
  }
}
