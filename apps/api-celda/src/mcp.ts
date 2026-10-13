/**
 * El MCP del cuaderno, solo lectura (HU-C9.7, PLATAFORMA §5.5): para que el asistente de un
 * productor le responda «¿qué nave puedo cosechar hoy?» y «¿qué se aplicó esta semana?».
 *
 * - **Dónde:** en la celda del agro, en `POST /mcp` (Streamable HTTP, JSON-RPC 2.0, sin flujo SSE).
 *   En producción, también en su dominio `mcp.cultivopro.co`, donde solo responde lo del MCP.
 * - **Quién:** solo con un token de agente del CORE (`@ed1/tokens`, emisor de agentes) cuyo `aud`
 *   sea este recurso (CA3), con el alcance `agro:registros:leer`, para esta celda y su shard. Sin
 *   token: 401 con `WWW-Authenticate` y el enlace a los metadatos del recurso (RFC 9728, CA2).
 * - **Revocado es revocado:** en cada solicitud se le pregunta al CORE, por service binding, si la
 *   concesión sigue viva (HU-C9.6). Si el CORE no responde, no se lee (falla cerrado).
 * - **Solo lee.** No hay herramienta de escritura (CA3); llega con HU-C9.8.
 * - **Las mismas cuentas que el cuaderno:** el calendario sale de `@ed1/agro-schema` (P2).
 * - **Kill switch `ks:agro-mcp`:** apagado, el MCP responde 503 y el cuaderno sigue igual.
 */
import {
  type AplicacionParaCarencias,
  type Area,
  calendarioDeAreas,
  estadosDeAplicaciones,
  type InsumoParaCarencias,
} from '@ed1/agro-schema';
import type { BaseD1 } from '@ed1/d1';
import { type ClavePublica, TokenInvalido, verificarAccesoDeAgente } from '@ed1/tokens';
import type { Context, Hono } from 'hono';

export const PROTOCOLOS_MCP = ['2025-06-18', '2025-03-26'] as const;
export const ALCANCE_DE_LECTURA = 'agro:registros:leer';
/** El producto cuyo kill switch apaga el MCP: `ks:agro-mcp`, de `productos.json`. */
export const PRODUCTO_MCP = 'agro-mcp';
const VERSION = '0.1.0';

export interface EnvDelMcp {
  CELDA?: string;
  /** Este recurso (RFC 8707) en este destino, de `productos.json › recursos_oauth`. */
  RECURSO_MCP?: string;
  /** El servidor de autorización: el CORE de este destino, de `celdas.json`. */
  EMISOR_OAUTH?: string;
  CORE?: { concesionVigente(id: string): Promise<boolean> };
  [clave: string]: unknown;
}

interface Dependencias {
  claves: (env: EnvDelMcp) => ClavePublica[];
  shard: (env: EnvDelMcp, nombre: string) => BaseD1 | undefined;
  apagado: (env: EnvDelMcp) => Promise<boolean>;
  ahora: () => number;
}

const metadatosDelRecurso = (env: EnvDelMcp) => ({
  resource: env.RECURSO_MCP,
  authorization_servers: env.EMISOR_OAUTH ? [env.EMISOR_OAUTH] : [],
  scopes_supported: [ALCANCE_DE_LECTURA],
  bearer_methods_supported: ['header'],
  resource_name: 'Cuaderno de campo de CultivoPro',
  resource_documentation: 'https://cultivopro.co/agro/guia/',
});

const tarjetaDelServidor = (env: EnvDelMcp) => ({
  name: 'cuaderno-cultivopro',
  title: 'Cuaderno de campo de CultivoPro',
  description:
    'Lee los registros de tu finca y el calendario de carencias: qué nave puedes cosechar hoy. Solo lee.',
  version: VERSION,
  documentation: 'https://cultivopro.co/agro/guia/',
  protocolVersions: PROTOCOLOS_MCP,
  remotes: [{ type: 'streamable-http', url: `${env.RECURSO_MCP}/mcp` }],
  authentication: {
    type: 'oauth2',
    resource_metadata: `${env.RECURSO_MCP}/.well-known/oauth-protected-resource`,
  },
});

const HERRAMIENTAS = [
  {
    name: 'calendario_de_carencias',
    title: '¿Qué nave puedo cosechar?',
    description:
      'Para cada nave, cama o surco de la finca: si hoy se puede cosechar o entrar, hasta cuándo dura la carencia o la reentrada de lo aplicado, y los días siguientes. Una carencia desconocida nunca sale como «se puede».',
    inputSchema: {
      type: 'object',
      properties: {
        dias: {
          type: 'integer',
          minimum: 1,
          maximum: 14,
          description: 'Días a mostrar desde hoy (1 a 14).',
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'ultimos_registros',
    title: 'Lo último que se anotó',
    description:
      'Los registros vigentes más recientes de la finca (riegos, aplicaciones, cosechas, monitoreos, clima…), del más nuevo al más viejo. Lo corregido no aparece.',
    inputSchema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          description: 'Solo de este tipo, por ejemplo «aplicacion» o «cosecha».',
        },
        limite: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          description: 'Cuántos (1 a 50; 10 si no se dice).',
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
] as const;

type Rpc = {
  jsonrpc: '2.0';
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};
const respuesta = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result });
const falla = (id: Rpc['id'], code: number, message: string) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message },
});

interface Sesion {
  org: string;
  db: BaseD1;
}

async function leerFinca(s: Sesion) {
  const catalogo = await s.db
    .prepare(
      "SELECT entidad, datos FROM catalogo WHERE org_id = ? AND entidad IN ('area', 'insumo')",
    )
    .bind(s.org)
    .all<{ entidad: string; datos: string }>();
  const areas: Area[] = [];
  const insumos = new Map<string, InsumoParaCarencias>();
  for (const f of catalogo.results) {
    const d = JSON.parse(f.datos) as Record<string, unknown>;
    if (f.entidad === 'area') areas.push(d as unknown as Area);
    else insumos.set(String(d['id']), d as unknown as InsumoParaCarencias);
  }
  return { areas, insumos };
}

/** Los ids que una corrección anuló: no cuentan (HU-E3.12). */
async function anulados(s: Sesion): Promise<Set<string>> {
  const { results } = await s.db
    .prepare('SELECT anula_id FROM registro WHERE org_id = ? AND anula_id IS NOT NULL')
    .bind(s.org)
    .all<{ anula_id: string }>();
  return new Set(results.map((r) => r.anula_id));
}

export async function calendarioDelMcp(s: Sesion, dias: number, ahora: Date) {
  const { areas, insumos } = await leerFinca(s);
  const fuera = await anulados(s);
  const { results } = await s.db
    .prepare(
      "SELECT id, instante_evento, fecha_agronomica, area_ids, datos FROM registro WHERE org_id = ? AND tipo = 'aplicacion'",
    )
    .bind(s.org)
    .all<{
      id: string;
      instante_evento: string;
      fecha_agronomica: string;
      area_ids: string;
      datos: string;
    }>();
  const aplicaciones: AplicacionParaCarencias[] = results
    .filter((r) => !fuera.has(r.id))
    .map((r) => ({
      instante_evento: r.instante_evento,
      fecha_agronomica: r.fecha_agronomica,
      area_ids: JSON.parse(r.area_ids) as string[],
      datos: JSON.parse(r.datos) as AplicacionParaCarencias['datos'],
    }));
  const filas = calendarioDeAreas(
    areas,
    estadosDeAplicaciones(aplicaciones, insumos, ahora),
    ahora,
    dias,
  );
  const lineas = filas.map((f) => {
    const avisos = [f.hoy.carencia, f.hoy.reentrada].filter(Boolean).join('; ');
    const hoy =
      f.hoy.color === 'verde'
        ? 'hoy se puede cosechar y entrar'
        : f.hoy.color === 'gris'
          ? 'no se sabe'
          : 'hoy no';
    return `- ${f.nombre}: ${hoy}${avisos ? ` (${avisos})` : ''}`;
  });
  return {
    texto:
      filas.length > 0
        ? `Calendario de carencias:\n${lineas.join('\n')}`
        : 'La finca no tiene naves anotadas.',
    datos: {
      areas: filas.map((f) => ({
        nombre: f.nombre,
        hoy: f.hoy,
        dias: f.dias.map((d) => ({ fecha: d.fecha, color: d.color, entrar_desde: d.entrarDesde })),
      })),
    },
  };
}

export async function ultimosDelMcp(s: Sesion, tipo: string | undefined, limite: number) {
  const { areas } = await leerFinca(s);
  const nombres = new Map(areas.map((a) => [a.id, a.nombre]));
  const fuera = await anulados(s);
  const { results } = await s.db
    .prepare(
      `SELECT id, tipo, fecha_agronomica, instante_evento, area_ids, datos FROM registro
        WHERE org_id = ?${tipo ? ' AND tipo = ?' : ''} ORDER BY instante_evento DESC, id DESC LIMIT ?`,
    )
    .bind(s.org, ...(tipo ? [tipo] : []), limite + fuera.size)
    .all<{
      id: string;
      tipo: string;
      fecha_agronomica: string;
      instante_evento: string;
      area_ids: string;
      datos: string;
    }>();
  const vigentes = results.filter((r) => !fuera.has(r.id)).slice(0, limite);
  const registros = vigentes.map((r) => ({
    fecha: r.fecha_agronomica,
    tipo: r.tipo,
    areas: (JSON.parse(r.area_ids) as string[]).map((id) => nombres.get(id) ?? id),
    datos: JSON.parse(r.datos) as unknown,
  }));
  return {
    texto:
      registros.length > 0
        ? registros.map((r) => `- ${r.fecha} · ${r.tipo} · ${r.areas.join(', ')}`).join('\n')
        : 'No hay registros que mostrar.',
    datos: { registros },
  };
}

function noAutorizado(c: Context, env: EnvDelMcp, error?: string, descripcion?: string) {
  const partes = [`resource_metadata="${env.RECURSO_MCP}/.well-known/oauth-protected-resource"`];
  if (error) partes.push(`error="${error}"`);
  if (descripcion) partes.push(`error_description="${descripcion}"`);
  c.header('www-authenticate', `Bearer ${partes.join(', ')}`);
  return c.json(
    { error: error ?? 'invalid_token', error_description: descripcion ?? 'Falta el token.' },
    401,
  );
}

/** Las rutas del MCP en el Worker de la celda. */
export function rutasDelMcp(app: Hono<{ Bindings: EnvDelMcp }>, dep: Dependencias) {
  // CA1 y RFC 9728: también en la ruta con `/mcp` al final, como la piden algunos clientes.
  for (const ruta of [
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/mcp',
  ]) {
    app.get(ruta, (c) => {
      if (!c.env.RECURSO_MCP) return c.notFound();
      c.header('access-control-allow-origin', '*');
      return c.json(metadatosDelRecurso(c.env));
    });
  }
  app.get('/.well-known/mcp/server-card.json', (c) => {
    if (!c.env.RECURSO_MCP) return c.notFound();
    c.header('access-control-allow-origin', '*');
    return c.json(tarjetaDelServidor(c.env));
  });
  app.get('/mcp', (c) => c.json({ error: 'Este servidor no abre un flujo SSE: usa POST.' }, 405));
  app.post('/mcp', async (c) => {
    const env = c.env;
    if (!env.RECURSO_MCP) return c.notFound();
    if (await dep.apagado(env))
      return c.json(
        falla(null, -32000, 'El asistente del cuaderno está en pausa. El cuaderno sigue igual.'),
        503,
      );
    const token = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return noAutorizado(c, env);
    let r: Awaited<ReturnType<typeof verificarAccesoDeAgente>>;
    try {
      r = await verificarAccesoDeAgente(dep.claves(env), token, env.RECURSO_MCP, dep.ahora());
    } catch (e) {
      if (!(e instanceof TokenInvalido)) throw e;
      return noAutorizado(c, env, 'invalid_token', e.message);
    }
    if (!r.scope.split(' ').includes(ALCANCE_DE_LECTURA))
      return c.json(
        { error: 'insufficient_scope', error_description: `Falta ${ALCANCE_DE_LECTURA}.` },
        403,
      );
    const db = r.celda === env.CELDA ? dep.shard(env, r.shard) : undefined;
    if (!db)
      return c.json(
        { error: 'invalid_token', error_description: 'Esta finca vive en otra celda.' },
        403,
      );
    // HU-C9.6 CA2: quitar el acceso corta la siguiente solicitud. Sin respuesta del CORE, no se lee.
    let vigente = false;
    try {
      vigente = env.CORE ? await env.CORE.concesionVigente(r.cnc) : false;
    } catch {
      return c.json(
        falla(null, -32000, 'No se pudo comprobar el acceso. Intenta en un momento.'),
        503,
      );
    }
    if (!vigente) return noAutorizado(c, env, 'invalid_token', 'Quitaron este acceso.');
    const rpc = (await c.req.json().catch(() => null)) as Rpc | null;
    if (!rpc || Array.isArray(rpc) || rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string')
      return c.json(falla(null, -32600, 'Solicitud JSON-RPC inválida.'), 400);
    // Una notificación no lleva id ni respuesta.
    if (rpc.id === undefined) return c.body(null, 202);
    const s: Sesion = { org: r.org, db };
    switch (rpc.method) {
      case 'initialize': {
        const pedido = String(rpc.params?.['protocolVersion'] ?? '');
        const version = (PROTOCOLOS_MCP as readonly string[]).includes(pedido)
          ? pedido
          : PROTOCOLOS_MCP[0];
        return c.json(
          respuesta(rpc.id, {
            protocolVersion: version,
            capabilities: { tools: { listChanged: false } },
            serverInfo: {
              name: 'cuaderno-cultivopro',
              title: 'Cuaderno de campo de CultivoPro',
              version: VERSION,
            },
            instructions:
              'Lee los registros de la finca y el calendario de carencias. Solo lee: para anotar, la persona usa el cuaderno.',
          }),
        );
      }
      case 'ping':
        return c.json(respuesta(rpc.id, {}));
      case 'tools/list':
        return c.json(respuesta(rpc.id, { tools: HERRAMIENTAS }));
      case 'tools/call': {
        const nombre = rpc.params?.['name'];
        const args = (rpc.params?.['arguments'] ?? {}) as Record<string, unknown>;
        const entero = (v: unknown, min: number, max: number, def: number) =>
          Number.isInteger(v) ? Math.min(max, Math.max(min, v as number)) : def;
        let resultado: { texto: string; datos: unknown };
        if (nombre === 'calendario_de_carencias') {
          resultado = await calendarioDelMcp(
            s,
            entero(args['dias'], 1, 14, 7),
            new Date(dep.ahora()),
          );
        } else if (nombre === 'ultimos_registros') {
          const tipo = typeof args['tipo'] === 'string' && args['tipo'] ? args['tipo'] : undefined;
          resultado = await ultimosDelMcp(s, tipo, entero(args['limite'], 1, 50, 10));
        } else {
          return c.json(falla(rpc.id, -32602, `No existe la herramienta ${String(nombre)}.`));
        }
        return c.json(
          respuesta(rpc.id, {
            content: [{ type: 'text', text: resultado.texto }],
            structuredContent: resultado.datos,
          }),
        );
      }
      default:
        return c.json(falla(rpc.id, -32601, `Método desconocido: ${rpc.method}`));
    }
  });
}

/**
 * En el dominio propio del MCP solo responde lo del MCP: la API de sincronización del cuaderno no
 * se publica ahí.
 */
export const soloLoDelMcp = (recurso: string | undefined, url: string): boolean => {
  if (!recurso) return true;
  const u = new URL(url);
  const delRecurso = new URL(recurso).host;
  // En staging el recurso es la misma celda en workers.dev: ahí vive todo junto.
  if (u.host !== delRecurso || delRecurso.endsWith('.workers.dev')) return true;
  return u.pathname === '/mcp' || u.pathname.startsWith('/.well-known/');
};
