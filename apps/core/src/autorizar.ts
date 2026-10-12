/**
 * Autorizar a un agente, con el consentimiento de la persona (HU-C9.4, PLATAFORMA §5.4, ADR-41).
 *
 * 1. `GET /oauth/authorize` valida la solicitud: el cliente (HU-C9.3), su dirección de vuelta,
 *    PKCE S256, el `resource` (RFC 8707) y los alcances. Si todo está bien, lleva a la página
 *    estática `/autorizar/` de la cuenta, con la solicitud en el fragmento: nunca llega a un
 *    registro de servidor ni a un `Referer`.
 * 2. La página muestra quién pide, qué alcances en palabras, sobre cuál de los espacios de la
 *    persona en el producto de ese recurso, y hasta cuándo.
 * 3. `POST /api/core/cuenta/autorizar` (con token de la cuenta) **vuelve a validar todo**: lo que
 *    trae la página no se cree. Con «Permitir» crea la concesión y un código de un solo uso
 *    (10 minutos, por su huella), en el mismo lote que su fila de auditoría.
 *
 * Errores (RFC 6749 §4.1.2.1): si el cliente o su vuelta no se conocen, no se redirige a ningún
 * lado, porque sería mandar a la persona adonde diga cualquiera; se dice en la página. Los demás
 * vuelven al cliente con `error` y `state`. Sin PKCE, sin `resource` o con uno de otro producto,
 * nunca hay código (CA3). Ningún alcance mueve dinero: lo exige la base (HU-C9.2).
 */
import { hashDe, secretoAlAzar } from '@ed1/tokens';
import type { Context } from 'hono';
import { filaDeAuditoria } from './auditoria.ts';
import { type ClienteOAuth, clienteParaAutorizar } from './clientes-oauth.ts';
import type { Entorno } from './entrar.ts';
import { deLaCuenta } from './mi-cuenta.ts';

export const VIDA_DEL_CODIGO_MS = 10 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

/** Lo que el cliente pide, tal como llega en la consulta. */
export interface PedidoDeAutorizacion {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
  resource?: string;
}

export interface SolicitudValida {
  cliente: ClienteOAuth;
  redirect_uri: string;
  code_challenge: string;
  state: string | null;
  recurso: string;
  producto: string;
  producto_nombre: string;
  alcances: { id: string; descripcion: string }[];
}

type Resultado =
  | { solicitud: SolicitudValida }
  /** Sin cliente o sin vuelta conocidos: se dice en la página, no se redirige. */
  | { enLaPagina: string }
  /** Se vuelve al cliente con el error de OAuth. */
  | {
      alCliente: { redirect_uri: string; error: string; descripcion: string; state: string | null };
    };

const CAMPOS: (keyof PedidoDeAutorizacion)[] = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'state',
  'scope',
  'resource',
];

export function pedidoDe(fuente: (campo: string) => unknown): PedidoDeAutorizacion {
  const p: PedidoDeAutorizacion = {};
  for (const campo of CAMPOS) {
    const v = fuente(campo);
    if (typeof v === 'string' && v.length <= 2000) p[campo] = v;
  }
  return p;
}

export async function validarSolicitud(
  e: Entorno,
  fetchFn: typeof fetch,
  p: PedidoDeAutorizacion,
): Promise<Resultado> {
  if (!p.client_id) return { enLaPagina: 'Falta el asistente que pide acceso.' };
  const c = await clienteParaAutorizar(e, fetchFn, p.client_id);
  if ('motivo' in c) return { enLaPagina: c.motivo };
  // La vuelta tiene que ser exactamente una de las registradas (OAuth 2.1 §4.1.1).
  if (!p.redirect_uri || !c.cliente.redirect_uris.includes(p.redirect_uri))
    return { enLaPagina: 'La dirección a la que volvería este asistente no es una de las suyas.' };
  const state = p.state ?? null;
  const alCliente = (error: string, descripcion: string): Resultado => ({
    alCliente: { redirect_uri: p.redirect_uri as string, error, descripcion, state },
  });
  if (p.response_type !== 'code')
    return alCliente('unsupported_response_type', 'Solo response_type=code.');
  // CA3: PKCE S256 obligatorio. `plain` no protege el código.
  if (p.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(p.code_challenge ?? ''))
    return alCliente('invalid_request', 'PKCE con S256 es obligatorio.');
  // CA3: el recurso es obligatorio y decide el producto (RFC 8707).
  if (!p.resource) return alCliente('invalid_target', 'Falta resource (RFC 8707).');
  const producto = e.catalogo.productos.find(
    (x) => x.estado === 'activo' && (x.recursos_oauth ?? []).includes(p.resource as string),
  );
  if (!producto) return alCliente('invalid_target', 'Ese resource no es de ningún producto.');
  const pedidos = [...new Set((p.scope ?? '').split(' ').filter(Boolean))];
  if (pedidos.length === 0) return alCliente('invalid_scope', 'Falta scope.');
  // Los alcances, de la base: activos, del producto del recurso, y ninguno mueve dinero.
  const { results } = await e.db
    .prepare(
      `SELECT id, descripcion FROM alcance
        WHERE producto = ? AND estado = 'activo' AND mueve_dinero = 0
          AND id IN (${pedidos.map(() => '?').join(', ')})`,
    )
    .bind(producto.id, ...pedidos)
    .all<{ id: string; descripcion: string }>();
  if (results.length !== pedidos.length)
    return alCliente('invalid_scope', `Alcances que no son de ${producto.nombre}.`);
  return {
    solicitud: {
      cliente: c.cliente,
      redirect_uri: p.redirect_uri,
      code_challenge: p.code_challenge as string,
      state,
      recurso: p.resource,
      producto: producto.id,
      producto_nombre: producto.nombre,
      alcances: results.sort((a, b) => a.id.localeCompare(b.id)),
    },
  };
}

/** La dirección de vuelta al cliente con sus parámetros (RFC 9207: `iss` también). */
function vueltaAlCliente(redirectUri: string, parametros: Record<string, string | null>): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(parametros)) if (v !== null) u.searchParams.set(k, v);
  return u.toString();
}

const base64url = (texto: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(texto)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** `GET /oauth/authorize`. */
export async function inicioDeAutorizacion(
  c: Context,
  e: Entorno,
  fetchFn: typeof fetch,
): Promise<Response> {
  const pedido = pedidoDe((campo) => c.req.query(campo));
  const emisor = new URL(c.req.url).origin;
  const r = await validarSolicitud(e, fetchFn, pedido);
  if ('enLaPagina' in r) return c.redirect(`/autorizar/#error=${encodeURIComponent(r.enLaPagina)}`);
  if ('alCliente' in r) {
    return c.redirect(
      vueltaAlCliente(r.alCliente.redirect_uri, {
        error: r.alCliente.error,
        error_description: r.alCliente.descripcion,
        state: r.alCliente.state,
        iss: emisor,
      }),
    );
  }
  const s = r.solicitud;
  // Lo que la página muestra, y el pedido tal cual, que vuelve al CORE para validarlo otra vez.
  const paraLaPagina = {
    pedido,
    cliente: { nombre: s.cliente.nombre, uri: s.cliente.uri, tipo: s.cliente.tipo },
    producto: s.producto,
    producto_nombre: s.producto_nombre,
    alcances: s.alcances,
    vuelve_a: new URL(s.redirect_uri).host,
  };
  return c.redirect(`/autorizar/#solicitud=${base64url(JSON.stringify(paraLaPagina))}`);
}

/** `POST /api/core/cuenta/autorizar`: la persona permite o niega. */
export async function decidirAutorizacion(
  c: Context,
  e: Entorno,
  fetchFn: typeof fetch,
): Promise<Response> {
  const r0 = await deLaCuenta(c, e);
  if (r0 instanceof Response) return r0;
  const cuerpo = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const crudo = (cuerpo['pedido'] ?? {}) as Record<string, unknown>;
  const pedido = pedidoDe((campo) => crudo[campo]);
  const emisor = new URL(c.req.url).origin;
  const r = await validarSolicitud(e, fetchFn, pedido);
  if ('enLaPagina' in r) return c.json({ estado: 'invalida', motivo: r.enLaPagina }, 400);
  if ('alCliente' in r) {
    return c.json({
      vuelta: vueltaAlCliente(r.alCliente.redirect_uri, {
        error: r.alCliente.error,
        error_description: r.alCliente.descripcion,
        state: r.alCliente.state,
        iss: emisor,
      }),
    });
  }
  const s = r.solicitud;
  if (cuerpo['decision'] !== 'permitir') {
    return c.json({
      vuelta: vueltaAlCliente(s.redirect_uri, {
        error: 'access_denied',
        error_description: 'La persona no dio acceso.',
        state: s.state,
        iss: emisor,
      }),
    });
  }
  // El espacio tiene que ser de la persona y del producto del recurso (CA2).
  const org = typeof cuerpo['org_id'] === 'string' ? cuerpo['org_id'] : '';
  const suyo = await e.db
    .prepare(
      `SELECT 1 AS si FROM membresia m JOIN organizacion o ON o.id = m.org_id
        WHERE m.usuario_id = ? AND o.id = ? AND o.producto = ?`,
    )
    .bind(r0.sub, org, s.producto)
    .first<{ si: number }>();
  if (!suyo) {
    return c.json(
      { estado: 'prohibido', motivo: `Elige uno de tus espacios de ${s.producto_nombre}.` },
      403,
    );
  }
  const ahora = e.ahora();
  const concesion = crypto.randomUUID();
  const codigo = secretoAlAzar();
  await e.db.batch([
    e.db
      .prepare(
        `INSERT INTO concesion_oauth (id, usuario_id, org_id, producto, cliente_id, recurso, alcances, creada)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        concesion,
        r0.sub,
        org,
        s.producto,
        s.cliente.id,
        s.recurso,
        JSON.stringify(s.alcances.map((a) => a.id)),
        iso(ahora),
      ),
    e.db
      .prepare(
        `INSERT INTO codigo_oauth (codigo_hash, concesion_id, redirect_uri, code_challenge, expira)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        await hashDe(codigo),
        concesion,
        s.redirect_uri,
        s.code_challenge,
        iso(ahora + VIDA_DEL_CODIGO_MS),
      ),
    filaDeAuditoria(
      e.db,
      {
        instante: iso(ahora),
        producto: s.producto,
        org_id: org,
        usuario_id: r0.sub,
        accion: 'concesion_creada',
        detalle: { cliente: s.cliente.nombre, alcances: s.alcances.map((a) => a.id) },
      },
      { sql: 'SELECT 1 FROM concesion_oauth WHERE id = ?', valores: [concesion] },
    ),
  ]);
  return c.json({
    vuelta: vueltaAlCliente(s.redirect_uri, { code: codigo, state: s.state, iss: emisor }),
  });
}
