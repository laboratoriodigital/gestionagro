/**
 * Copia del cuaderno en el Google Drive del productor (HU-E8.4, etapa 1; decisión del dueño,
 * 5 oct 2026). Todo va del teléfono a Google: la nube de CultivoPro no ve la copia.
 *
 * - Una carpeta visible, «CultivoPro · respaldos», en el Drive de la persona: puede ver, descargar
 *   o borrar sus copias. Con el permiso `drive.file`, la app solo ve lo que ella misma creó.
 * - El archivo es el mismo `agro-export` v1 de «Descargar respaldo completo» (P2): se restaura con
 *   la misma revisión e importación, que une y no reemplaza.
 * - Se conservan las 8 copias más recientes; las más viejas que creó la app se borran.
 * - Las fotos no van en la copia todavía: el formato no las lleva.
 *
 * Funciones con `fetch` inyectado, para probarlas sin Google.
 */
import { fechaAgronomica } from '@ed1/agro-schema';
import marca from '../../../../content/marca.json' with { type: 'json' };
import { corto } from '../descargar.ts';
import type { CuadernoDb } from './db.ts';
import { exportarTodo } from './respaldo.ts';

const API = 'https://www.googleapis.com/drive/v3';
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files';
export const ORIGEN_DRIVE = 'https://www.googleapis.com';
export const CARPETA = `${marca.nombre} · respaldos`;
export const CONSERVAR = 8;
export const CLAVE_ULTIMO_DRIVE = 'ultimo_respaldo_drive';
const TIPO_CARPETA = 'application/vnd.google-apps.folder';

type Fetch = typeof fetch;

export interface CopiaEnDrive {
  id: string;
  nombre: string;
  /** Bytes. */
  tamano: number;
  creado: string;
}

/** Lo que pasa con Drive, dicho para la persona (P15). */
export class ErrorDeDrive extends Error {
  override readonly name = 'ErrorDeDrive';
}

async function pedir(
  fetchFn: Fetch,
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  let r: Response;
  try {
    r = await fetchFn(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ErrorDeDrive(
      'No hay señal para hablar con Google. Inténtalo cuando tengas internet.',
    );
  }
  if (r.ok) return r;
  if (r.status === 401) {
    throw new ErrorDeDrive('El permiso de Google venció. Vuelve a tocar el botón.');
  }
  const cuerpo = (await r.json().catch(() => null)) as {
    error?: { errors?: { reason?: string }[] };
  } | null;
  const razon = cuerpo?.error?.errors?.[0]?.reason;
  if (razon === 'storageQuotaExceeded') {
    throw new ErrorDeDrive('Tu Google Drive está lleno. Libera espacio y vuelve a intentarlo.');
  }
  throw new ErrorDeDrive(`Google Drive no respondió como se esperaba (${r.status}).`);
}

const consulta = (q: string, extra: Record<string, string> = {}) =>
  new URLSearchParams({ q, spaces: 'drive', ...extra }).toString();

/** Id de la carpeta de respaldos; la crea si no existe. */
export async function carpetaDeRespaldos(fetchFn: Fetch, token: string): Promise<string> {
  const q = `name = '${CARPETA}' and mimeType = '${TIPO_CARPETA}' and trashed = false`;
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
    body: JSON.stringify({ name: CARPETA, mimeType: TIPO_CARPETA }),
  });
  return ((await creada.json()) as { id: string }).id;
}

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

const HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Exporta todo, lo sube a la carpeta y deja solo las 8 copias más recientes. Devuelve el nombre
 * del archivo y cuántas copias viejas borró.
 */
export async function guardarCopiaEnDrive(
  db: CuadernoDb,
  fetchFn: Fetch,
  token: string,
  { app, ahora = () => new Date() }: { app: string; ahora?: () => Date },
): Promise<{ nombre: string; borradas: number }> {
  const archivo = await exportarTodo(db, { app, ahora });
  const finca = archivo.tablas.finca.filas.find((f) => f.id === archivo.finca_id);
  const momento = ahora();
  const hora = HORA.format(momento).replace(':', '');
  const nombre = `cuaderno-${corto(finca?.nombre ?? 'finca')}-${fechaAgronomica(momento.getTime())}-${hora}.json`;
  const carpeta = await carpetaDeRespaldos(fetchFn, token);

  const limite = `respaldo-${crypto.randomUUID()}`;
  const cuerpo = [
    `--${limite}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name: nombre, parents: [carpeta], mimeType: 'application/json' }),
    `--${limite}`,
    'Content-Type: application/json',
    '',
    JSON.stringify(archivo),
    `--${limite}--`,
    '',
  ].join('\r\n');
  await pedir(fetchFn, token, `${SUBIDA}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'content-type': `multipart/related; boundary=${limite}` },
    body: cuerpo,
  });

  // Solo después de subir la nueva se borran las viejas: nunca se queda sin copia.
  const sobrantes = (await listarCopias(fetchFn, token, carpeta)).slice(CONSERVAR);
  for (const copia of sobrantes) {
    await pedir(fetchFn, token, `${API}/files/${encodeURIComponent(copia.id)}`, {
      method: 'DELETE',
    });
  }
  const instante = momento.toISOString();
  await db.meta.put({ clave: CLAVE_ULTIMO_DRIVE, valor: instante, actualizado: instante });
  return { nombre, borradas: sobrantes.length };
}
