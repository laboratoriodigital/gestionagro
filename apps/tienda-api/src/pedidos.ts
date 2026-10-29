/**
 * Los pedidos de la vitrina (TIENDA-3.0 §8.2 a §8.5, anexo C `registrar` y `seguimiento`).
 *
 * **Registrar** (HU-T6.1, `POST /api/v1/pedidos`): el pedido `pendiente` de canal `whatsapp`, con la
 * forma de pago elegida (una de las que ofrece la tienda), la huella de los términos que vio la
 * persona y el instante en que los aceptó. Antes de escribir:
 * - la tienda tiene que estar abierta y ofrecer esa forma;
 * - los términos tienen que ser los publicados: un pedido nunca cita un texto que la tienda no
 *   mostró;
 * - el servidor vuelve a cotizar (HU-T5.5): si algo cambió, no registra y devuelve lo corregido;
 * - un producto solo para mayores exige la edad confirmada en su línea (Ley 1480 art. 52).
 * El `codigo` es la clave de idempotencia: reenviar el mismo pedido responde `duplicado` con el
 * mismo texto (CA3). El texto para WhatsApp lo arma el servidor con lo que quedó escrito.
 *
 * **Seguimiento** (HU-T6.3, `POST /api/v1/seguimiento`): el secreto nació en el navegador y aquí
 * solo está su SHA-256. Cualquier fallo responde lo mismo (CA3), y la respuesta no dice nada del
 * comprador, ni la ciudad (CA2).
 */
import type { BaseD1 } from '@ed1/d1';
import { formatearPesos, LIMITES } from '@ed1/dinero';
import { NOMBRE_DE_LA_FORMA } from '@ed1/tienda-horno';
import { formasDelPlan } from '@ed1/tienda-schema';
import { z } from 'zod';
import { precioDeHoy } from './catalogo.ts';
import { type Cotizacion, cotizar } from './cotizar.ts';
import { kekDelEntorno } from './llaves.ts';
import { limitesDeLaTienda } from './plan.ts';
import { type TextoDeLinea, textosDelPedido } from './textos-del-comprador.ts';

const CROCKFORD = /^[0-9A-HJKMNP-TV-Z]{6}$/;
const SECRETO = /^[A-Za-z0-9_-]{22}$/;
/** Las formas que se eligen al pedir por WhatsApp; `en_linea` llega con el cobro (M3). */
export const FORMAS_POR_WHATSAPP = [
  'a_convenir',
  'contraentrega',
  'transferencia',
  'efectivo',
] as const;
type FormaPorWhatsapp = (typeof FORMAS_POR_WHATSAPP)[number];

export const PeticionDePedido = z.object({
  codigo: z.string().regex(CROCKFORD),
  lineas: z
    .array(
      z.object({
        variante: z.string().min(1).max(64),
        cantidad: z.number().int().min(1).max(LIMITES.unidadesPorLinea),
        mayorDeEdad: z.literal(true).optional(),
        /** HU-P1.5: lo que pide el producto en su ficha; se valida contra la base. */
        texto: z.string().trim().max(200).optional(),
      }),
    )
    .min(1)
    .max(LIMITES.lineas),
  envio: z.string().min(1).max(64).optional(),
  cupon: z.string().trim().min(1).max(24).optional(),
  ciudad: z.string().trim().min(1).max(60).optional(),
  forma: z.enum(FORMAS_POR_WHATSAPP),
  /** La casilla, que nunca viene marcada: tiene que llegar en `true` (Ley 1480 art. 50 lit. d). */
  acepta: z.literal(true),
  terminos: z.string().regex(/^[0-9a-f]{64}$/),
  seguimiento: z.string().regex(SECRETO),
  totalVisto: z.number().int().min(0),
});
export type PeticionDePedido = z.infer<typeof PeticionDePedido>;

export type ResultadoDePedido =
  | {
      estado: 'registrado' | 'duplicado';
      codigo: string;
      numero: number;
      total: number;
      texto: string;
      whatsapp: string | null;
    }
  | { estado: 'cambio'; cotizacion: Cotizacion }
  | { estado: 'terminos' | 'cerrada' | 'codigo-en-uso' }
  | { estado: 'forma' | 'edad' | 'texto'; motivo: string };

export interface ContextoDePedido {
  db: BaseD1;
  org: string;
  /** El host de la tienda, para el enlace de seguimiento. */
  host: string;
  ahora: string;
  /** La huella de `/legal/terminos/index.md` de la versión publicada; `null` si no se pudo leer. */
  terminosPublicados: string | null;
  /** Un id nuevo para el pedido (UUID). */
  id: string;
  /** HU-P1.5: la llave maestra, para cifrar los textos del comprador. Sin ella no se guardan. */
  kekTexto?: string | undefined;
}

export async function sha256(texto: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compara sin cortar en la primera diferencia. */
export function igual(a: string, b: string): boolean {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return d === 0;
}

/** «Talla: M · Color: Arena», de las opciones del producto y la clave de la variante. */
export function opcionesEnPalabras(opciones: string, clave: string): string {
  const grupos = JSON.parse(opciones) as { nombre: string }[];
  const valores = clave === '' ? [] : clave.split('|');
  return grupos
    .map((g, i) => (valores[i] ? `${g.nombre}: ${valores[i]}` : ''))
    .filter(Boolean)
    .join(' · ');
}

export interface DatosDelTexto {
  tienda: string;
  codigo: string;
  numero: number;
  lineas: {
    nombre: string;
    opciones: string;
    cantidad: number;
    total: number;
    /** HU-P1.5: lo que escribió el comprador para este producto. */
    texto?: string;
  }[];
  envio: { nombre: string; cop: number } | null;
  descuento: { cupon: string | null; cop: number };
  total: number;
  forma: string;
  ciudad: string | null;
  enlace: string | null;
}

/**
 * El mensaje que el comprador manda por WhatsApp (CA2): el resumen, la forma de pago y el enlace de
 * seguimiento. Sin emoji: algunos teléfonos los cambian por cuadros, y si algún día hay uno, va al
 * final (bitácora ecommerce, menores).
 */
export function textoDelPedido(d: DatosDelTexto): string {
  return [`Hola, ${d.tienda}. Quiero hacer este pedido:`, '', ...resumenDelPedido(d)].join('\n');
}

/** Las líneas del pedido, del código al enlace: las comparten el WhatsApp y el acuse por correo. */
export function resumenDelPedido(d: DatosDelTexto): string[] {
  return [
    `Pedido ${d.codigo} · #${d.numero}`,
    ...d.lineas.map(
      (l) =>
        `- ${l.cantidad} × ${l.nombre}${l.opciones ? ` (${l.opciones})` : ''}: ${formatearPesos(l.total)}${l.texto ? `\n  Texto: «${l.texto}»` : ''}`,
    ),
    ...(d.envio ? [`Envío ${d.envio.nombre}: ${formatearPesos(d.envio.cop)}`] : []),
    ...(d.descuento.cop > 0
      ? [
          `Descuento${d.descuento.cupon ? ` ${d.descuento.cupon}` : ''}: -${formatearPesos(d.descuento.cop)}`,
        ]
      : []),
    `Total: ${formatearPesos(d.total)}`,
    `Forma de pago: ${NOMBRE_DE_LA_FORMA[d.forma as keyof typeof NOMBRE_DE_LA_FORMA] ?? d.forma}`,
    ...(d.ciudad ? [`Ciudad de entrega: ${d.ciudad}`] : []),
    ...(d.enlace ? ['', `Sigue tu pedido: ${d.enlace}`] : []),
  ];
}

export const enlaceDeSeguimiento = (host: string, codigo: string, secreto: string) =>
  `https://${host}/pedido/#c=${codigo}&s=${secreto}`;

export async function datosDeLaTienda(db: BaseD1, org: string) {
  const tienda = await db
    .prepare('SELECT nombre, plan FROM tienda WHERE org_id = ?')
    .bind(org)
    .first<{ nombre: string; plan: string }>();
  const { results } = await db
    .prepare(
      "SELECT seccion, datos FROM ajuste WHERE org_id = ? AND seccion IN ('identidad', 'contacto', 'venta')",
    )
    .bind(org)
    .all<{ seccion: string; datos: string }>();
  const ajuste = (s: string) =>
    JSON.parse(results.find((r) => r.seccion === s)?.datos ?? '{}') as Record<string, unknown>;
  const identidad = ajuste('identidad');
  const contacto = ajuste('contacto');
  return {
    nombre: (typeof identidad['nombre'] === 'string' ? identidad['nombre'] : tienda?.nombre) ?? '',
    whatsapp:
      typeof contacto['whatsapp'] === 'string' ? contacto['whatsapp'].replace(/\D/g, '') : null,
    venta: ajuste('venta'),
    // HU-T13.5: lo que permite su plan.
    limites: limitesDeLaTienda(tienda?.plan),
  };
}

/** El texto de un pedido ya escrito, desde la base: el mismo para `registrado` y `duplicado`. */
async function textoDesdeLaBase(
  c: ContextoDePedido,
  pedidoId: string,
  tienda: string,
  secreto: string | null,
  textos: readonly TextoDeLinea[] = [],
): Promise<{ numero: number; total: number; texto: string; codigo: string }> {
  const d = await datosDelPedidoEscrito(c, pedidoId, tienda, secreto, textos);
  return { codigo: d.codigo, numero: d.numero, total: d.total, texto: textoDelPedido(d) };
}

/** Lo que dicen el mensaje y el acuse de un pedido ya escrito, leído de la base. */
export async function datosDelPedidoEscrito(
  c: Pick<ContextoDePedido, 'db' | 'org' | 'host'>,
  pedidoId: string,
  tienda: string,
  secreto: string | null,
  /** HU-P1.5: los textos del comprador, que la base guarda cifrados; van debajo de su línea. */
  textos: readonly TextoDeLinea[] = [],
): Promise<DatosDelTexto> {
  const p = await c.db
    .prepare(
      `SELECT codigo, numero, forma_pago, descuento_cop, envio_cop, total_cop, cupon_codigo, envio_nombre, ciudad
       FROM pedido WHERE org_id = ? AND id = ?`,
    )
    .bind(c.org, pedidoId)
    .first<{
      codigo: string;
      numero: number;
      forma_pago: string;
      descuento_cop: number;
      envio_cop: number;
      total_cop: number;
      cupon_codigo: string | null;
      envio_nombre: string | null;
      ciudad: string | null;
    }>();
  if (!p) throw new Error('el pedido recién escrito no se pudo leer');
  const { results: lineas } = await c.db
    .prepare(
      'SELECT variante_id, nombre, opciones, cantidad, total_cop FROM pedido_linea WHERE org_id = ? AND pedido_id = ? ORDER BY linea',
    )
    .bind(c.org, pedidoId)
    .all<{
      variante_id: string;
      nombre: string;
      opciones: string;
      cantidad: number;
      total_cop: number;
    }>();
  const textoDe = new Map(textos.map((t) => [t.variante, t.texto]));
  return {
    tienda,
    codigo: p.codigo,
    numero: p.numero,
    lineas: lineas.map(({ variante_id, total_cop, ...l }) => {
      const texto = textoDe.get(variante_id);
      return { ...l, total: total_cop, ...(texto ? { texto } : {}) };
    }),
    envio: p.envio_nombre ? { nombre: p.envio_nombre, cop: p.envio_cop } : null,
    descuento: { cupon: p.cupon_codigo, cop: p.descuento_cop },
    total: p.total_cop,
    forma: p.forma_pago,
    ciudad: p.ciudad,
    enlace: secreto ? enlaceDeSeguimiento(c.host, p.codigo, secreto) : null,
  };
}

/** Lo que un pedido necesita antes de escribirse, sea por WhatsApp o en línea (HU-T11.4). */
export interface PedidoPreparado {
  cotizacion: Cotizacion;
  porId: Map<string, VarianteDelPedido>;
  conEdad: Set<string>;
  envio: { nombre: string } | null;
}

interface VarianteDelPedido {
  id: string;
  clave: string;
  sku: string | null;
  precio_cop: number;
  producto_id: string;
  nombre: string;
  opciones: string;
  solo_mayores: number;
  oferta: string | null;
}

/**
 * Los términos publicados, la cotización del servidor (HU-T5.5) y la edad (Ley 1480 art. 52): lo
 * mismo para registrar un pedido por WhatsApp que para cobrarlo en línea. Si algo no cuadra,
 * devuelve la respuesta para el comprador; si cuadra, lo que hace falta para escribirlo.
 */
export async function prepararPedido(
  c: ContextoDePedido,
  p: Pick<PeticionDePedido, 'lineas' | 'envio' | 'cupon' | 'totalVisto'> & { terminos?: string },
  /**
   * HU-T15.4: el pedido que prepara un agente no trae la aceptación ni la edad. Las da la persona al
   * confirmarlo (HU-T15.5), que vuelve a pasar por aquí sin esta opción.
   */
  opciones: { deAgente?: boolean } = {},
): Promise<
  | PedidoPreparado
  | { estado: 'terminos' }
  | { estado: 'cambio'; cotizacion: Cotizacion }
  | { estado: 'edad'; motivo: string }
> {
  if (
    !opciones.deAgente &&
    (!c.terminosPublicados || !p.terminos || !igual(c.terminosPublicados, p.terminos))
  ) {
    return { estado: 'terminos' };
  }

  const cotizacion = await cotizar(
    c.db,
    c.org,
    {
      lineas: p.lineas.map(({ variante, cantidad }) => ({ variante, cantidad })),
      totalVisto: p.totalVisto,
      ...(p.envio ? { envio: p.envio } : {}),
      ...(p.cupon ? { cupon: p.cupon } : {}),
    },
    c.ahora,
  );
  const pedidas = new Map<string, number>();
  for (const l of p.lineas) pedidas.set(l.variante, (pedidas.get(l.variante) ?? 0) + l.cantidad);
  const corrigio =
    cotizacion.cambio ||
    cotizacion.carrito.length === 0 ||
    cotizacion.carrito.length !== pedidas.size ||
    cotizacion.carrito.some((l) => pedidas.get(l.variante) !== l.cantidad) ||
    cotizacion.avisos.some((a) => a.codigo === 'cupon_invalido' || a.codigo === 'envio_invalido');
  if (corrigio) return { estado: 'cambio', cotizacion };

  const { results: filas } = await c.db
    .prepare(
      `SELECT v.id, v.clave, v.sku, v.precio_cop, p.id AS producto_id, p.nombre, p.opciones, p.solo_mayores, p.oferta
       FROM variante v JOIN producto p ON p.org_id = v.org_id AND p.id = v.producto_id
       WHERE v.org_id = ? AND v.id IN (${cotizacion.carrito.map(() => '?').join(', ')})`,
    )
    .bind(c.org, ...cotizacion.carrito.map((l) => l.variante))
    .all<VarianteDelPedido>();
  const porId = new Map(filas.map((f) => [f.id, f]));
  const conEdad = new Set(p.lineas.filter((l) => l.mayorDeEdad).map((l) => l.variante));
  const sinEdad = cotizacion.carrito.filter(
    (l) => porId.get(l.variante)?.solo_mayores === 1 && !conEdad.has(l.variante),
  );
  if (!opciones.deAgente && sinEdad.length > 0) {
    return {
      estado: 'edad',
      motivo: 'Confirma que eres mayor de edad en cada producto que lo pide.',
    };
  }
  const envio = p.envio
    ? await c.db
        .prepare('SELECT nombre FROM envio_opcion WHERE org_id = ? AND id = ?')
        .bind(c.org, p.envio)
        .first<{ nombre: string }>()
    : null;
  return { cotizacion, porId, conEdad, envio };
}

/** Las líneas del pedido, con las copias del día (nombre, opciones, precio). */
export function lineasDelPedido(
  c: Pick<ContextoDePedido, 'db' | 'org' | 'id' | 'ahora'>,
  cotizacion: Cotizacion,
  porId: ReadonlyMap<string, VarianteDelPedido>,
) {
  return cotizacion.carrito.map((l, i) => {
    const v = porId.get(l.variante);
    if (!v) throw new Error(`la variante ${l.variante} se cotizó y no se pudo leer`);
    // HU-P1.4: el mismo precio que la cotización de este instante, con la oferta si rige.
    const precio = precioDeHoy(v.precio_cop, v.oferta, c.ahora);
    return c.db
      .prepare(
        `INSERT INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, opciones, sku,
           precio_unitario_cop, cantidad, total_cop) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        c.org,
        c.id,
        i + 1,
        v.producto_id,
        v.id,
        v.nombre,
        opcionesEnPalabras(v.opciones, v.clave),
        v.sku,
        precio,
        l.cantidad,
        precio * l.cantidad,
      );
  });
}

/** HU-P6.3: si todas estas combinaciones son de productos digitales. */
export async function soloDigitales(db: BaseD1, org: string, variantes: readonly string[]) {
  if (variantes.length === 0) return false;
  const r = await db
    .prepare(
      `SELECT count(*) AS fisicas FROM variante v JOIN producto p ON p.org_id = v.org_id AND p.id = v.producto_id
        WHERE v.org_id = ? AND v.id IN (SELECT value FROM json_each(?)) AND p.tipo <> 'digital'`,
    )
    .bind(org, JSON.stringify([...variantes]))
    .first<{ fisicas: number }>();
  return (r?.fisicas ?? 1) === 0;
}

export async function registrar(
  c: ContextoDePedido,
  p: PeticionDePedido,
): Promise<ResultadoDePedido> {
  const huellaDelSecreto = await sha256(p.seguimiento);
  const tienda = await datosDeLaTienda(c.db, c.org);

  // CA3: el mismo código es el mismo pedido. Con otro secreto, es otro pedido que chocó.
  const previo = await c.db
    .prepare('SELECT id, seguimiento_huella FROM pedido WHERE org_id = ? AND codigo = ?')
    .bind(c.org, p.codigo)
    .first<{ id: string; seguimiento_huella: string | null }>();
  if (previo) {
    if (!previo.seguimiento_huella || !igual(previo.seguimiento_huella, huellaDelSecreto)) {
      return { estado: 'codigo-en-uso' };
    }
    // HU-P1.5: el reenvío trae los mismos textos; la base los guarda cifrados.
    const leidos = await textosDelPedido(c.db, c.org, p.lineas);
    return {
      estado: 'duplicado',
      whatsapp: tienda.whatsapp,
      ...(await textoDesdeLaBase(
        c,
        previo.id,
        tienda.nombre,
        p.seguimiento,
        leidos.ok ? leidos.textos : [],
      )),
    };
  }

  if (tienda.venta['abierta'] === false) return { estado: 'cerrada' };
  // HU-T13.5 CA3: las que su plan deja ofrecer, las mismas que hornea la vitrina.
  const ofrecidas = formasDelPlan(
    (tienda.venta['formas'] ?? []) as { forma: string }[],
    tienda.limites,
    tienda.venta['modo'] === 'en_linea' || tienda.venta['modo'] === 'ambos',
  ).map((f) => f.forma);
  if (!ofrecidas.includes(p.forma)) {
    return { estado: 'forma', motivo: 'Esta tienda no ofrece esa forma de pago. Elige otra.' };
  }
  // HU-P6.3 CA3: lo digital no se entrega en una puerta: un pedido solo de digitales no va contra entrega.
  if (
    p.forma === 'contraentrega' &&
    (await soloDigitales(
      c.db,
      c.org,
      p.lineas.map((l) => l.variante),
    ))
  ) {
    return {
      estado: 'forma',
      motivo: 'Lo digital se paga antes de descargarlo: elige otra forma de pago.',
    };
  }
  // HU-P1.5: lo que pide cada producto en su ficha, contra la base.
  const leidos = await textosDelPedido(c.db, c.org, p.lineas);
  if (!leidos.ok) return { estado: 'texto', motivo: leidos.motivo };
  const preparado = await prepararPedido(c, p);
  if ('estado' in preparado) return preparado;
  const { cotizacion, porId, conEdad, envio } = preparado;
  const textos = leidos.textos.filter((t) =>
    cotizacion.carrito.some((l) => l.variante === t.variante),
  );
  const sobreDeLosTextos = await sobreDeTextos(c, textos);

  const sentencias = [
    c.db
      .prepare(
        `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, descuento_cop,
           envio_cop, total_cop, cupon_codigo, envio_opcion_id, envio_nombre, ciudad, seguimiento_huella,
           terminos_huella, aceptado, cambiado_por, creado, actualizado)
         VALUES (?, ?, ?, (SELECT COALESCE(MAX(numero), 1000) + 1 FROM pedido WHERE org_id = ?), 'pendiente',
           'whatsapp', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'comprador', ?, ?)`,
      )
      .bind(
        c.org,
        c.id,
        p.codigo,
        c.org,
        p.forma,
        cotizacion.subtotal,
        cotizacion.descuento,
        cotizacion.envio,
        cotizacion.total,
        p.cupon && cotizacion.descuentoCupon > 0 ? p.cupon.toUpperCase() : null,
        p.envio ?? null,
        envio?.nombre ?? null,
        p.ciudad ?? null,
        huellaDelSecreto,
        p.terminos,
        c.ahora,
        c.ahora,
        c.ahora,
      ),
    ...lineasDelPedido(c, cotizacion, porId),
    // El primer paso del historial (el trigger escribe los cambios de estado, no el nacimiento), con
    // la edad confirmada de cada línea que la pedía (Ley 1480 art. 52).
    c.db
      .prepare(
        `INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, de, a, actor, detalle)
         VALUES (?, ?, ?, 'estado', NULL, 'pendiente', 'comprador', ?)`,
      )
      .bind(
        c.org,
        c.id,
        c.ahora,
        JSON.stringify({ canal: 'whatsapp', mayorDeEdad: [...conEdad].sort() }),
      ),
    ...(sobreDeLosTextos
      ? [
          c.db
            .prepare(
              `INSERT INTO pedido_contacto (org_id, pedido_id, sobre, iv, llave_version, celular_indice, creado,
                 purgar_despues) VALUES (?, ?, ?, ?, ?, NULL, ?, ${sobreDeLosTextos.purgarDespues})`,
            )
            .bind(
              c.org,
              c.id,
              sobreDeLosTextos.sobre,
              sobreDeLosTextos.iv,
              sobreDeLosTextos.version,
              c.ahora,
              c.ahora,
              c.org,
            ),
        ]
      : []),
  ];
  try {
    await c.db.batch(sentencias);
  } catch (e) {
    // Dos envíos del mismo pedido a la vez: el UNIQUE atrapa al segundo, que responde como duplicado.
    if (/UNIQUE/i.test(String(e))) return registrar(c, p);
    throw e;
  }
  return {
    estado: 'registrado',
    whatsapp: tienda.whatsapp,
    ...(await textoDesdeLaBase(c, c.id, tienda.nombre, p.seguimiento, textos)),
  };
}

/**
 * HU-P1.5: el sobre con los textos de un pedido por WhatsApp, que no tiene otros datos de entrega.
 * Sin textos, nada; sin la llave maestra, tampoco: el WhatsApp los lleva igual, y se dice en el log.
 */
async function sobreDeTextos(c: ContextoDePedido, textos: readonly TextoDeLinea[]) {
  if (textos.length === 0) return null;
  const kek = await kekDelEntorno(c.kekTexto);
  if (!kek) {
    console.error('tienda-api: sin la KEK no se guardan los textos del comprador');
    return null;
  }
  // Se importan aquí: `bandeja.ts` y `titular.ts` llegan a este módulo por los enlaces de pago, y
  // arriba harían un ciclo que deja sus esquemas sin definir.
  const [{ cifrarContacto }, { PURGAR_DESPUES }] = await Promise.all([
    import('./bandeja.ts'),
    import('./titular.ts'),
  ]);
  const sobre = await cifrarContacto(
    c,
    kek,
    c.id,
    { textos: textos.map(({ nombre, texto }) => ({ nombre, texto })) },
    c.ahora,
  );
  return { ...sobre, purgarDespues: PURGAR_DESPUES };
}

export const PeticionDeSeguimiento = z.object({
  codigo: z.string().regex(CROCKFORD),
  secreto: z.string().regex(SECRETO),
});

const ESTADO_EN_PALABRAS: Record<string, string> = {
  pendiente: 'Recibido: la tienda lo va a confirmar',
  por_pagar: 'Esperando el pago',
  confirmado: 'Confirmado: la tienda lo está preparando',
  pagado: 'Pagado: la tienda lo está preparando',
  despachado: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  devuelto: 'Devuelto',
};

export interface Seguimiento {
  codigo: string;
  numero: number;
  estado: string;
  enPalabras: string;
  pasos: { estado: string; enPalabras: string; instante: string }[];
  lineas: { nombre: string; opciones: string; cantidad: number; total: number }[];
  subtotal: number;
  descuento: number;
  envio: number;
  total: number;
  envioNombre: string | null;
  plazo: string | null;
  forma: string;
  transportadora: string | null;
  guia: string | null;
  /**
   * HU-T15.5: el pedido lo preparó un asistente y espera que la persona lo confirme: las
   * combinaciones que piden confirmar la edad (Ley 1480 art. 52).
   */
  porConfirmar?: { edad: { variante: string; nombre: string }[] };
}

/** El pedido, si el secreto es el suyo; `null` para todo lo demás, sin decir qué falló (CA3). */
export async function seguimiento(
  db: BaseD1,
  org: string,
  codigo: string,
  secreto: string,
): Promise<Seguimiento | null> {
  const huellaDada = await sha256(secreto);
  const p = await db
    .prepare(
      `SELECT id, codigo, numero, estado, forma_pago, subtotal_cop, descuento_cop, envio_cop, total_cop,
         envio_opcion_id, envio_nombre, transportadora, guia, seguimiento_huella, canal, aceptado
       FROM pedido WHERE org_id = ? AND codigo = ?`,
    )
    .bind(org, codigo)
    .first<{
      id: string;
      codigo: string;
      numero: number;
      estado: string;
      forma_pago: string;
      subtotal_cop: number;
      descuento_cop: number;
      envio_cop: number;
      total_cop: number;
      envio_opcion_id: string | null;
      envio_nombre: string | null;
      transportadora: string | null;
      guia: string | null;
      seguimiento_huella: string | null;
      canal: string;
      aceptado: string | null;
    }>();
  // El mismo trabajo con o sin pedido: comparar contra una huella de relleno.
  const guardada = p?.seguimiento_huella ?? '0'.repeat(64);
  if (!igual(guardada, huellaDada) || !p?.seguimiento_huella) return null;
  const [{ results: lineas }, { results: pasos }, opcion] = await Promise.all([
    db
      .prepare(
        'SELECT nombre, opciones, cantidad, total_cop FROM pedido_linea WHERE org_id = ? AND pedido_id = ? ORDER BY linea',
      )
      .bind(org, p.id)
      .all<{ nombre: string; opciones: string; cantidad: number; total_cop: number }>(),
    db
      .prepare(
        "SELECT a, instante FROM pedido_evento WHERE org_id = ? AND pedido_id = ? AND tipo = 'estado' ORDER BY id",
      )
      .bind(org, p.id)
      .all<{ a: string; instante: string }>(),
    p.envio_opcion_id
      ? db
          .prepare('SELECT dias_min, dias_max FROM envio_opcion WHERE org_id = ? AND id = ?')
          .bind(org, p.envio_opcion_id)
          .first<{ dias_min: number | null; dias_max: number | null }>()
      : Promise.resolve(null),
  ]);
  const plazo = (() => {
    if (!opcion || (opcion.dias_min === null && opcion.dias_max === null)) return null;
    if (
      opcion.dias_min !== null &&
      opcion.dias_max !== null &&
      opcion.dias_min !== opcion.dias_max
    ) {
      return `Llega en ${opcion.dias_min} a ${opcion.dias_max} días`;
    }
    const n = opcion.dias_max ?? opcion.dias_min ?? 0;
    return `Llega en ${n} ${n === 1 ? 'día' : 'días'}`;
  })();
  const porConfirmar = p.canal === 'agente' && p.estado === 'pendiente' && p.aceptado === null;
  const edad = porConfirmar
    ? (
        await db
          .prepare(
            `SELECT l.variante_id AS variante, l.nombre FROM pedido_linea l
               JOIN producto p ON p.org_id = l.org_id AND p.id = l.producto_id
              WHERE l.org_id = ? AND l.pedido_id = ? AND p.solo_mayores = 1 ORDER BY l.linea`,
          )
          .bind(org, p.id)
          .all<{ variante: string; nombre: string }>()
      ).results
    : [];
  return {
    ...(porConfirmar ? { porConfirmar: { edad } } : {}),
    codigo: p.codigo,
    numero: p.numero,
    estado: p.estado,
    enPalabras: porConfirmar
      ? 'Preparado por tu asistente: falta que lo confirmes'
      : (ESTADO_EN_PALABRAS[p.estado] ?? p.estado),
    pasos: pasos.map((x) => ({
      estado: x.a,
      enPalabras: ESTADO_EN_PALABRAS[x.a] ?? x.a,
      instante: x.instante,
    })),
    lineas: lineas.map((l) => ({
      nombre: l.nombre,
      opciones: l.opciones,
      cantidad: l.cantidad,
      total: l.total_cop,
    })),
    subtotal: p.subtotal_cop,
    descuento: p.descuento_cop,
    envio: p.envio_cop,
    total: p.total_cop,
    envioNombre: p.envio_nombre,
    plazo,
    forma: NOMBRE_DE_LA_FORMA[p.forma_pago as keyof typeof NOMBRE_DE_LA_FORMA] ?? p.forma_pago,
    transportadora: p.estado === 'despachado' || p.estado === 'entregado' ? p.transportadora : null,
    guia: p.estado === 'despachado' || p.estado === 'entregado' ? p.guia : null,
  };
}

export type { FormaPorWhatsapp };
