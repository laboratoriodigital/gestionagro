/**
 * La copia de respaldo en el Google Drive de la persona (HU-E8.4 del agro, etapa 1; HU-Q10.1 del
 * parqueadero, decisión del dueño del 8 oct 2026: «tal cual quedó en CultivoPro»). Todo va del
 * teléfono a Google: ni el CORE ni las celdas ven la copia.
 *
 * - **El permiso** (`apps/core/src/drive.ts`): `drive.file`, de una hora, sin refresh token. Antes
 *   de salir, el teléfono guarda un verificador y al CORE solo le manda su SHA-256; a la vuelta,
 *   canjea el sello con el verificador. Quien copie el fragmento del historial no puede usarlo.
 * - **La copia:** una carpeta visible con el nombre del producto, donde la persona puede ver,
 *   descargar o borrar sus copias. La app solo ve lo que ella misma creó. Se conservan las más
 *   recientes; las viejas se borran solo después de subir la nueva: nunca se queda sin copia.
 *
 * Neutro y puro: `fetch` llega como parámetro y el teléfono decide dónde guarda el verificador.
 */

const API = 'https://www.googleapis.com/drive/v3';
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files';
/** El origen que la CSP de la app tiene que dejar en `connect-src`. */
export const ORIGEN_DRIVE = 'https://www.googleapis.com';
const TIPO_CARPETA = 'application/vnd.google-apps.folder';

type Fetch = typeof fetch;

export interface CopiaEnDrive {
  id: string;
  nombre: string;
  /** Bytes. */
  tamano: number;
  creado: string;
}

/**
 * Lo que pasa con Drive (P15). El mensaje es el del cuaderno, que tutea; `motivo` deja que cada
 * app lo diga con su voz (la caja del parqueadero trata de usted).
 */
export type MotivoDeDrive = 'sin-senal' | 'vencido' | 'lleno' | 'otro';

export class ErrorDeDrive extends Error {
  override readonly name = 'ErrorDeDrive';
  readonly motivo: MotivoDeDrive;
  constructor(motivo: MotivoDeDrive, mensaje: string) {
    super(mensaje);
    this.motivo = motivo;
  }
}

async function pedir(
  fetchFn: Fetch,
  token: string,
  url: string,
  init: RequestInit = {},
  /** Un 404 no es falla: borrar lo que la persona ya borró a mano. */
  ausenteVale = false,
): Promise<Response> {
  let r: Response;
  try {
    r = await fetchFn(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ErrorDeDrive(
      'sin-senal',
      'No hay señal para hablar con Google. Inténtalo cuando tengas internet.',
    );
  }
  if (r.ok || (ausenteVale && r.status === 404)) return r;
  if (r.status === 401) {
    throw new ErrorDeDrive('vencido', 'El permiso de Google venció. Vuelve a tocar el botón.');
  }
  const cuerpo = (await r.json().catch(() => null)) as {
    error?: { errors?: { reason?: string }[] };
  } | null;
  const razon = cuerpo?.error?.errors?.[0]?.reason;
  if (razon === 'storageQuotaExceeded') {
    throw new ErrorDeDrive(
      'lleno',
      'Tu Google Drive está lleno. Libera espacio y vuelve a intentarlo.',
    );
  }
  throw new ErrorDeDrive('otro', `Google Drive no respondió como se esperaba (${r.status}).`);
}

const consulta = (q: string, extra: Record<string, string> = {}) =>
  new URLSearchParams({ q, spaces: 'drive', ...extra }).toString();

/** Id de la carpeta de respaldos con ese nombre; la crea si no existe. */
export async function carpetaDeRespaldos(
  fetchFn: Fetch,
  token: string,
  nombre: string,
): Promise<string> {
  const q = `name = '${nombre.replaceAll("'", "\\'")}' and mimeType = '${TIPO_CARPETA}' and trashed = false`;
  const r = await pedir(
    fetchFn,
    token,
    `${API}/files?${consulta(q, { fields: 'files(id)', pageSize: '1' })}`,
  );
  const { files } = (await r.json()) as { files?: { id: string }[] };
  const existente = files?.[0]?.id;
  if (existente) return existente;
  const creada = await pedir(fetchFn, token, `${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: nombre, mimeType: TIPO_CARPETA }),
  });
  return ((await creada.json()) as { id: string }).id;
}

/** Las copias de la carpeta, la más reciente primero. */
export async function listarCopias(
  fetchFn: Fetch,
  token: string,
  carpeta: string,
): Promise<CopiaEnDrive[]> {
  const r = await pedir(
    fetchFn,
    token,
    `${API}/files?${consulta(`'${carpeta}' in parents and trashed = false`, {
      orderBy: 'createdTime desc',
      fields: 'files(id,name,size,createdTime)',
      pageSize: '100',
    })}`,
  );
  const { files } = (await r.json()) as {
    files?: { id: string; name: string; size?: string; createdTime: string }[];
  };
  return (files ?? []).map((f) => ({
    id: f.id,
    nombre: f.name,
    tamano: Number(f.size ?? 0),
    creado: f.createdTime,
  }));
}

export async function descargarCopia(fetchFn: Fetch, token: string, id: string): Promise<string> {
  const r = await pedir(fetchFn, token, `${API}/files/${encodeURIComponent(id)}?alt=media`);
  return r.text();
}

/**
 * Sube `contenido` (JSON) como `nombre` a la carpeta y deja solo las `conservar` copias más
 * recientes. Devuelve cuántas viejas borró.
 */
export async function subirCopia(
  fetchFn: Fetch,
  token: string,
  o: { carpeta: string; nombre: string; contenido: string; conservar: number },
): Promise<{ borradas: number }> {
  const carpeta = await carpetaDeRespaldos(fetchFn, token, o.carpeta);
  const limite = `respaldo-${crypto.randomUUID()}`;
  const cuerpo = [
    `--${limite}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name: o.nombre, parents: [carpeta], mimeType: 'application/json' }),
    `--${limite}`,
    'Content-Type: application/json',
    '',
    o.contenido,
    `--${limite}--`,
    '',
  ].join('\r\n');
  await pedir(fetchFn, token, `${SUBIDA}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'content-type': `multipart/related; boundary=${limite}` },
    body: cuerpo,
  });
  // Solo después de subir la nueva se borran las viejas: nunca se queda sin copia.
  const sobrantes = (await listarCopias(fetchFn, token, carpeta)).slice(o.conservar);
  for (const copia of sobrantes) await borrarArchivo(fetchFn, token, copia.id);
  return { borradas: sobrantes.length };
}

/** Todos los archivos de la carpeta (id y nombre), página por página: pueden ser cientos de fotos. */
export async function listarArchivos(
  fetchFn: Fetch,
  token: string,
  carpeta: string,
): Promise<{ id: string; nombre: string }[]> {
  const todos: { id: string; nombre: string }[] = [];
  let pagina: string | undefined;
  do {
    const extra: Record<string, string> = {
      fields: 'nextPageToken,files(id,name)',
      pageSize: '1000',
    };
    if (pagina) extra['pageToken'] = pagina;
    const r = await pedir(
      fetchFn,
      token,
      `${API}/files?${consulta(`'${carpeta}' in parents and trashed = false`, extra)}`,
    );
    const j = (await r.json()) as {
      nextPageToken?: string;
      files?: { id: string; name: string }[];
    };
    for (const f of j.files ?? []) todos.push({ id: f.id, nombre: f.name });
    pagina = j.nextPageToken;
  } while (pagina);
  return todos;
}

/** Sube un archivo binario, como una foto, a la carpeta (su id). Devuelve el id que le dio Drive. */
export async function subirArchivo(
  fetchFn: Fetch,
  token: string,
  o: { carpeta: string; nombre: string; tipo: string; datos: Blob },
): Promise<string> {
  const limite = `archivo-${crypto.randomUUID()}`;
  const cuerpo = new Blob([
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify({ name: o.nombre, parents: [o.carpeta], mimeType: o.tipo }),
    `\r\n--${limite}\r\nContent-Type: ${o.tipo}\r\n\r\n`,
    o.datos,
    `\r\n--${limite}--\r\n`,
  ]);
  const r = await pedir(fetchFn, token, `${SUBIDA}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'content-type': `multipart/related; boundary=${limite}` },
    body: cuerpo,
  });
  return ((await r.json()) as { id: string }).id;
}

/** Borra un archivo que la app creó; si ya no está, no es falla. */
export async function borrarArchivo(fetchFn: Fetch, token: string, id: string): Promise<void> {
  await pedir(fetchFn, token, `${API}/files/${encodeURIComponent(id)}`, { method: 'DELETE' }, true);
}

// ── El permiso ────────────────────────────────────────────────────────────────────────────────

const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

/** Un verificador al azar y su desafío (SHA-256): el teléfono guarda el primero, el CORE ve el otro. */
export async function nuevoVerificador(): Promise<{ verificador: string; desafio: string }> {
  const verificador = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const desafio = b64url(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador)),
  );
  return { verificador, desafio };
}

/** Adónde ir para pedir el permiso. Sin `producto`, el CORE entiende que es el cuaderno (P10). */
export function urlDelPermiso(
  core: string,
  o: { vuelta: string; desafio: string; producto?: string },
): string {
  const q = new URLSearchParams({
    ...(o.producto ? { producto: o.producto } : {}),
    vuelta: o.vuelta,
    desafio: o.desafio,
  });
  return `${core}/api/core/drive/inicio?${q}`;
}

export type Vuelta = { tipo: 'sello'; sello: string } | { tipo: 'error'; motivo: string } | null;

/** Lee el fragmento de la vuelta de Google, si es de Drive. */
export function leerVuelta(hash: string): Vuelta {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const sello = p.get('drive');
  if (sello) return { tipo: 'sello', sello };
  const error = p.get('drive-error');
  if (error) return { tipo: 'error', motivo: error };
  return null;
}

/** El motivo de la vuelta, dicho para la persona (P15). */
export function textoDelError(motivo: string): string {
  return motivo === 'cancelada'
    ? 'Cancelaste el permiso en Google. No se guardó ni se trajo nada.'
    : 'Google no dio el permiso. Vuelve a intentarlo en un momento.';
}

/** El permiso no sirvió. `motivo` es `sin-senal`, o el que dijo el CORE, ya en palabras. */
export class PermisoInvalido extends Error {
  override readonly name = 'PermisoInvalido';
  readonly motivo: 'sin-senal' | 'rechazado' | 'vencido';
  constructor(mensaje: string, motivo: PermisoInvalido['motivo'] = 'rechazado') {
    super(mensaje);
    this.motivo = motivo;
  }
}

/** Canjea el sello en el CORE con el verificador guardado: un token de Drive de una hora. */
export async function canjearSello(
  fetchFn: Fetch,
  core: string,
  sello: string,
  verificador: string,
): Promise<string> {
  let r: Response;
  try {
    r = await fetchFn(`${core}/api/core/drive/canje`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sellado: sello, verificador }),
    });
  } catch {
    throw new PermisoInvalido(
      'No hay señal para terminar el permiso. Inténtalo cuando tengas internet.',
      'sin-senal',
    );
  }
  const cuerpo = (await r.json().catch(() => ({}))) as { acceso?: string; motivo?: string };
  if (!r.ok || !cuerpo.acceso) {
    throw new PermisoInvalido(cuerpo.motivo ?? 'Google no dio el permiso. Vuelve a intentarlo.');
  }
  return cuerpo.acceso;
}
