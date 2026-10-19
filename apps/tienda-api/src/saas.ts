/**
 * Cloudflare for SaaS (HU-T13.1, TIENDA-3.0 §4.2, ADR-27): los hostnames personalizados de los
 * dominios propios de las tiendas, con el token `CF_SAAS_TOKEN`, que solo tiene permiso sobre los
 * hostnames y los certificados de la zona de las tiendas (R6). Con `fetch` inyectado, para probarlo
 * sin la cuenta.
 *
 * - **Prevalidación por TXT** del certificado (`ssl.method: txt`): el certificado sale antes de que
 *   el comercio apunte el CNAME, así el cambio no tiene un minuto sin HTTPS.
 * - **Propiedad por TXT** (`ownership_verification`): un hostname que otra tienda dejó, o que nunca
 *   fue de nadie aquí, solo se activa si quien lo pide crea el TXT en su DNS (CA3, TIENDA §4.4).
 * - Nunca se pide mover el DNS del comercio a la cuenta del ecosistema (HA2).
 */
import type { EstadoDelDominio, Validacion } from '@ed1/tienda-schema/dominios';

const API = 'https://api.cloudflare.com/client/v4';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Con qué se habla con Cloudflare for SaaS: el token y la zona de las tiendas, por su nombre. */
export interface Saas {
  token: string;
  zona: string;
  fetch: Fetch;
}

/** Lo que Cloudflare dice de un hostname personalizado (lo que se usa). */
export interface HostnameEnCloudflare {
  id: string;
  hostname: string;
  status?: string;
  ssl?: {
    status?: string;
    validation_records?: { txt_name?: string; txt_value?: string }[];
    validation_errors?: { message?: string }[];
  };
  ownership_verification?: { type?: string; name?: string; value?: string };
  verification_errors?: string[];
}

/** Cloudflare respondió con un error: el código, para distinguir un hostname que ya existe. */
export class ErrorDeSaas extends Error {
  readonly estado: number;
  readonly codigos: number[];
  constructor(estado: number, codigos: number[], mensaje: string) {
    super(mensaje);
    this.estado = estado;
    this.codigos = codigos;
  }
}

/** Cloudflare: «Duplicate custom hostname found» (el hostname ya está en Cloudflare). */
export const CODIGO_DUPLICADO = 1406;

async function pedir<T>(s: Saas, ruta: string, init: RequestInit = {}): Promise<T> {
  const r = await s.fetch(`${API}${ruta}`, {
    ...init,
    headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' },
  });
  const cuerpo = (await r.json().catch(() => ({}))) as {
    success?: boolean;
    result?: T;
    errors?: { code?: number; message?: string }[];
  };
  if (!r.ok || cuerpo.success === false || cuerpo.result === undefined) {
    const errores = cuerpo.errors ?? [];
    throw new ErrorDeSaas(
      r.status,
      errores.map((e) => e.code ?? 0),
      errores.map((e) => e.message).join('; ') || `Cloudflare respondió ${r.status}`,
    );
  }
  return cuerpo.result;
}

const idsDeZona = new Map<string, string>();

/** El id de la zona de las tiendas, por su nombre; se guarda mientras viva el Worker. */
export async function idDeLaZona(s: Saas): Promise<string> {
  const guardado = idsDeZona.get(`${s.token.slice(-6)}:${s.zona}`);
  if (guardado) return guardado;
  const zonas = await pedir<{ id: string; name: string }[]>(
    s,
    `/zones?name=${encodeURIComponent(s.zona)}&per_page=1`,
  );
  const zona = zonas.find((z) => z.name === s.zona);
  if (!zona) throw new ErrorDeSaas(404, [], `la zona ${s.zona} no está al alcance del token`);
  idsDeZona.set(`${s.token.slice(-6)}:${s.zona}`, zona.id);
  return zona.id;
}

/** Crea el hostname con prevalidación y propiedad por TXT. */
export async function crearHostname(s: Saas, hostname: string): Promise<HostnameEnCloudflare> {
  const zona = await idDeLaZona(s);
  return pedir<HostnameEnCloudflare>(s, `/zones/${zona}/custom_hostnames`, {
    method: 'POST',
    body: JSON.stringify({
      hostname,
      ssl: { method: 'txt', type: 'dv', settings: { min_tls_version: '1.2' } },
    }),
  });
}

export async function leerHostname(s: Saas, id: string): Promise<HostnameEnCloudflare> {
  const zona = await idDeLaZona(s);
  return pedir<HostnameEnCloudflare>(
    s,
    `/zones/${zona}/custom_hostnames/${encodeURIComponent(id)}`,
  );
}

/** Borra el hostname de Cloudflare. Uno que ya no estaba no es una falla. */
export async function borrarHostname(s: Saas, id: string): Promise<void> {
  const zona = await idDeLaZona(s);
  try {
    await pedir<unknown>(s, `/zones/${zona}/custom_hostnames/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (e) {
    if (e instanceof ErrorDeSaas && e.estado === 404) return;
    throw e;
  }
}

/** Los TXT que pide Cloudflare, para guardarlos y decirlos (`dominio.validacion`). */
export function validacionDe(h: HostnameEnCloudflare): Validacion {
  const p = h.ownership_verification;
  return {
    propiedad: p?.name && p.value ? { nombre: p.name, valor: p.value } : null,
    certificado: (h.ssl?.validation_records ?? []).flatMap((r) =>
      r.txt_name && r.txt_value ? [{ nombre: r.txt_name, valor: r.txt_value }] : [],
    ),
  };
}

const SSL_FALLIDO = new Set([
  'validation_timed_out',
  'issuance_timed_out',
  'deployment_timed_out',
  'deletion_timed_out',
  'expired',
  'deleted',
]);
const HOSTNAME_FALLIDO = new Set(['blocked', 'pending_blocked', 'moved', 'deleted', 'test_failed']);

/**
 * El estado del dominio, desde lo que dice Cloudflare (P1: nada se da por activo sin que lo esté):
 * - **activo**: el hostname y su certificado están activos;
 * - **validando**: Cloudflare vio los TXT y está emitiendo o desplegando el certificado;
 * - **error**: se venció la validación, o Cloudflare bloqueó o movió el hostname;
 * - **pendiente**: todo lo demás, empezando por los registros que todavía no aparecen.
 */
export function estadoDe(h: HostnameEnCloudflare): {
  estado: EstadoDelDominio;
  motivo: string | null;
} {
  const ssl = h.ssl?.status ?? '';
  const status = h.status ?? '';
  if (status === 'active' && ssl === 'active') return { estado: 'activo', motivo: null };
  if (HOSTNAME_FALLIDO.has(status)) {
    return {
      estado: 'error',
      motivo:
        'Cloudflare no deja usar esta dirección aquí. Revisa que sea tuya; si lo es, escríbenos.',
    };
  }
  if (SSL_FALLIDO.has(ssl)) {
    return {
      estado: 'error',
      motivo:
        'Pasaron varios días sin ver los registros. Revisa que estén como se ven aquí y vuelve a conectar el dominio.',
    };
  }
  if (ssl === 'pending_issuance' || ssl === 'pending_deployment' || ssl === 'active') {
    return { estado: 'validando', motivo: null };
  }
  return {
    estado: 'pendiente',
    motivo: (h.verification_errors?.length ?? 0) > 0 ? 'Todavía no vemos los registros.' : null,
  };
}
