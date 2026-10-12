/**
 * Los clientes de OAuth: los agentes que piden acceso (HU-C9.3, PLATAFORMA §5.4 y §5.7).
 *
 * - **Client ID Metadata Documents (CIMD):** el `client_id` es una URL HTTPS con los metadatos del
 *   cliente. El CORE la lee cuando el cliente pide autorizar y guarda una copia en
 *   `cliente_oauth`, que renueva cada día. Es la forma que pide la especificación de autorización
 *   de MCP; no hace falta registrarse antes.
 * - **Registro dinámico (RFC 7591)** como respaldo: `POST /oauth/register`, con tope de
 *   `TOPE_DE_REGISTROS` por hora por IP. La IP no se guarda: su huella con la fecha del día.
 * - **Un cliente bloqueado no obtiene códigos** (CA2): `clienteParaAutorizar` lo dice y la ruta de
 *   autorizar (HU-C9.4) no sigue. Bloquear es cambiar `estado` en la base; una copia de CIMD
 *   renovada no lo desbloquea.
 *
 * Leer una URL ajena desde el CORE se limita: solo HTTPS a un nombre (no una IP), sin redirecciones,
 * 3 segundos y 5 KB. Los Workers no alcanzan la red interna de nadie, pero tampoco se le deja
 * al cliente hacer que el CORE pida cualquier cosa.
 */
import { hashDe } from '@ed1/tokens';
import type { Context } from 'hono';
import type { Entorno } from './entrar.ts';

export const TOPE_DE_REGISTROS = 10;
const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;
const MAX_BYTES_DE_METADATOS = 5 * 1024;
const iso = (ms: number) => new Date(ms).toISOString();

export interface ClienteOAuth {
  id: string;
  tipo: 'cimd' | 'dcr';
  nombre: string;
  uri: string | null;
  redirect_uris: string[];
  estado: 'activo' | 'bloqueado';
}

/**
 * Una dirección de vuelta aceptable: HTTPS, o `http://` a la propia máquina (una app de escritorio,
 * RFC 8252 §7.3). Sin fragmento.
 */
export function vueltaAceptable(uri: unknown): uri is string {
  if (typeof uri !== 'string' || uri.length > 500) return false;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === 'https:') return true;
  return u.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(u.hostname);
}

/** Una URL de CIMD: HTTPS, a un nombre y no a una IP, con ruta (la especificación lo exige). */
export function esUrlDeMetadatos(id: string): boolean {
  let u: URL;
  try {
    u = new URL(id);
  } catch {
    return false;
  }
  const esIp = /^[\d.]+$/.test(u.hostname) || u.hostname.startsWith('[');
  return u.protocol === 'https:' && !esIp && u.pathname.length > 1 && !u.hash && !u.username;
}

const nombreValido = (n: unknown): n is string =>
  typeof n === 'string' && n.trim().length >= 2 && n.length <= 100;

async function leerCliente(e: Entorno, id: string) {
  const fila = await e.db
    .prepare(
      'SELECT id, tipo, nombre, uri, redirect_uris, estado, creado FROM cliente_oauth WHERE id = ?',
    )
    .bind(id)
    .first<Omit<ClienteOAuth, 'redirect_uris'> & { redirect_uris: string; creado: string }>();
  return fila ? { ...fila, redirect_uris: JSON.parse(fila.redirect_uris) as string[] } : null;
}

/** Los metadatos de un cliente CIMD, leídos de su URL; null con el motivo si no sirven. */
export async function metadatosDelCliente(
  fetchFn: typeof fetch,
  id: string,
): Promise<{ nombre: string; uri: string | null; redirect_uris: string[] } | { motivo: string }> {
  let r: Response;
  try {
    r = await fetchFn(id, {
      redirect: 'manual',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    return { motivo: 'No se pudo leer el documento del cliente.' };
  }
  if (r.status !== 200) return { motivo: `El documento del cliente respondió ${r.status}.` };
  const texto = await r.text();
  if (texto.length > MAX_BYTES_DE_METADATOS)
    return { motivo: 'El documento del cliente es demasiado grande.' };
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(texto) as Record<string, unknown>;
  } catch {
    return { motivo: 'El documento del cliente no es JSON.' };
  }
  // El documento tiene que nombrarse a sí mismo: si no, cualquiera copiaría el de otro.
  if (m['client_id'] !== id) return { motivo: 'El documento no es de este cliente.' };
  const vueltas = m['redirect_uris'];
  if (!nombreValido(m['client_name']) || !Array.isArray(vueltas) || vueltas.length === 0)
    return { motivo: 'Al documento le falta el nombre o las direcciones de vuelta.' };
  if (!vueltas.every(vueltaAceptable))
    return { motivo: 'Una dirección de vuelta del cliente no es segura.' };
  const uri =
    typeof m['client_uri'] === 'string' && esUrlDeMetadatos(m['client_uri'])
      ? m['client_uri']
      : null;
  return { nombre: m['client_name'].trim(), uri, redirect_uris: vueltas };
}

/**
 * El cliente que pide autorizar, o por qué no puede (CA2). Un CIMD se lee la primera vez y se
 * renueva cada día; uno bloqueado sigue bloqueado.
 */
export async function clienteParaAutorizar(
  e: Entorno,
  fetchFn: typeof fetch,
  id: string,
): Promise<{ cliente: ClienteOAuth } | { motivo: string }> {
  const guardado = await leerCliente(e, id);
  if (guardado?.estado === 'bloqueado')
    return { motivo: 'Este asistente está bloqueado y no puede pedir acceso.' };
  const fresco = guardado && e.ahora() - Date.parse(guardado.creado) < DIA_MS;
  if (guardado && (guardado.tipo === 'dcr' || fresco)) return { cliente: guardado };
  if (!esUrlDeMetadatos(id)) return { motivo: 'No conocemos este asistente.' };
  const m = await metadatosDelCliente(fetchFn, id);
  if ('motivo' in m) return m;
  // `creado` marca cuándo se leyó la copia: así se sabe cuándo renovarla.
  await e.db
    .prepare(
      `INSERT INTO cliente_oauth (id, tipo, nombre, uri, redirect_uris, estado, creado) VALUES (?, 'cimd', ?, ?, ?, 'activo', ?)
       ON CONFLICT (id) DO UPDATE SET nombre = excluded.nombre, uri = excluded.uri, redirect_uris = excluded.redirect_uris, creado = excluded.creado
       WHERE cliente_oauth.estado = 'activo'`,
    )
    .bind(id, m.nombre, m.uri, JSON.stringify(m.redirect_uris), iso(e.ahora()))
    .run();
  const cliente = await leerCliente(e, id);
  if (!cliente || cliente.estado === 'bloqueado')
    return { motivo: 'Este asistente está bloqueado y no puede pedir acceso.' };
  return { cliente };
}

/** Error de RFC 7591 §3.2.2. */
const errorDeRegistro = (c: Context, error: string, descripcion: string, estado: 400 | 429 = 400) =>
  c.json({ error, error_description: descripcion }, estado);

/** `POST /oauth/register` (RFC 7591), para el cliente que no publica sus metadatos. */
export async function registrarCliente(c: Context, e: Entorno): Promise<Response> {
  const ahora = e.ahora();
  const ip = c.req.header('cf-connecting-ip') ?? 'sin-ip';
  const origen = await hashDe(`${ip}|${iso(ahora).slice(0, 10)}`);
  const recientes = await e.db
    .prepare('SELECT COUNT(*) AS n FROM cliente_oauth WHERE origen_hash = ? AND creado > ?')
    .bind(origen, iso(ahora - HORA_MS))
    .first<{ n: number }>();
  if ((recientes?.n ?? 0) >= TOPE_DE_REGISTROS) {
    c.header('retry-after', '3600');
    return errorDeRegistro(
      c,
      'too_many_requests',
      'Demasiados registros desde esta red. Intenta en una hora.',
      429,
    );
  }
  const datos = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!datos) return errorDeRegistro(c, 'invalid_client_metadata', 'El cuerpo no es JSON.');
  const vueltas = datos['redirect_uris'];
  if (
    !Array.isArray(vueltas) ||
    vueltas.length === 0 ||
    vueltas.length > 5 ||
    !vueltas.every(vueltaAceptable)
  )
    return errorDeRegistro(
      c,
      'invalid_redirect_uri',
      'Las direcciones de vuelta deben ser HTTPS, o http a la propia máquina.',
    );
  if (!nombreValido(datos['client_name']))
    return errorDeRegistro(c, 'invalid_client_metadata', 'Falta el nombre del cliente.');
  const metodo = datos['token_endpoint_auth_method'] ?? 'none';
  if (metodo !== 'none')
    return errorDeRegistro(c, 'invalid_client_metadata', 'Solo clientes públicos, con PKCE.');
  const id = `dcr-${crypto.randomUUID()}`;
  const nombre = datos['client_name'].trim();
  await e.db
    .prepare(
      `INSERT INTO cliente_oauth (id, tipo, nombre, uri, redirect_uris, estado, creado, origen_hash)
       VALUES (?, 'dcr', ?, NULL, ?, 'activo', ?, ?)`,
    )
    .bind(id, nombre, JSON.stringify(vueltas), iso(ahora), origen)
    .run();
  return c.json(
    {
      client_id: id,
      client_id_issued_at: Math.floor(ahora / 1000),
      client_name: nombre,
      redirect_uris: vueltas,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
    201,
  );
}
