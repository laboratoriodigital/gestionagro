/**
 * El MCP público de una tienda (HU-T15.4, TIENDA-3.0 §13.4, PLATAFORMA §5.5 a §5.7): para que el
 * asistente de un comprador busque, consulte y le deje listo un pedido que **la persona** confirma.
 *
 * - **Dónde:** `POST https://<tienda>/mcp`, que el despacho pasa a la API con la tienda resuelta
 *   (Streamable HTTP, JSON-RPC 2.0, sin sesión ni flujo SSE). Su tarjeta se hornea en
 *   `/.well-known/mcp/server-card.json`. Sin autenticación: es lo mismo que ve un comprador.
 * - **Solo si el comercio lo encendió** (`agentes.mcp`); si no, no existe.
 * - **Buscar y ver leen lo horneado** (`catalogo.json` y el gemelo de la ficha, en R2), no D1 (CA1).
 *   Consultar la disponibilidad es la cotización del carrito (HU-T5.5).
 * - **Preparar el pedido** (CA2) deja un pedido `pendiente` de canal `agente`, sin datos de nadie ni
 *   aceptación, con el enlace `/pedido/confirmar/#c=<código>&s=<secreto>` para que la persona lo
 *   revise, acepte los términos y pague (HU-T15.5). El secreto nace aquí y solo queda su huella.
 * - **CA3:** los agentes no apartan unidades; preparar tiene su límite por IP y cada tienda, como
 *   mucho 50 pendientes de agente; ninguna herramienta mueve dinero; `ks:tienda-mcp` lo apaga sin
 *   tocar la tienda, y con `ks:tienda` apagado se lee pero no se prepara.
 */
import type { BaseD1 } from '@ed1/d1';
import { LIMITES } from '@ed1/dinero';
import { buscar } from '@ed1/tienda-horno/buscar';
import { z } from 'zod';
import { type Cotizacion, cotizar } from './cotizar.ts';
import {
  datosDeLaTienda,
  lineasDelPedido,
  PeticionDeSeguimiento,
  prepararPedido,
  seguimiento,
  sha256,
} from './pedidos.ts';
import type { Almacen } from './publicar.ts';

export const PROTOCOLOS_MCP = ['2025-06-18', '2025-03-26'] as const;
/** CA3: los pendientes de agente que puede tener una tienda a la vez. */
export const PENDIENTES_DE_AGENTE_POR_TIENDA = 50;
const VERSION = '1.0.0';
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const INSTRUCCIONES = [
  'Buscas productos de esta tienda, consultas su disponibilidad y preparas pedidos.',
  'El pago y la aceptación de los términos los hace siempre la persona: entrégale el enlace que devuelve preparar_pedido, sin abrirlo tú.',
  'Los precios son en pesos colombianos e incluyen IVA.',
  'Hay derecho de retracto, salvo en los productos que dicen que no lo tienen.',
  'Un pedido preparado que nadie confirma se cancela solo a las 48 horas.',
].join(' ');

const Lineas = z
  .array(
    z.object({
      variante: z.string().min(1).max(64).describe('El id de la combinación, de ver_producto.'),
      cantidad: z.number().int().min(1).max(LIMITES.unidadesPorLinea),
    }),
  )
  .min(1)
  .max(LIMITES.lineas);

const ENTRADAS = {
  buscar_productos: z.object({
    consulta: z.string().trim().max(100).optional().describe('Palabras a buscar en el nombre.'),
    coleccion: z.string().max(64).optional().describe('Solo de esta categoría (su slug).'),
    max_precio: z.number().int().min(0).optional().describe('Hasta este precio, en pesos.'),
    limite: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe('Cuántos (1 a 20; 10 si no se dice).'),
  }),
  ver_producto: z.object({
    producto: z.string().min(1).max(80).describe('El slug del producto, de buscar_productos.'),
  }),
  consultar_disponibilidad: z.object({
    items: Lineas,
    envio: z.string().min(1).max(64).optional(),
    cupon: z.string().trim().min(1).max(24).optional(),
  }),
  preparar_pedido: z.object({
    items: Lineas,
    envio: z
      .string()
      .min(1)
      .max(64)
      .optional()
      .describe('El id de la opción de envío, si se sabe.'),
    ciudad: z.string().trim().min(1).max(60).optional(),
    cupon: z.string().trim().min(1).max(24).optional(),
  }),
  seguimiento_de_pedido: PeticionDeSeguimiento,
} as const;
type Herramienta = keyof typeof ENTRADAS;

const DESCRIPCIONES: Record<Herramienta, { title: string; description: string; leer: boolean }> = {
  buscar_productos: {
    title: 'Buscar productos',
    description:
      'Los productos de la tienda que tienen las palabras buscadas (sin distinguir tildes), con su precio desde, si hay disponibles y su dirección. Lee el catálogo publicado.',
    leer: true,
  },
  ver_producto: {
    title: 'Ver un producto',
    description:
      'La ficha de un producto: su descripción, lo que hay que saber antes de comprar (envío, retracto, garantía) y sus combinaciones, cada una con su id, su precio y si hay disponibles.',
    leer: true,
  },
  consultar_disponibilidad: {
    title: 'Consultar la disponibilidad',
    description:
      'Cotiza unas combinaciones como el carrito de la tienda: el total con el envío y el descuento, los avisos de lo que cambió y el carrito corregido. No aparta unidades.',
    leer: true,
  },
  preparar_pedido: {
    title: 'Preparar un pedido',
    description:
      'Deja un pedido pendiente, sin datos de la persona, y devuelve el enlace para que ella lo revise, acepte los términos y elija cómo pagar. No aparta unidades ni cobra nada.',
    leer: false,
  },
  seguimiento_de_pedido: {
    title: 'Seguir un pedido',
    description:
      'En qué va un pedido, con su código y el secreto de su enlace (el que llega en el enlace de preparar_pedido o de seguimiento).',
    leer: true,
  },
};

/** Las herramientas, con su esquema de entrada sacado del mismo zod que valida (P2). */
export const HERRAMIENTAS = (Object.keys(ENTRADAS) as Herramienta[]).map((name) => {
  const { $schema: _, ...inputSchema } = z.toJSONSchema(ENTRADAS[name], {
    target: 'draft-2020-12',
    io: 'input',
  }) as Record<string, unknown>;
  return {
    name,
    title: DESCRIPCIONES[name].title,
    description: DESCRIPCIONES[name].description,
    inputSchema,
    annotations: DESCRIPCIONES[name].leer
      ? { readOnlyHint: true, openWorldHint: false }
      : {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
  };
});

export interface ContextoDelMcp {
  db: BaseD1;
  org: string;
  /** El host de la tienda, para los enlaces. */
  host: string;
  ahora: string;
  sitios: Almacen | undefined;
  /** CA3: si la IP puede preparar otro pedido ahora. */
  puedePreparar: () => Promise<boolean>;
  /** `ks:tienda` apagado: se lee, no se escribe. */
  soloLectura: () => Promise<boolean>;
  /** Un id nuevo (UUID) y bytes al azar; las pruebas los fijan. */
  id: () => string;
  azar: (n: number) => Uint8Array;
}

interface ProductoDelCatalogo {
  slug: string;
  nombre: string;
  url: string;
  variantes: { id: string; opciones?: string; precioCop: number; disponible: boolean }[];
}
interface Catalogo {
  tienda: { nombre: string; url: string };
  colecciones?: { slug: string; nombre: string; productos: string[] }[];
  productos: ProductoDelCatalogo[];
}

/** El manifiesto de cada versión publicada no cambia nunca: se guarda en memoria. */
const manifiestos = new Map<string, Record<string, { huella: string }>>();
const catalogos = new Map<string, Catalogo>();
const recordar = <V>(m: Map<string, V>, clave: string, valor: V) => {
  if (m.size >= 50) m.delete(m.keys().next().value as string);
  m.set(clave, valor);
};

/** Un archivo de la versión publicada de la tienda; `null` si no está o no publicó. */
async function publicado(c: ContextoDelMcp, ruta: string): Promise<string | null> {
  if (!c.sitios) return null;
  const t = await c.db
    .prepare('SELECT version_publicada FROM tienda WHERE org_id = ?')
    .bind(c.org)
    .first<{ version_publicada: number | null }>();
  if (!t?.version_publicada) return null;
  const clave = `${c.org}:${t.version_publicada}`;
  let archivos = manifiestos.get(clave);
  if (!archivos) {
    const m = await c.sitios.get(`sitios/${c.org}/${t.version_publicada}/manifiesto.json`);
    if (!m) return null;
    archivos = (JSON.parse(await m.text()) as { archivos: Record<string, { huella: string }> })
      .archivos;
    recordar(manifiestos, clave, archivos);
  }
  const h = archivos[ruta]?.huella;
  if (!h) return null;
  const o = await c.sitios.get(`objetos/${h.slice(0, 2)}/${h}`);
  return o ? o.text() : null;
}

async function catalogoDe(c: ContextoDelMcp): Promise<Catalogo | null> {
  const t = await c.db
    .prepare('SELECT version_publicada FROM tienda WHERE org_id = ?')
    .bind(c.org)
    .first<{ version_publicada: number | null }>();
  const clave = `${c.org}:${t?.version_publicada ?? 0}`;
  const guardado = catalogos.get(clave);
  if (guardado) return guardado;
  const texto = await publicado(c, '/catalogo.json');
  if (!texto) return null;
  const catalogo = JSON.parse(texto) as Catalogo;
  recordar(catalogos, clave, catalogo);
  return catalogo;
}

const pesos = (n: number) => `$${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const desde = (p: ProductoDelCatalogo) => Math.min(...p.variantes.map((v) => v.precioCop));
const caminoDe = (url: string) => new URL(url).pathname;

type Salida = { texto: string; datos: Record<string, unknown>; error?: true };
const error = (texto: string): Salida => ({ texto, datos: {}, error: true });

/** Los avisos de una cotización, en palabras para el agente. */
function avisos(cot: Cotizacion): string[] {
  return cot.avisos.map((a) => {
    switch (a.codigo) {
      case 'linea_quitada':
        return `La combinación ${a.variante} no se puede pedir: no existe o está agotada.`;
      case 'cantidad_ajustada':
        return `De la combinación ${a.variante} solo hay ${a.cantidad}.`;
      case 'cupon_invalido':
        return 'El cupón no es válido.';
      case 'cupon_bajo_el_minimo':
        return 'El cupón pide una compra mayor.';
      case 'envio_invalido':
        return 'Esa opción de envío no existe.';
      case 'carrito_vacio':
        return 'No queda nada que pedir.';
      default:
        return 'El total cambió.';
    }
  });
}

const resumen = (cot: Cotizacion) => ({
  subtotal: cot.subtotal,
  descuento: cot.descuento,
  envio: cot.envio,
  total: cot.total,
  cobrableEnLinea: cot.cobrable,
  carrito: cot.carrito,
  avisos: avisos(cot),
});

async function buscarProductos(
  c: ContextoDelMcp,
  a: z.infer<(typeof ENTRADAS)['buscar_productos']>,
): Promise<Salida> {
  const cat = await catalogoDe(c);
  if (!cat) return error('La tienda todavía no ha publicado su catálogo.');
  let lista = cat.productos;
  if (a.coleccion) {
    const col = cat.colecciones?.find((x) => x.slug === a.coleccion);
    if (!col) return error(`No hay una categoría «${a.coleccion}».`);
    const suyos = new Set(col.productos);
    lista = lista.filter((p) => suyos.has(p.slug));
  }
  if (a.consulta?.trim()) lista = buscar(lista, a.consulta);
  if (a.max_precio !== undefined) lista = lista.filter((p) => desde(p) <= (a.max_precio ?? 0));
  const elegidos = lista.slice(0, a.limite ?? 10).map((p) => ({
    producto: p.slug,
    nombre: p.nombre,
    url: p.url,
    precioDesde: desde(p),
    disponible: p.variantes.some((v) => v.disponible),
  }));
  return {
    texto:
      elegidos.length > 0
        ? elegidos
            .map(
              (p) =>
                `- ${p.nombre} (${p.producto}): desde ${pesos(p.precioDesde)}${p.disponible ? '' : ', agotado'}`,
            )
            .join('\n')
        : 'No hay productos que coincidan.',
    datos: {
      productos: elegidos,
      ...(cat.colecciones
        ? { colecciones: cat.colecciones.map(({ slug, nombre }) => ({ slug, nombre })) }
        : {}),
    },
  };
}

async function verProducto(
  c: ContextoDelMcp,
  a: z.infer<(typeof ENTRADAS)['ver_producto']>,
): Promise<Salida> {
  const cat = await catalogoDe(c);
  const p = cat?.productos.find((x) => x.slug === a.producto);
  if (!p) return error(`No hay un producto «${a.producto}». Búscalo con buscar_productos.`);
  const ficha = (await publicado(c, `${caminoDe(p.url)}index.md`)) ?? `# ${p.nombre}`;
  const variantes = p.variantes.map((v) => ({
    id: v.id,
    opciones: v.opciones ?? '',
    precio: v.precioCop,
    disponible: v.disponible,
  }));
  return {
    texto: `${ficha.trim()}\n\n## Combinaciones\n\n${variantes
      .map(
        (v) =>
          `- ${v.id}${v.opciones ? ` (${v.opciones.replaceAll('|', ' · ')})` : ''}: ${pesos(v.precio)}${v.disponible ? '' : ', agotada'}`,
      )
      .join('\n')}`,
    datos: { producto: p.slug, nombre: p.nombre, url: p.url, variantes },
  };
}

async function consultarDisponibilidad(
  c: ContextoDelMcp,
  a: z.infer<(typeof ENTRADAS)['consultar_disponibilidad']>,
): Promise<Salida> {
  const cot = await cotizar(
    c.db,
    c.org,
    {
      lineas: a.items,
      ...(a.envio ? { envio: a.envio } : {}),
      ...(a.cupon ? { cupon: a.cupon } : {}),
    },
    c.ahora,
  );
  const r = resumen(cot);
  return {
    texto: [`Total: ${pesos(cot.total)}`, ...r.avisos].join('\n'),
    datos: r,
  };
}

const codigoNuevo = (c: ContextoDelMcp) => [...c.azar(6)].map((b) => CROCKFORD[b % 32]).join('');
const secretoNuevo = (c: ContextoDelMcp) =>
  btoa(String.fromCharCode(...c.azar(16)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** El enlace con el que la persona confirma lo que preparó su asistente (HU-T15.5). */
export const enlaceDeConfirmacion = (host: string, codigo: string, secreto: string) =>
  `https://${host}/pedido/confirmar/#c=${codigo}&s=${secreto}`;

async function prepararPedidoDeAgente(
  c: ContextoDelMcp,
  a: z.infer<(typeof ENTRADAS)['preparar_pedido']>,
  intento = 1,
): Promise<Salida> {
  if (await c.soloLectura()) {
    return error('La tienda está en pausa unos minutos: se puede consultar, no preparar pedidos.');
  }
  if (!(await c.puedePreparar())) {
    return error('Son muchos pedidos seguidos desde aquí. Espera un minuto y vuelve a intentar.');
  }
  const tienda = await datosDeLaTienda(c.db, c.org);
  if (tienda.venta['abierta'] === false)
    return error('La tienda no está recibiendo pedidos ahora.');
  // Primero la cotización de ahora: es la que se escribe, y si corrige algo, el agente lo ve antes.
  const pedido = {
    lineas: a.items,
    ...(a.envio ? { envio: a.envio } : {}),
    ...(a.cupon ? { cupon: a.cupon } : {}),
  };
  const cot = await cotizar(c.db, c.org, pedido, c.ahora);
  const id = c.id();
  const ctx = { db: c.db, org: c.org, host: c.host, ahora: c.ahora, terminosPublicados: null, id };
  const preparado = await prepararPedido(
    ctx,
    { ...pedido, totalVisto: cot.total },
    { deAgente: true },
  );
  if ('estado' in preparado) {
    const corregida = 'cotizacion' in preparado ? preparado.cotizacion : cot;
    return {
      texto: [
        'No se preparó: la tienda corrigió el pedido. Revísalo con la persona y vuelve a prepararlo.',
        ...avisos(corregida),
      ].join('\n'),
      datos: { preparado: false, ...resumen(corregida) },
      error: true,
    };
  }
  const { cotizacion, porId, envio } = preparado;
  const codigo = codigoNuevo(c);
  const secreto = secretoNuevo(c);
  const lote = [
    c.db
      .prepare(
        `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, descuento_cop,
           envio_cop, total_cop, cupon_codigo, envio_opcion_id, envio_nombre, ciudad, seguimiento_huella,
           cambiado_por, creado, actualizado)
         VALUES (?, ?, ?, (SELECT COALESCE(MAX(numero), 1000) + 1 FROM pedido WHERE org_id = ?), 'pendiente',
           'agente', 'a_convenir', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'agente:mcp', ?, ?)`,
      )
      .bind(
        c.org,
        id,
        codigo,
        c.org,
        cotizacion.subtotal,
        cotizacion.descuento,
        cotizacion.envio,
        cotizacion.total,
        a.cupon && cotizacion.descuento > 0 ? a.cupon.toUpperCase() : null,
        a.envio ?? null,
        envio?.nombre ?? null,
        a.ciudad ?? null,
        await sha256(secreto),
        c.ahora,
        c.ahora,
      ),
    ...lineasDelPedido(ctx, cotizacion, porId),
    c.db
      .prepare(
        `INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, de, a, actor, detalle)
         VALUES (?, ?, ?, 'estado', NULL, 'pendiente', 'agente:mcp', ?)`,
      )
      .bind(c.org, id, c.ahora, JSON.stringify({ canal: 'agente' })),
    // CA3: el tope de pendientes de agente, contado dentro del lote (una transacción), como el de
    // los cobros abiertos (HU-T11.10).
    c.db
      .prepare(
        `SELECT CASE WHEN (SELECT count(*) FROM pedido INDEXED BY pedido_de_agente_por_confirmar
           WHERE org_id = ? AND canal = 'agente' AND estado = 'pendiente' AND aceptado IS NULL) > ? THEN json('ocupada') ELSE 1 END`,
      )
      .bind(c.org, PENDIENTES_DE_AGENTE_POR_TIENDA),
  ];
  try {
    await c.db.batch(lote);
  } catch (e) {
    const texto = String(e);
    if (/malformed JSON/i.test(texto)) {
      return error(
        'La tienda tiene muchos pedidos preparados sin confirmar. Pídele a la persona que pida desde la tienda.',
      );
    }
    // Otro pedido tomó el mismo código o el mismo número al tiempo: se intenta con otro.
    if (/UNIQUE/i.test(texto) && intento < 3) return prepararPedidoDeAgente(c, a, intento + 1);
    throw e;
  }
  const numero =
    (
      await c.db
        .prepare('SELECT numero FROM pedido WHERE org_id = ? AND id = ?')
        .bind(c.org, id)
        .first<{ numero: number }>()
    )?.numero ?? 0;
  const enlace = enlaceDeConfirmacion(c.host, codigo, secreto);
  return {
    texto: [
      `Pedido ${codigo} preparado: ${pesos(cotizacion.total)}. Todavía no está hecho.`,
      `Entrégale este enlace a la persona para que lo revise, acepte los términos y elija cómo pagar: ${enlace}`,
      'Si nadie lo confirma, se cancela solo a las 48 horas.',
    ].join('\n'),
    datos: {
      preparado: true,
      codigo,
      numero,
      enlace,
      mensaje: `Te dejé listo el pedido en ${tienda.nombre}. Revísalo, acepta los términos y elige cómo pagar aquí: ${enlace}`,
      ...resumen(cotizacion),
    },
  };
}

async function seguirPedido(
  c: ContextoDelMcp,
  a: z.infer<(typeof ENTRADAS)['seguimiento_de_pedido']>,
): Promise<Salida> {
  const s = await seguimiento(c.db, c.org, a.codigo, a.secreto);
  if (!s) return error('No encontramos un pedido con ese código y ese secreto.');
  return { texto: `Pedido ${s.codigo} · #${s.numero}: ${s.enPalabras}.`, datos: { ...s } };
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

/**
 * Responde un mensaje JSON-RPC. `null` para una notificación (sin `id`), que no lleva respuesta.
 * El estado HTTP lo decide la ruta.
 */
export async function responderMcp(
  c: ContextoDelMcp,
  cuerpo: unknown,
): Promise<{ status: 200 | 202 | 400; cuerpo: unknown }> {
  const rpc = cuerpo as Rpc | null;
  if (!rpc || Array.isArray(rpc) || rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
    return { status: 400, cuerpo: falla(null, -32600, 'Solicitud JSON-RPC inválida.') };
  }
  if (rpc.id === undefined) return { status: 202, cuerpo: null };
  const ok = (result: unknown) => ({ status: 200 as const, cuerpo: respuesta(rpc.id, result) });
  switch (rpc.method) {
    case 'initialize': {
      const pedida = String(rpc.params?.['protocolVersion'] ?? '');
      const tienda = await datosDeLaTienda(c.db, c.org);
      return ok({
        protocolVersion: (PROTOCOLOS_MCP as readonly string[]).includes(pedida)
          ? pedida
          : PROTOCOLOS_MCP[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'tienda', title: tienda.nombre, version: VERSION },
        instructions: INSTRUCCIONES,
      });
    }
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: HERRAMIENTAS });
    case 'tools/call': {
      const nombre = rpc.params?.['name'];
      if (typeof nombre !== 'string' || !(nombre in ENTRADAS)) {
        return {
          status: 200,
          cuerpo: falla(rpc.id, -32602, `No existe la herramienta ${String(nombre)}.`),
        };
      }
      const h = nombre as Herramienta;
      const args = ENTRADAS[h].safeParse(rpc.params?.['arguments'] ?? {});
      if (!args.success) {
        return {
          status: 200,
          cuerpo: falla(
            rpc.id,
            -32602,
            `Los argumentos de ${h} no cumplen su esquema: ${args.error.issues.map((i) => `${i.path.join('.') || 'entrada'} ${i.message}`).join('; ')}`,
          ),
        };
      }
      const salida =
        h === 'buscar_productos'
          ? await buscarProductos(c, args.data as z.infer<(typeof ENTRADAS)['buscar_productos']>)
          : h === 'ver_producto'
            ? await verProducto(c, args.data as z.infer<(typeof ENTRADAS)['ver_producto']>)
            : h === 'consultar_disponibilidad'
              ? await consultarDisponibilidad(
                  c,
                  args.data as z.infer<(typeof ENTRADAS)['consultar_disponibilidad']>,
                )
              : h === 'preparar_pedido'
                ? await prepararPedidoDeAgente(
                    c,
                    args.data as z.infer<(typeof ENTRADAS)['preparar_pedido']>,
                  )
                : await seguirPedido(
                    c,
                    args.data as z.infer<(typeof ENTRADAS)['seguimiento_de_pedido']>,
                  );
      return ok({
        content: [{ type: 'text', text: salida.texto }],
        structuredContent: salida.datos,
        ...(salida.error ? { isError: true } : {}),
      });
    }
    default:
      return { status: 200, cuerpo: falla(rpc.id, -32601, `Método desconocido: ${rpc.method}`) };
  }
}

/** Si el comercio encendió el MCP en Ajustes › Agentes (HU-T15.4: apagado si no lo dice). */
export async function mcpEncendido(db: BaseD1, org: string): Promise<boolean> {
  const fila = await db
    .prepare("SELECT datos FROM ajuste WHERE org_id = ? AND seccion = 'agentes'")
    .bind(org)
    .first<{ datos: string }>();
  try {
    return (JSON.parse(fila?.datos ?? '{}') as { mcp?: unknown }).mcp === true;
  } catch {
    return false;
  }
}
