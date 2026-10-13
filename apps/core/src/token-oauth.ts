/**
 * `POST /oauth/token` (HU-C9.5, PLATAFORMA §5.4, ADR-41): el agente cambia su código por un token,
 * y su refresh por otro.
 *
 * - **Código** (`authorization_code`): de un solo uso, vigente, con la misma vuelta y el
 *   `code_verifier` que da el reto PKCE S256 guardado al autorizar. Se marca usado con un `UPDATE`
 *   condicionado: dos canjes simultáneos no dan dos tokens.
 * - **Token:** 1 hora, del emisor de agentes (`@ed1/tokens`), con `aud` = el recurso, `scope`,
 *   `azp` (el cliente) y `cnc` (la concesión) (CA1).
 * - **Refresh:** rotado en cada uso. **Reusar uno ya rotado revoca la concesión entera** y queda en
 *   la auditoría: es la señal de que alguien más lo tiene (CA2). Vive 90 días sin uso.
 *
 * Errores como pide RFC 6749 §5.2, con `error` y una descripción. Acepta el cuerpo como formulario
 * (lo que manda un cliente OAuth) o como JSON.
 */
import {
  base64url,
  firmarAccesoDeAgente,
  hashDe,
  secretoAlAzar,
  verificarAccesoDeAgente,
} from '@ed1/tokens';
import type { Context } from 'hono';
import { filaDeAuditoria } from './auditoria.ts';
import type { Entorno } from './entrar.ts';

export const VIDA_DEL_REFRESH_DE_AGENTE_MS = 90 * 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

interface Concesion {
  id: string;
  usuario_id: string;
  org_id: string;
  producto: string;
  cliente_id: string;
  recurso: string;
  alcances: string;
  revocada: string | null;
}

const error = (c: Context, codigo: string, descripcion: string, estado: 400 | 401 = 400) => {
  c.header('cache-control', 'no-store');
  return c.json({ error: codigo, error_description: descripcion }, estado);
};

async function cuerpoDe(c: Context): Promise<Record<string, string>> {
  const tipo = c.req.header('content-type') ?? '';
  if (tipo.includes('application/json')) {
    const j = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(j).filter((x): x is [string, string] => typeof x[1] === 'string'),
    );
  }
  const f = await c.req.parseBody().catch(() => ({}));
  return Object.fromEntries(
    Object.entries(f).filter((x): x is [string, string] => typeof x[1] === 'string'),
  );
}

/** PKCE S256: base64url(SHA-256(verifier)) tiene que ser el reto guardado. */
export async function cumpleElReto(verificador: string, reto: string): Promise<boolean> {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verificador)) return false;
  const h = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador)),
  );
  return base64url(h) === reto;
}

async function emitir(c: Context, e: Entorno, concesion: Concesion, ahora: number) {
  const alcances = JSON.parse(concesion.alcances) as string[];
  const ubicacion = await e.db
    .prepare('SELECT celda_id, shard FROM organizacion WHERE id = ?')
    .bind(concesion.org_id)
    .first<{ celda_id: string; shard: string }>();
  if (!ubicacion) return error(c, 'invalid_grant', 'La organización de este acceso ya no existe.');
  const { token } = await firmarAccesoDeAgente(
    e.firmante,
    {
      sub: concesion.usuario_id,
      aud: concesion.recurso,
      azp: concesion.cliente_id,
      cnc: concesion.id,
      org: concesion.org_id,
      celda: ubicacion.celda_id,
      shard: ubicacion.shard,
      scope: alcances.join(' '),
    },
    ahora,
  );
  const refresh = secretoAlAzar();
  await e.db.batch([
    e.db
      .prepare(
        'INSERT INTO refresco_oauth (refresh_hash, concesion_id, creado, expira) VALUES (?, ?, ?, ?)',
      )
      .bind(
        await hashDe(refresh),
        concesion.id,
        iso(ahora),
        iso(ahora + VIDA_DEL_REFRESH_DE_AGENTE_MS),
      ),
    e.db
      .prepare('UPDATE concesion_oauth SET ultimo_uso = ? WHERE id = ?')
      .bind(iso(ahora), concesion.id),
    e.db
      .prepare('UPDATE cliente_oauth SET ultimo_uso = ? WHERE id = ?')
      .bind(iso(ahora), concesion.cliente_id),
  ]);
  c.header('cache-control', 'no-store');
  return c.json({
    access_token: token,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: refresh,
    scope: alcances.join(' '),
  });
}

const leerConcesion = (e: Entorno, id: string) =>
  e.db
    .prepare(
      'SELECT id, usuario_id, org_id, producto, cliente_id, recurso, alcances, revocada FROM concesion_oauth WHERE id = ?',
    )
    .bind(id)
    .first<Concesion>();

/** Revoca la concesión y todos sus refresh, con su fila de auditoría (reuso o pedido). */
export function revocarConcesion(e: Entorno, concesion: Concesion, ahora: number, motivo: string) {
  return e.db.batch([
    e.db
      .prepare('UPDATE concesion_oauth SET revocada = ? WHERE id = ? AND revocada IS NULL')
      .bind(iso(ahora), concesion.id),
    e.db
      .prepare('UPDATE refresco_oauth SET rotado = ? WHERE concesion_id = ? AND rotado IS NULL')
      .bind(iso(ahora), concesion.id),
    filaDeAuditoria(
      e.db,
      {
        instante: iso(ahora),
        producto: concesion.producto,
        org_id: concesion.org_id,
        usuario_id: concesion.usuario_id,
        accion: 'concesion_revocada',
        detalle: { cliente: concesion.cliente_id, motivo },
      },
      {
        sql: 'SELECT 1 FROM concesion_oauth WHERE id = ? AND revocada = ?',
        valores: [concesion.id, iso(ahora)],
      },
    ),
  ]);
}

export async function canjearToken(c: Context, e: Entorno): Promise<Response> {
  c.header('access-control-allow-origin', '*');
  const b = await cuerpoDe(c);
  const ahora = e.ahora();
  if (b['grant_type'] === 'authorization_code') {
    const { code, code_verifier, redirect_uri, client_id } = b;
    if (!code || !code_verifier || !redirect_uri || !client_id)
      return error(c, 'invalid_request', 'Faltan code, code_verifier, redirect_uri o client_id.');
    const hash = await hashDe(code);
    const k = await e.db
      .prepare(
        'SELECT concesion_id, redirect_uri, code_challenge, expira, usado FROM codigo_oauth WHERE codigo_hash = ?',
      )
      .bind(hash)
      .first<{
        concesion_id: string;
        redirect_uri: string;
        code_challenge: string;
        expira: string;
        usado: string | null;
      }>();
    if (!k || k.usado || Date.parse(k.expira) <= ahora)
      return error(c, 'invalid_grant', 'El código no sirve: venció o ya se usó.');
    if (k.redirect_uri !== redirect_uri)
      return error(c, 'invalid_grant', 'La dirección de vuelta no es la del código.');
    if (!(await cumpleElReto(code_verifier, k.code_challenge)))
      return error(c, 'invalid_grant', 'El code_verifier no corresponde (PKCE).');
    const concesion = await leerConcesion(e, k.concesion_id);
    if (!concesion || concesion.revocada || concesion.cliente_id !== client_id)
      return error(c, 'invalid_grant', 'Esta concesión no es de este cliente o ya no vale.');
    if (b['resource'] && b['resource'] !== concesion.recurso)
      return error(c, 'invalid_target', 'El resource no es el que se autorizó.');
    const uso = await e.db
      .prepare('UPDATE codigo_oauth SET usado = ? WHERE codigo_hash = ? AND usado IS NULL')
      .bind(iso(ahora), hash)
      .run();
    if (!uso.meta.changes) return error(c, 'invalid_grant', 'El código ya se usó.');
    return emitir(c, e, concesion, ahora);
  }
  if (b['grant_type'] === 'refresh_token') {
    const { refresh_token, client_id } = b;
    if (!refresh_token || !client_id)
      return error(c, 'invalid_request', 'Faltan refresh_token o client_id.');
    const hash = await hashDe(refresh_token);
    const r = await e.db
      .prepare('SELECT concesion_id, expira, rotado FROM refresco_oauth WHERE refresh_hash = ?')
      .bind(hash)
      .first<{ concesion_id: string; expira: string; rotado: string | null }>();
    if (!r) return error(c, 'invalid_grant', 'Ese refresh no existe.');
    const concesion = await leerConcesion(e, r.concesion_id);
    if (!concesion) return error(c, 'invalid_grant', 'Ese refresh no existe.');
    if (r.rotado) {
      // CA2: un refresh ya usado volvió. Alguien más lo tiene: se corta la concesión entera.
      if (!concesion.revocada) await revocarConcesion(e, concesion, ahora, 'reuso de refresh');
      return error(c, 'invalid_grant', 'Ese refresh ya se usó: por seguridad se quitó el acceso.');
    }
    if (concesion.revocada || Date.parse(r.expira) <= ahora || concesion.cliente_id !== client_id)
      return error(c, 'invalid_grant', 'El acceso ya no vale. Pídelo otra vez.');
    const giro = await e.db
      .prepare('UPDATE refresco_oauth SET rotado = ? WHERE refresh_hash = ? AND rotado IS NULL')
      .bind(iso(ahora), hash)
      .run();
    if (!giro.meta.changes) {
      await revocarConcesion(e, concesion, ahora, 'reuso de refresh');
      return error(c, 'invalid_grant', 'Ese refresh ya se usó: por seguridad se quitó el acceso.');
    }
    return emitir(c, e, concesion, ahora);
  }
  return error(c, 'unsupported_grant_type', 'Solo authorization_code y refresh_token.');
}

/**
 * `POST /oauth/revoke` (RFC 7009, HU-C9.6): el agente devuelve su refresh o su token, y la
 * concesión entera cae. Responde 200 aunque el token no exista o ya esté revocado, como pide la
 * RFC: así no sirve para averiguar qué tokens existen.
 */
export async function revocarToken(c: Context, e: Entorno): Promise<Response> {
  c.header('access-control-allow-origin', '*');
  const b = await cuerpoDe(c);
  const ahora = e.ahora();
  const token = b['token'] ?? '';
  let concesionId: string | null = null;
  if (token.split('.').length === 3) {
    // Un token de acceso: su `cnc` dice la concesión. Se verifica la firma, no el recurso.
    try {
      const cuerpo = JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(
            atob((token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')),
            (x) => x.charCodeAt(0),
          ),
        ),
      ) as { aud?: string };
      const r = await verificarAccesoDeAgente([e.firmante.publica], token, cuerpo.aud ?? '', ahora);
      concesionId = r.cnc;
    } catch {
      concesionId = null;
    }
  } else if (token) {
    const r = await e.db
      .prepare('SELECT concesion_id FROM refresco_oauth WHERE refresh_hash = ?')
      .bind(await hashDe(token))
      .first<{ concesion_id: string }>();
    concesionId = r?.concesion_id ?? null;
  }
  const concesion = concesionId ? await leerConcesion(e, concesionId) : null;
  if (
    concesion &&
    !concesion.revocada &&
    (!b['client_id'] || b['client_id'] === concesion.cliente_id)
  )
    await revocarConcesion(e, concesion, ahora, 'el agente la devolvió');
  c.header('cache-control', 'no-store');
  return c.body(null, 200);
}

/** Lo que le pregunta un recurso al CORE en cada solicitud (HU-C9.6 CA2, por service binding). */
export async function concesionVigente(db: Entorno['db'], id: string): Promise<boolean> {
  const fila = await db
    .prepare('SELECT 1 AS si FROM concesion_oauth WHERE id = ? AND revocada IS NULL')
    .bind(id)
    .first<{ si: number }>();
  return Boolean(fila);
}
