/**
 * El MCP del comercio (HU-T15.7, TIENDA-3.0 §1.2 y §1.4, PLATAFORMA §5.4 y §5.5): para que el
 * asistente de un comerciante le diga qué pedidos tiene por despachar y le ayude con el inventario.
 *
 * - **Dónde:** `POST /mcp` en el origen del panel (en producción, `mcp.tiendapro.co`),
 *   que el Worker del panel pasa a la API sin tienda resuelta. El del comprador llega por el
 *   despacho, con la tienda en `x-tienda` (`mcp-publico.ts`): así no se confunden.
 * - **Quién:** solo con un token de agente del CORE cuyo `aud` sea este recurso (RFC 8707) y los
 *   alcances que el comerciante concedió (CA1), para esta celda y su shard. Sin token: 401 con
 *   `WWW-Authenticate` y los metadatos del recurso (RFC 9728). Un token de otro recurso se rechaza
 *   (CA2). Revocar corta la siguiente solicitud: se le pregunta al CORE por la concesión.
 * - **Solo en el plan IA Pro** (`mcp_del_comercio` de `content/tienda/funciones.json`, CA2 y
 *   HU-T18.3).
 * - **Nada mueve dinero ni lee llaves o datos de compradores** (CA2): pedidos sin su contacto,
 *   estados por las mismas funciones del panel (con su versión, su registro y sus reglas) e
 *   inventario por su ajuste. Lo hace a nombre de `agente:<concesión>`, que queda en el registro.
 * - Crear, editar y publicar el catálogo quedan para después: no se declara un alcance que no
 *   existe (P1).
 * - `ks:tienda-mcp` lo apaga, como al del comprador, sin tocar la tienda.
 */
import type { BaseD1 } from '@ed1/d1';
import { type FuncionesPorPlan, funcionesDelPlan } from '@ed1/tienda-schema';
import { type ClavePublica, TokenInvalido, verificarAccesoDeAgente } from '@ed1/tokens';
import type { Context } from 'hono';
import { z } from 'zod';
import funciones from '../../../content/tienda/funciones.json' with { type: 'json' };
import { confirmarPedido } from './bandeja.ts';
import type { Quien, Resultado } from './catalogo.ts';
import { despacharPedido, entregarPedido } from './ciclo.ts';
import { ajustarInventario, listarInventario } from './inventario.ts';
import { PROTOCOLOS_MCP } from './mcp-publico.ts';

export const ALCANCES_DEL_COMERCIO = {
  pedidosLeer: 'tienda:pedidos:leer',
  pedidosEstado: 'tienda:pedidos:estado',
  inventarioLeer: 'tienda:inventario:leer',
  inventarioAjustar: 'tienda:inventario:ajustar',
} as const;
const VERSION = '1.0.0';

export interface EnvDelMcpDelComercio {
  CELDA?: string;
  /** Este recurso (RFC 8707) en este destino, de `productos.json › recursos_oauth` de la Tienda. */
  RECURSO_MCP_COMERCIO?: string;
  /** El servidor de autorización: el CORE de este destino. */
  EMISOR_OAUTH?: string;
  CORE?: { concesionVigente(id: string): Promise<boolean> };
  [clave: string]: unknown;
}

const SHARD = /^tienda_c[0-9]+_s[0-9]+$/;
const ESTADOS = [
  'por_despachar',
  'pendiente',
  'por_pagar',
  'despachado',
  'entregado',
  'cancelado',
] as const;
const EN_PALABRAS: Record<string, string> = {
  pendiente: 'Pendiente',
  por_pagar: 'Por pagar',
  confirmado: 'Confirmado',
  pagado: 'Pagado',
  despachado: 'Despachado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  devuelto: 'Devuelto',
};

const ENTRADAS = {
  pedidos: z.object({
    estado: z
      .enum(ESTADOS)
      .optional()
      .describe('«por_despachar» (confirmados y pagados) si no se dice.'),
    limite: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('Cuántos (1 a 50; 20 si no se dice).'),
  }),
  ver_pedido: z.object({
    numero: z.number().int().min(1001).describe('El número del pedido, como #1001.'),
  }),
  cambiar_estado_del_pedido: z.object({
    numero: z.number().int().min(1001),
    version: z
      .number()
      .int()
      .min(1)
      .describe('La versión que dio ver_pedido: si cambió, no se toca.'),
    a: z.enum(['confirmado', 'despachado', 'entregado']),
    transportadora: z.string().trim().max(80).optional(),
    guia: z.string().trim().max(60).optional(),
  }),
  inventario: z.object({
    buscar: z.string().trim().max(80).optional(),
    limite: z.number().int().min(1).max(50).optional(),
  }),
  ajustar_inventario: z.object({
    variante: z.string().min(1).max(64).describe('El id de la combinación, de inventario.'),
    version: z.number().int().min(1),
    cantidad: z
      .number()
      .int()
      .min(-100_000)
      .max(100_000)
      .refine((n) => n !== 0)
      .describe('Cuántas entran (+) o salen (−).'),
  }),
} as const;
type Herramienta = keyof typeof ENTRADAS;

const DE: Record<
  Herramienta,
  { alcance: string; title: string; description: string; leer: boolean }
> = {
  pedidos: {
    alcance: ALCANCES_DEL_COMERCIO.pedidosLeer,
    title: 'Pedidos',
    description:
      'Los pedidos de la tienda por estado, del más nuevo al más viejo: por defecto, los que están por despachar. Sin datos de los compradores.',
    leer: true,
  },
  ver_pedido: {
    alcance: ALCANCES_DEL_COMERCIO.pedidosLeer,
    title: 'Ver un pedido',
    description:
      'Un pedido con sus líneas, su total, su forma de pago, su envío y su versión. Sin los datos de entrega del comprador.',
    leer: true,
  },
  cambiar_estado_del_pedido: {
    alcance: ALCANCES_DEL_COMERCIO.pedidosEstado,
    title: 'Cambiar el estado de un pedido',
    description:
      'Confirma, despacha (con su transportadora y su guía) o entrega un pedido, con las mismas reglas del panel. No cobra, no reembolsa ni cancela.',
    leer: false,
  },
  inventario: {
    alcance: ALCANCES_DEL_COMERCIO.inventarioLeer,
    title: 'Inventario',
    description:
      'Las combinaciones con sus unidades, las apartadas por pagos en curso y cuántas personas esperan aviso.',
    leer: true,
  },
  ajustar_inventario: {
    alcance: ALCANCES_DEL_COMERCIO.inventarioAjustar,
    title: 'Ajustar el inventario',
    description: 'Suma o resta unidades de una combinación, con su versión. Queda en su libro.',
    leer: false,
  },
};

const herramientas = (concedidos: readonly string[]) =>
  (Object.keys(ENTRADAS) as Herramienta[])
    .filter((n) => concedidos.includes(DE[n].alcance))
    .map((name) => {
      const { $schema: _, ...inputSchema } = z.toJSONSchema(ENTRADAS[name], {
        target: 'draft-2020-12',
        io: 'input',
        unrepresentable: 'any',
      }) as Record<string, unknown>;
      return {
        name,
        title: DE[name].title,
        description: DE[name].description,
        inputSchema,
        annotations: { readOnlyHint: DE[name].leer, destructiveHint: false, openWorldHint: false },
      };
    });

const pesos = (n: number) => `$${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
type Salida = { texto: string; datos: Record<string, unknown>; error?: true };
const error = (texto: string): Salida => ({ texto, datos: {}, error: true });

async function listarPedidosDelComercio(
  q: Quien,
  a: z.infer<(typeof ENTRADAS)['pedidos']>,
): Promise<Salida> {
  const estados = !a.estado || a.estado === 'por_despachar' ? ['confirmado', 'pagado'] : [a.estado];
  const limite = a.limite ?? 20;
  const filas: {
    numero: number;
    estado: string;
    forma_pago: string;
    total_cop: number;
    creado: string;
    articulos: number;
  }[] = [];
  for (const estado of estados) {
    const { results } = await q.db
      .prepare(
        `SELECT p.numero, p.estado, p.forma_pago, p.total_cop, p.creado,
           (SELECT SUM(l.cantidad) FROM pedido_linea l WHERE l.org_id = ? AND l.pedido_id = p.id) AS articulos
         FROM pedido p INDEXED BY pedido_por_estado WHERE p.org_id = ? AND p.estado = ?
         ORDER BY p.creado DESC LIMIT ?`,
      )
      .bind(q.org, q.org, estado, limite)
      .all<(typeof filas)[number]>();
    filas.push(...results);
  }
  const pedidos = filas
    .sort((x, y) => (x.creado < y.creado ? 1 : -1))
    .slice(0, limite)
    .map((f) => ({
      numero: f.numero,
      estado: f.estado,
      forma: f.forma_pago,
      total: f.total_cop,
      articulos: f.articulos ?? 0,
      creado: f.creado,
    }));
  return {
    texto:
      pedidos.length > 0
        ? pedidos
            .map(
              (p) =>
                `- #${p.numero} · ${EN_PALABRAS[p.estado] ?? p.estado} · ${pesos(p.total)} · ${p.articulos} artículo(s)`,
            )
            .join('\n')
        : 'No hay pedidos en ese estado.',
    datos: { pedidos },
  };
}

interface FilaDelPedido {
  id: string;
  numero: number;
  codigo: string;
  estado: string;
  canal: string;
  forma_pago: string;
  subtotal_cop: number;
  descuento_cop: number;
  envio_cop: number;
  total_cop: number;
  envio_nombre: string | null;
  ciudad: string | null;
  transportadora: string | null;
  guia: string | null;
  aceptado: string | null;
  version: number;
}
const porNumero = (q: Quien, numero: number) =>
  q.db
    .prepare(
      `SELECT id, numero, codigo, estado, canal, forma_pago, subtotal_cop, descuento_cop, envio_cop, total_cop,
         envio_nombre, ciudad, transportadora, guia, aceptado, version FROM pedido WHERE org_id = ? AND numero = ?`,
    )
    .bind(q.org, numero)
    .first<FilaDelPedido>();

async function verPedidoDelComercio(
  q: Quien,
  a: z.infer<(typeof ENTRADAS)['ver_pedido']>,
): Promise<Salida> {
  const p = await porNumero(q, a.numero);
  if (!p) return error(`No hay un pedido #${a.numero}.`);
  const { results: lineas } = await q.db
    .prepare(
      'SELECT variante_id, nombre, opciones, cantidad, total_cop FROM pedido_linea WHERE org_id = ? AND pedido_id = ? ORDER BY linea',
    )
    .bind(q.org, p.id)
    .all<{
      variante_id: string;
      nombre: string;
      opciones: string;
      cantidad: number;
      total_cop: number;
    }>();
  const esperaAlComprador = p.canal === 'agente' && p.aceptado === null && p.estado === 'pendiente';
  return {
    texto: [
      `Pedido #${p.numero} (${p.codigo}) · ${EN_PALABRAS[p.estado] ?? p.estado} · ${pesos(p.total_cop)} · versión ${p.version}`,
      ...lineas.map(
        (l) =>
          `- ${l.cantidad} × ${l.nombre}${l.opciones ? ` (${l.opciones})` : ''}: ${pesos(l.total_cop)}`,
      ),
      ...(esperaAlComprador
        ? ['Lo preparó el asistente de un cliente: espera que tu cliente lo confirme.']
        : []),
    ].join('\n'),
    datos: {
      numero: p.numero,
      codigo: p.codigo,
      estado: p.estado,
      forma: p.forma_pago,
      subtotal: p.subtotal_cop,
      descuento: p.descuento_cop,
      envio: p.envio_cop,
      total: p.total_cop,
      envioNombre: p.envio_nombre,
      ciudad: p.ciudad,
      transportadora: p.transportadora,
      guia: p.guia,
      version: p.version,
      esperaAlComprador,
      lineas: lineas.map((l) => ({
        variante: l.variante_id,
        nombre: l.nombre,
        opciones: l.opciones,
        cantidad: l.cantidad,
        total: l.total_cop,
      })),
    },
  };
}

/** Lo que respondió una función del panel, para el agente. */
function delPanel(r: Resultado, hecho: string): Salida {
  if (r.estado === 'guardado') return { texto: hecho, datos: { hecho: true, version: r.version } };
  if (r.estado === 'problemas') return error(r.problemas.map((p) => p.mensaje).join(' '));
  return error('motivo' in r && typeof r.motivo === 'string' ? r.motivo : 'No se pudo.');
}

async function cambiarEstado(
  q: Quien,
  a: z.infer<(typeof ENTRADAS)['cambiar_estado_del_pedido']>,
): Promise<Salida> {
  const p = await porNumero(q, a.numero);
  if (!p) return error(`No hay un pedido #${a.numero}.`);
  // HU-T15.5: lo que preparó el asistente de un cliente lo confirma primero el cliente.
  if (p.canal === 'agente' && p.aceptado === null)
    return error('Lo preparó el asistente de un cliente: espera que tu cliente lo confirme.');
  const base = { op: crypto.randomUUID(), pedido: p.id, version: a.version };
  if (a.a === 'confirmado')
    return delPanel(await confirmarPedido(q, base), `Pedido #${p.numero} confirmado.`);
  if (a.a === 'despachado')
    return delPanel(
      await despacharPedido(q, {
        ...base,
        ...(a.transportadora ? { transportadora: a.transportadora } : {}),
        ...(a.guia ? { guia: a.guia } : {}),
      }),
      `Pedido #${p.numero} despachado.`,
    );
  return delPanel(await entregarPedido(q, base), `Pedido #${p.numero} entregado.`);
}

async function inventarioDelComercio(
  q: Quien,
  a: z.infer<(typeof ENTRADAS)['inventario']>,
): Promise<Salida> {
  const r = await listarInventario(q, {
    ...(a.buscar ? { buscar: a.buscar } : {}),
    limite: a.limite ?? 20,
  });
  return {
    texto:
      r.filas.length > 0
        ? r.filas
            .map(
              (f) =>
                `- ${f.nombre}${f.combinacion ? ` (${f.combinacion})` : ''} [${f.variante}, versión ${f.version}]: ${f.stock === null ? 'sin contar' : `${f.stock} unidades`}${f.apartadas > 0 ? `, ${f.apartadas} apartadas` : ''}${f.esperan > 0 ? `, ${f.esperan} esperan aviso` : ''}`,
            )
            .join('\n')
        : 'No hay combinaciones que coincidan.',
    datos: { combinaciones: r.filas, total: r.total },
  };
}

async function ajustar(
  q: Quien,
  a: z.infer<(typeof ENTRADAS)['ajustar_inventario']>,
): Promise<Salida> {
  return delPanel(
    await ajustarInventario(q, {
      op: crypto.randomUUID(),
      variante: a.variante,
      version: a.version,
      tipo: 'ajuste',
      cantidad: a.cantidad,
    }),
    `Inventario de ${a.variante} ajustado en ${a.cantidad > 0 ? '+' : ''}${a.cantidad}.`,
  );
}

const metadatos = (env: EnvDelMcpDelComercio) => ({
  resource: env.RECURSO_MCP_COMERCIO,
  authorization_servers: env.EMISOR_OAUTH ? [env.EMISOR_OAUTH] : [],
  scopes_supported: Object.values(ALCANCES_DEL_COMERCIO),
  bearer_methods_supported: ['header'],
  resource_name: 'Tu tienda en TiendaPro',
});

/** RFC 9728 y la tarjeta del servidor (PLATAFORMA §5.5); `null` si este destino no tiene el recurso. */
export function documentoDelMcpDelComercio(
  env: EnvDelMcpDelComercio,
  cual: 'recurso' | 'tarjeta',
): Record<string, unknown> | null {
  if (!env.RECURSO_MCP_COMERCIO) return null;
  if (cual === 'recurso') return metadatos(env);
  return {
    name: 'tienda-del-comercio',
    title: 'Tu tienda',
    description:
      'Tus pedidos por despachar y tu inventario, para tu asistente. Solo con tu permiso, y nada mueve dinero.',
    version: VERSION,
    protocolVersions: PROTOCOLOS_MCP,
    remotes: [{ type: 'streamable-http', url: `${env.RECURSO_MCP_COMERCIO}/mcp` }],
    authentication: {
      type: 'oauth2',
      resource_metadata: `${env.RECURSO_MCP_COMERCIO}/.well-known/oauth-protected-resource`,
    },
  };
}

function noAutorizado(
  c: Context,
  env: EnvDelMcpDelComercio,
  codigo?: string,
  descripcion?: string,
) {
  const partes = [
    `resource_metadata="${env.RECURSO_MCP_COMERCIO}/.well-known/oauth-protected-resource"`,
  ];
  if (codigo) partes.push(`error="${codigo}"`);
  if (descripcion) partes.push(`error_description="${descripcion}"`);
  c.header('www-authenticate', `Bearer ${partes.join(', ')}`);
  return c.json(
    { error: codigo ?? 'invalid_token', error_description: descripcion ?? 'Falta el token.' },
    401,
  );
}

type Rpc = {
  jsonrpc?: unknown;
  id?: string | number | null;
  method?: unknown;
  params?: Record<string, unknown>;
};
const respuesta = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result });
const falla = (id: Rpc['id'], code: number, message: string) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message },
});

/** `POST /mcp` sin tienda resuelta: el MCP del comercio. */
export async function atenderMcpDelComercio(
  c: Context<{ Bindings: EnvDelMcpDelComercio }>,
  dep: {
    claves: ClavePublica[];
    ahora: number;
    apagado: () => Promise<boolean>;
    /** `ks:tienda` apagado: se lee, no se cambia nada. */
    soloLectura: () => Promise<boolean>;
  },
): Promise<Response> {
  const env = c.env;
  if (!env.RECURSO_MCP_COMERCIO) return c.json({ estado: 'no-existe' }, 404);
  if (await dep.apagado())
    return c.json(
      falla(null, -32000, 'El asistente de tu tienda está en pausa. Tu tienda sigue igual.'),
      503,
    );
  const token = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return noAutorizado(c, env);
  let r: Awaited<ReturnType<typeof verificarAccesoDeAgente>>;
  try {
    r = await verificarAccesoDeAgente(dep.claves, token, env.RECURSO_MCP_COMERCIO, dep.ahora);
  } catch (e) {
    if (!(e instanceof TokenInvalido)) throw e;
    return noAutorizado(c, env, 'invalid_token', e.message);
  }
  const db =
    r.celda === env.CELDA && SHARD.test(r.shard) ? (env[r.shard] as BaseD1 | undefined) : undefined;
  if (!db)
    return c.json(
      { error: 'invalid_token', error_description: 'Esta tienda vive en otra celda.' },
      403,
    );
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
  // CA2: solo en el plan IA Pro (HU-T18.3).
  const tienda = await db
    .prepare('SELECT plan FROM tienda WHERE org_id = ?')
    .bind(r.org)
    .first<{ plan: string }>();
  const delPlan = tienda
    ? funcionesDelPlan(funciones as unknown as FuncionesPorPlan, tienda.plan)
    : null;
  if (delPlan?.['mcp_del_comercio'] !== true)
    return c.json(
      {
        error: 'insufficient_scope',
        error_description: 'El asistente de tu tienda es del plan IA Pro.',
      },
      403,
    );
  const rpc = (await c.req.json().catch(() => null)) as Rpc | null;
  if (!rpc || Array.isArray(rpc) || rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string')
    return c.json(falla(null, -32600, 'Solicitud JSON-RPC inválida.'), 400);
  if (rpc.id === undefined) return c.body(null, 202);
  const concedidos = r.scope.split(' ').filter(Boolean);
  const q: Quien = {
    db,
    org: r.org,
    actor: `agente:${r.cnc}`,
    instante: new Date(dep.ahora).toISOString(),
  };
  switch (rpc.method) {
    case 'initialize': {
      const pedida = String(rpc.params?.['protocolVersion'] ?? '');
      return c.json(
        respuesta(rpc.id, {
          protocolVersion: (PROTOCOLOS_MCP as readonly string[]).includes(pedida)
            ? pedida
            : PROTOCOLOS_MCP[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'tienda-del-comercio', title: 'Tu tienda', version: VERSION },
          instructions:
            'Lees los pedidos y el inventario de la tienda, y con permiso cambias el estado de un pedido o ajustas unidades. Nada cobra, reembolsa ni muestra los datos de los compradores.',
        }),
      );
    }
    case 'ping':
      return c.json(respuesta(rpc.id, {}));
    case 'tools/list':
      return c.json(respuesta(rpc.id, { tools: herramientas(concedidos) }));
    case 'tools/call': {
      const nombre = rpc.params?.['name'];
      if (typeof nombre !== 'string' || !(nombre in ENTRADAS))
        return c.json(falla(rpc.id, -32602, `No existe la herramienta ${String(nombre)}.`));
      const h = nombre as Herramienta;
      if (!concedidos.includes(DE[h].alcance))
        return c.json(falla(rpc.id, -32001, `Falta el permiso ${DE[h].alcance}.`));
      if (!DE[h].leer && (await dep.soloLectura()))
        return c.json(
          falla(rpc.id, -32000, 'La tienda está en pausa unos minutos: se puede leer, no cambiar.'),
        );
      const args = ENTRADAS[h].safeParse(rpc.params?.['arguments'] ?? {});
      if (!args.success)
        return c.json(falla(rpc.id, -32602, `Los argumentos de ${h} no cumplen su esquema.`));
      const d = args.data as never;
      const salida =
        h === 'pedidos'
          ? await listarPedidosDelComercio(q, d)
          : h === 'ver_pedido'
            ? await verPedidoDelComercio(q, d)
            : h === 'cambiar_estado_del_pedido'
              ? await cambiarEstado(q, d)
              : h === 'inventario'
                ? await inventarioDelComercio(q, d)
                : await ajustar(q, d);
      return c.json(
        respuesta(rpc.id, {
          content: [{ type: 'text', text: salida.texto }],
          structuredContent: salida.datos,
          ...(salida.error ? { isError: true } : {}),
        }),
      );
    }
    default:
      return c.json(falla(rpc.id, -32601, `Método desconocido: ${rpc.method}`));
  }
}
