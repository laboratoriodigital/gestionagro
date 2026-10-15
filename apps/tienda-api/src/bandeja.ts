/**
 * Los pedidos en el panel (TIENDA-3.0 §12.2 y §12.5):
 *
 * - **La bandeja (HU-T9.1).** De a 50, de los más nuevos a los más viejos, con cursor; antes de
 *   todo, lo que necesita atención. El comprador sale **tapado** («María F.», «300 ••• 4567»): el
 *   sobre se abre aquí y solo sale lo tapado.
 * - **Ver los datos de entrega (HU-T9.2).** Abre el sobre de un pedido y deja la lectura en su
 *   historial (`contacto_leido`) y en el registro, en el mismo lote: si una falla, el panel no los
 *   recibe. Es la única ruta que devuelve el contacto en claro.
 * - **Confirmar por WhatsApp y confirmar (HU-T9.3).** El mensaje lleva el resumen, la dirección si
 *   la dejó y lo que sigue según la forma de pago; en una transferencia, la cuenta del comercio.
 *   Abrirlo también es leer el contacto, y queda igual. Confirmar descuenta el inventario en el
 *   mismo lote que cambia el estado; si no alcanza, lo dice y no confirma.
 */
import {
  type Aleatorio,
  cifrarSobre,
  DescifradoFallido,
  descifrarSobre,
  type Kek,
} from '@ed1/cifrado';
import type { SentenciaD1 } from '@ed1/d1';
import { formatearPesos } from '@ed1/dinero';
import { taparCelular, taparNombre } from '@ed1/tienda-schema/tapado';
import { z } from 'zod';
import {
  esCambiado,
  esOperacionRepetida,
  guardarOperacion,
  MOTIVO_CAMBIADO,
  type Quien,
  type Resultado,
  SI_CAMBIO,
  yaAplicada,
} from './catalogo.ts';
import { netoDelRecaudo } from './ciclo.ts';
import { deksDeLaTienda, dekVigente } from './llaves.ts';
import { anotar } from './registro.ts';

/** Lo que guarda el sobre de `pedido_contacto`: lo que el comprador dejó para la entrega. */
export const ContactoDelPedido = z.object({
  nombre: z.string().max(120).optional(),
  celular: z.string().max(20).optional(),
  correo: z.string().max(200).optional(),
  direccion: z.string().max(300).optional(),
  ciudad: z.string().max(80).optional(),
  notas: z.string().max(600).optional(),
});
export type ContactoDelPedido = z.infer<typeof ContactoDelPedido>;

const contexto = (org: string, pedido: string) => ({
  org,
  tabla: 'pedido_contacto',
  campo: 'sobre',
  id: pedido,
});

/** El sobre del contacto de un pedido, con la llave vigente de la tienda. */
export async function cifrarContacto(
  q: Pick<Quien, 'db' | 'org'>,
  kek: Kek,
  pedido: string,
  contacto: ContactoDelPedido,
  ahora: string,
  aleatorio?: Aleatorio,
) {
  const dek = await dekVigente(q.db, q.org, 'datos_personales', kek, ahora, aleatorio);
  return cifrarSobre(dek, contexto(q.org, pedido), JSON.stringify(contacto), aleatorio);
}

const bytes = (v: ArrayBuffer | Uint8Array | number[]) =>
  v instanceof Uint8Array ? v : new Uint8Array(v as ArrayBuffer);

/** Abre los sobres de estos pedidos. Uno que no se puede abrir no sale: se registra y se sigue. */
async function abrirContactos(
  q: Quien,
  kek: Kek | null,
  pedidos: readonly string[],
): Promise<Map<string, ContactoDelPedido>> {
  const abiertos = new Map<string, ContactoDelPedido>();
  if (!kek || pedidos.length === 0) return abiertos;
  const { results } = await q.db
    .prepare(
      `SELECT pedido_id, sobre, iv, llave_version FROM pedido_contacto
        WHERE org_id = ? AND pedido_id IN (${pedidos.map(() => '?').join(', ')})`,
    )
    .bind(q.org, ...pedidos)
    .all<{
      pedido_id: string;
      sobre: ArrayBuffer | Uint8Array;
      iv: ArrayBuffer | Uint8Array;
      llave_version: number;
    }>();
  if (results.length === 0) return abiertos;
  const deks = await deksDeLaTienda(q.db, q.org, 'datos_personales', new Map([[kek.id, kek]]));
  for (const f of results) {
    try {
      const texto = await descifrarSobre(deks, contexto(q.org, f.pedido_id), {
        sobre: bytes(f.sobre),
        iv: bytes(f.iv),
        version: f.llave_version,
      });
      const r = ContactoDelPedido.safeParse(JSON.parse(texto));
      if (r.success) abiertos.set(f.pedido_id, r.data);
    } catch (e) {
      if (!(e instanceof DescifradoFallido)) throw e;
      console.error('tienda-api: el contacto de un pedido no se pudo abrir');
    }
  }
  return abiertos;
}

/** El comprador tapado (TIENDA §12.5): nunca sale de aquí en claro por la bandeja. */
const tapado = (c: ContactoDelPedido | undefined) =>
  c
    ? {
        nombre: c.nombre ? taparNombre(c.nombre) : null,
        celular: c.celular ? taparCelular(c.celular) : null,
      }
    : null;

export interface FilaDePedido {
  id: string;
  numero: number;
  estado: string;
  formaPago: string;
  totalCop: number;
  creado: string;
  ciudad: string | null;
  articulos: number;
  atencion: string | null;
  comprador: { nombre: string | null; celular: string | null } | null;
  version: number;
}

interface FilaCruda {
  id: string;
  numero: number;
  estado: string;
  forma_pago: string;
  total_cop: number;
  creado: string;
  ciudad: string | null;
  articulos: number | null;
  atencion: string | null;
  version: number;
}

const COLUMNAS = `p.id, p.numero, p.estado, p.forma_pago, p.total_cop, p.creado, p.ciudad, p.atencion, p.version,
  (SELECT SUM(l.cantidad) FROM pedido_linea l WHERE l.org_id = p.org_id AND l.pedido_id = p.id) AS articulos`;

async function enFilas(q: Quien, kek: Kek | null, crudas: FilaCruda[]): Promise<FilaDePedido[]> {
  const contactos = await abrirContactos(
    q,
    kek,
    crudas.map((f) => f.id),
  );
  return crudas.map((f) => ({
    id: f.id,
    numero: f.numero,
    estado: f.estado,
    formaPago: f.forma_pago,
    totalCop: f.total_cop,
    creado: f.creado,
    ciudad: f.ciudad,
    articulos: f.articulos ?? 0,
    atencion: f.atencion,
    comprador: tapado(contactos.get(f.id)),
    version: f.version,
  }));
}

/** `creado|id` del último de la página: la siguiente empieza después. */
const leerCursor = (cursor: string | null) => {
  const [creado, id] = (cursor ?? '').split('|');
  return creado && id ? { creado, id } : null;
};

/**
 * HU-T9.1: una página de la bandeja. La primera trae aparte lo que necesita atención, de todos los
 * tiempos, para ponerlo antes de todo.
 */
export async function listarPedidos(
  q: Quien,
  kek: Kek | null,
  cursor: string | null,
  limite = 50,
): Promise<{ atencion: FilaDePedido[]; pedidos: FilaDePedido[]; siguiente: string | null }> {
  const desde = leerCursor(cursor);
  const { results } = await q.db
    .prepare(
      `SELECT ${COLUMNAS} FROM pedido p
        WHERE p.org_id = ? AND (? IS NULL OR p.creado < ? OR (p.creado = ? AND p.id < ?))
        ORDER BY p.creado DESC, p.id DESC LIMIT ?`,
    )
    .bind(
      q.org,
      desde?.creado ?? null,
      desde?.creado ?? null,
      desde?.creado ?? null,
      desde?.id ?? null,
      limite + 1,
    )
    .all<FilaCruda>();
  const pagina = results.slice(0, limite);
  const ultima = pagina.at(-1);
  let atencion: FilaCruda[] = [];
  if (!desde) {
    ({ results: atencion } = await q.db
      .prepare(
        `SELECT ${COLUMNAS} FROM pedido p
          WHERE p.org_id = ? AND p.atencion IS NOT NULL
            AND p.estado NOT IN (SELECT id FROM ref_estado_pedido WHERE terminal = 1)
          ORDER BY p.creado DESC LIMIT 50`,
      )
      .bind(q.org)
      .all<FilaCruda>());
  }
  return {
    atencion: await enFilas(q, kek, atencion),
    pedidos: await enFilas(q, kek, pagina),
    siguiente: results.length > limite && ultima ? `${ultima.creado}|${ultima.id}` : null,
  };
}

export interface PedidoDelPanel extends FilaDePedido {
  canal: string;
  subtotalCop: number;
  descuentoCop: number;
  envioCop: number;
  cuponCodigo: string | null;
  envioNombre: string | null;
  lineas: {
    variante: string;
    nombre: string;
    opciones: string;
    cantidad: number;
    precioUnitarioCop: number;
    totalCop: number;
    descontado: boolean;
  }[];
  historia: {
    instante: string;
    tipo: string;
    de: string | null;
    a: string | null;
    quien: string;
  }[];
  /** Si el comprador dejó datos de entrega: «Ver datos de entrega» los abre. */
  conContacto: boolean;
  /** HU-T9.4: con qué transportadora y qué guía salió. */
  transportadora: string | null;
  guia: string | null;
  /** HU-T9.4 y HU-T9.5: la plata de la contraentrega, desde que se despacha. */
  recaudo: Recaudo | null;
}

export interface Recaudo {
  estado: string;
  montoCop: number;
  comisionCop: number | null;
  fleteIdaCop: number | null;
  fleteVueltaCop: number | null;
  liquidado: string | null;
  liquidacionRef: string | null;
  /** HU-T9.5 CA2: lo que le queda al comercio, con la comisión y los fletes. */
  netoCop: number;
}

const quienEs = (actor: string, quienPregunta: string) =>
  actor === quienPregunta
    ? 'Tú'
    : actor === 'comprador'
      ? 'El comprador'
      : actor.startsWith('usuario:')
        ? 'Otra persona del equipo'
        : 'La tienda';

/** HU-T9.1: un pedido con sus líneas y su historia; el comprador, tapado. `null` si no es de la tienda. */
export async function leerPedido(
  q: Quien,
  kek: Kek | null,
  id: string,
): Promise<PedidoDelPanel | null> {
  const p = await q.db
    .prepare(
      `SELECT ${COLUMNAS}, p.canal, p.subtotal_cop, p.descuento_cop, p.envio_cop, p.cupon_codigo, p.envio_nombre,
              p.transportadora, p.guia,
              EXISTS (SELECT 1 FROM pedido_contacto c WHERE c.org_id = ? AND c.pedido_id = p.id) AS con_contacto
         FROM pedido p WHERE p.org_id = ? AND p.id = ?`,
    )
    .bind(q.org, q.org, id)
    .first<
      FilaCruda & {
        canal: string;
        subtotal_cop: number;
        descuento_cop: number;
        envio_cop: number;
        cupon_codigo: string | null;
        envio_nombre: string | null;
        transportadora: string | null;
        guia: string | null;
        con_contacto: number;
      }
    >();
  if (!p) return null;
  const [fila] = await enFilas(q, kek, [p]);
  const { results: lineas } = await q.db
    .prepare(
      `SELECT variante_id, nombre, opciones, cantidad, precio_unitario_cop, total_cop, descontado
         FROM pedido_linea WHERE org_id = ? AND pedido_id = ? ORDER BY linea`,
    )
    .bind(q.org, id)
    .all<{
      variante_id: string;
      nombre: string;
      opciones: string;
      cantidad: number;
      precio_unitario_cop: number;
      total_cop: number;
      descontado: number;
    }>();
  const { results: eventos } = await q.db
    .prepare(
      'SELECT instante, tipo, de, a, actor FROM pedido_evento WHERE org_id = ? AND pedido_id = ? ORDER BY id',
    )
    .bind(q.org, id)
    .all<{ instante: string; tipo: string; de: string | null; a: string | null; actor: string }>();
  const recaudo = await q.db
    .prepare(
      `SELECT estado, monto_cop, comision_cop, flete_ida_cop, flete_vuelta_cop, liquidado, liquidacion_ref
         FROM contraentrega WHERE org_id = ? AND pedido_id = ?`,
    )
    .bind(q.org, id)
    .first<{
      estado: string;
      monto_cop: number;
      comision_cop: number | null;
      flete_ida_cop: number | null;
      flete_vuelta_cop: number | null;
      liquidado: string | null;
      liquidacion_ref: string | null;
    }>();
  return {
    ...(fila as FilaDePedido),
    canal: p.canal,
    subtotalCop: p.subtotal_cop,
    descuentoCop: p.descuento_cop,
    envioCop: p.envio_cop,
    cuponCodigo: p.cupon_codigo,
    envioNombre: p.envio_nombre,
    lineas: lineas.map((l) => ({
      variante: l.variante_id,
      nombre: l.nombre,
      opciones: l.opciones,
      cantidad: l.cantidad,
      precioUnitarioCop: l.precio_unitario_cop,
      totalCop: l.total_cop,
      descontado: l.descontado === 1,
    })),
    historia: eventos.map((e) => ({
      instante: e.instante,
      tipo: e.tipo,
      de: e.de,
      a: e.a,
      quien: quienEs(e.actor, q.actor),
    })),
    conContacto: p.con_contacto === 1,
    transportadora: p.transportadora,
    guia: p.guia,
    recaudo: recaudo
      ? {
          estado: recaudo.estado,
          montoCop: recaudo.monto_cop,
          comisionCop: recaudo.comision_cop,
          fleteIdaCop: recaudo.flete_ida_cop,
          fleteVueltaCop: recaudo.flete_vuelta_cop,
          liquidado: recaudo.liquidado,
          liquidacionRef: recaudo.liquidacion_ref,
          netoCop: netoDelRecaudo({
            estado: recaudo.estado,
            montoCop: recaudo.monto_cop,
            comisionCop: recaudo.comision_cop,
            fleteIdaCop: recaudo.flete_ida_cop,
            fleteVueltaCop: recaudo.flete_vuelta_cop,
          }),
        }
      : null,
  };
}

const PeticionDeContacto = z.object({ pedido: z.string().min(1).max(64) });

export type ResultadoDelContacto =
  | { estado: 'ok'; contacto: ContactoDelPedido }
  | { estado: 'no-existe'; motivo: string }
  | { estado: 'sin-contacto'; motivo: string }
  | { estado: 'sin-llave'; motivo: string };

const SIN_CONTACTO =
  'Este pedido no tiene datos de entrega guardados: llegó por WhatsApp, y la conversación con el comprador está en ese chat.';

/** Abre el contacto de un pedido y deja la lectura en su historia y en el registro, en un lote. */
async function leerContacto(
  q: Quien,
  kek: Kek | null,
  cuerpo: unknown,
  para: 'ver' | 'whatsapp',
): Promise<ResultadoDelContacto & { numero?: number }> {
  const r0 = PeticionDeContacto.safeParse(cuerpo);
  if (!r0.success) return { estado: 'no-existe', motivo: 'Ese pedido no está.' };
  const id = r0.data.pedido;
  const p = await q.db
    .prepare('SELECT numero FROM pedido WHERE org_id = ? AND id = ?')
    .bind(q.org, id)
    .first<{ numero: number }>();
  if (!p) return { estado: 'no-existe', motivo: 'Ese pedido no está.' };
  if (!kek) {
    console.error('tienda-api: sin la KEK no se abren los datos de entrega');
    return {
      estado: 'sin-llave',
      motivo: 'No pudimos abrir los datos de entrega ahora. Intenta en unos minutos.',
    };
  }
  const contacto = (await abrirContactos(q, kek, [id])).get(id);
  if (!contacto) return { estado: 'sin-contacto', motivo: SIN_CONTACTO, numero: p.numero };
  await q.db.batch([
    q.db
      .prepare(
        `INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, actor, detalle)
         VALUES (?, ?, ?, 'contacto_leido', ?, ?)`,
      )
      .bind(q.org, id, q.instante, q.actor, JSON.stringify({ para })),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'pedido.contacto_ver',
      entidad: 'pedido',
      entidadId: id,
      antes: null,
      despues: { numero: p.numero, para },
      instante: q.instante,
    }),
  ]);
  return { estado: 'ok', contacto, numero: p.numero };
}

/** HU-T9.2: «Ver datos de entrega». La única respuesta del panel con el contacto en claro. */
export async function verContacto(
  q: Quien,
  kek: Kek | null,
  cuerpo: unknown,
): Promise<ResultadoDelContacto> {
  const { numero: _, ...r } = await leerContacto(q, kek, cuerpo, 'ver');
  return r;
}

const CUENTAS: Record<string, string> = {
  ahorros: 'cuenta de ahorros',
  corriente: 'cuenta corriente',
  deposito: 'depósito electrónico',
};

interface Transferencia {
  banco: string;
  tipoCuenta: string;
  numero: string;
  titular: string;
  documento: string;
}

/** Lo que sigue según la forma de pago, en la voz del comercio. */
function loQueSigue(forma: string, total: number, cuenta: Transferencia | null): string {
  const monto = formatearPesos(total);
  switch (forma) {
    case 'transferencia':
      return cuenta
        ? `Para pagar, transfiere ${monto} a ${cuenta.banco}, ${CUENTAS[cuenta.tipoCuenta] ?? cuenta.tipoCuenta} ${cuenta.numero}, a nombre de ${cuenta.titular} (${cuenta.documento}), y mándanos el comprobante por aquí.`
        : `Para pagar, te mandamos por aquí los datos de la cuenta para transferir ${monto}.`;
    case 'contraentrega':
      return `Lo pagas al recibirlo: ${monto} a la transportadora.`;
    case 'efectivo':
      return `Lo pagas en efectivo al recogerlo: ${monto}.`;
    case 'en_linea':
      return `Te mandamos por aquí el link para pagar ${monto} en línea.`;
    default:
      return `¿Cómo prefieres pagar los ${monto}? Te contamos las opciones.`;
  }
}

/**
 * HU-T9.3 CA1: el mensaje para confirmar con el comprador, y el enlace de WhatsApp que lo abre. Si
 * el comprador dejó su celular, va a su chat (y eso es leer el contacto: queda registrado); si no,
 * WhatsApp deja elegir el chat.
 */
export async function mensajeDeConfirmacion(
  q: Quien,
  kek: Kek | null,
  cuerpo: unknown,
): Promise<
  | { estado: 'ok'; url: string; mensaje: string }
  | { estado: 'no-existe' | 'sin-llave'; motivo: string }
> {
  const r0 = PeticionDeContacto.safeParse(cuerpo);
  if (!r0.success) return { estado: 'no-existe', motivo: 'Ese pedido no está.' };
  const pedido = await leerPedido(q, null, r0.data.pedido);
  if (!pedido) return { estado: 'no-existe', motivo: 'Ese pedido no está.' };
  let contacto: ContactoDelPedido | null = null;
  if (pedido.conContacto) {
    const r = await leerContacto(q, kek, cuerpo, 'whatsapp');
    if (r.estado === 'sin-llave' || r.estado === 'no-existe') return r;
    if (r.estado === 'ok') contacto = r.contacto;
  }
  const { results: ajustes } = await q.db
    .prepare(
      "SELECT seccion, datos FROM ajuste WHERE org_id = ? AND seccion IN ('identidad', 'cobro')",
    )
    .bind(q.org)
    .all<{ seccion: string; datos: string }>();
  const seccion = (s: string) =>
    JSON.parse(ajustes.find((a) => a.seccion === s)?.datos ?? '{}') as Record<string, unknown>;
  const tienda = await q.db
    .prepare('SELECT nombre FROM tienda WHERE org_id = ?')
    .bind(q.org)
    .first<{ nombre: string }>();
  const nombreTienda = String(seccion('identidad')['nombre'] ?? tienda?.nombre ?? 'la tienda');
  const cuenta = (seccion('cobro')['transferencia'] as Transferencia | undefined) ?? null;

  const saludo = contacto?.nombre ? `Hola, ${contacto.nombre.trim().split(/\s+/)[0]}.` : 'Hola.';
  const lineas = pedido.lineas.map(
    (l) =>
      `• ${l.cantidad} × ${l.nombre}${l.opciones ? ` (${l.opciones})` : ''}: ${formatearPesos(l.totalCop)}`,
  );
  const partes = [
    `${saludo} Te escribimos de ${nombreTienda} por tu pedido #${pedido.numero}:`,
    ...lineas,
    ...(pedido.descuentoCop > 0
      ? [
          `Descuento${pedido.cuponCodigo ? ` (${pedido.cuponCodigo})` : ''}: −${formatearPesos(pedido.descuentoCop)}`,
        ]
      : []),
    ...(pedido.envioNombre
      ? [`Envío (${pedido.envioNombre}): ${formatearPesos(pedido.envioCop)}`]
      : []),
    `Total: ${formatearPesos(pedido.totalCop)}`,
    ...(contacto?.direccion
      ? [`Lo enviamos a: ${contacto.direccion}${contacto.ciudad ? `, ${contacto.ciudad}` : ''}.`]
      : []),
    loQueSigue(pedido.formaPago, pedido.totalCop, cuenta),
    '¿Lo confirmamos?',
  ];
  const mensaje = partes.join('\n');
  const digitos = contacto?.celular?.replace(/\D/g, '') ?? '';
  const numero = digitos.length === 10 && digitos.startsWith('3') ? `57${digitos}` : digitos;
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
  return { estado: 'ok', url, mensaje };
}

const Confirmar = z.object({
  op: z.string().min(8).max(64),
  pedido: z.string().min(1).max(64),
  version: z.number().int().min(1),
});

/** Las combinaciones de un pedido: lo que confirmar puede agotar (HU-T4.5). */
export async function variantesDelPedido(q: Pick<Quien, 'db' | 'org'>, pedido: string) {
  const { results } = await q.db
    .prepare('SELECT DISTINCT variante_id FROM pedido_linea WHERE org_id = ? AND pedido_id = ?')
    .bind(q.org, pedido)
    .all<{ variante_id: string }>();
  return results.map((r) => r.variante_id);
}

/**
 * HU-T9.3 CA2: confirmar. En un lote: el estado (con la versión), el inventario de cada línea que
 * no ha salido, y el registro. Si no alcanza, lo dice con la combinación y no confirma (P1). La
 * base impide confirmar a mano un pago en línea (CA3).
 */
export async function confirmarPedido(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = Confirmar.safeParse(cuerpo);
  if (!r0.success) {
    return { estado: 'problemas', problemas: [{ campo: 'pedido', mensaje: 'falta el pedido' }] };
  }
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const p = await q.db
    .prepare('SELECT numero, estado, forma_pago, version FROM pedido WHERE org_id = ? AND id = ?')
    .bind(q.org, d.pedido)
    .first<{ numero: number; estado: string; forma_pago: string; version: number }>();
  if (!p) return { estado: 'no-existe', motivo: 'Ese pedido no está.' };
  if (p.version !== d.version)
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: p.version };
  const problema = (mensaje: string): Resultado => ({
    estado: 'problemas',
    problemas: [{ campo: 'pedido', mensaje }],
  });
  if (p.forma_pago === 'en_linea') {
    return problema(
      'Este pedido se paga en línea: se confirma solo cuando el pago llega. Si el comprador pagó por otro lado, cámbiale la forma de pago primero.',
    );
  }
  if (p.estado !== 'pendiente') return problema('Este pedido ya no está por confirmar.');

  const leerLineas = async () =>
    (
      await q.db
        .prepare(
          `SELECT l.linea, l.variante_id, l.nombre, l.opciones, l.cantidad, v.stock, v.reservado
             FROM pedido_linea l JOIN variante v ON v.org_id = l.org_id AND v.id = l.variante_id
            WHERE l.org_id = ? AND l.pedido_id = ? AND l.descontado = 0 ORDER BY l.linea`,
        )
        .bind(q.org, d.pedido)
        .all<{
          linea: number;
          variante_id: string;
          nombre: string;
          opciones: string;
          cantidad: number;
          stock: number | null;
          reservado: number;
        }>()
    ).results;
  const sinAlcanzar = (pendientes: Awaited<ReturnType<typeof leerLineas>>) => {
    const pide = new Map<string, number>();
    for (const l of pendientes)
      pide.set(l.variante_id, (pide.get(l.variante_id) ?? 0) + l.cantidad);
    const corta = pendientes.find(
      (l) => l.stock !== null && l.stock - l.reservado < (pide.get(l.variante_id) ?? 0),
    );
    if (!corta || corta.stock === null) return null;
    const hay = Math.max(0, corta.stock - corta.reservado);
    return problema(
      `No alcanza: de «${corta.nombre}${corta.opciones ? ` (${corta.opciones})` : ''}» ${hay === 1 ? 'hay 1' : `hay ${hay}`} y el pedido lleva ${pide.get(corta.variante_id)}. Habla con el comprador o ajusta el inventario antes de confirmar.`,
    );
  };
  const lineas = await leerLineas();
  const falta = sinAlcanzar(lineas);
  if (falta) return falta;

  const r: Resultado = { estado: 'guardado', id: d.pedido, version: p.version + 1 };
  const lote: SentenciaD1[] = [
    q.db
      .prepare(
        `UPDATE pedido SET estado = 'confirmado', cambiado_por = ?, version = version + 1, actualizado = ?
          WHERE org_id = ? AND id = ? AND version = ? AND estado = 'pendiente'`,
      )
      .bind(q.actor, q.instante, q.org, d.pedido, d.version),
    q.db.prepare(SI_CAMBIO),
    ...lineas
      .filter((l) => l.stock !== null)
      .map((l) =>
        q.db
          .prepare(
            `UPDATE variante SET stock = stock - ?, cambio_motivo = 'venta', cambio_ref = ?, actualizado = ?
              WHERE org_id = ? AND id = ?`,
          )
          .bind(l.cantidad, d.pedido, q.instante, q.org, l.variante_id),
      ),
    q.db
      .prepare('UPDATE pedido_linea SET descontado = 1 WHERE org_id = ? AND pedido_id = ?')
      .bind(q.org, d.pedido),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'pedido.confirmar',
      entidad: 'pedido',
      entidadId: d.pedido,
      antes: { numero: p.numero, estado: p.estado },
      despues: { numero: p.numero, estado: 'confirmado' },
      instante: q.instante,
    }),
    guardarOperacion(q, d.op, 'pedidos/confirmar', r),
  ];
  try {
    await q.db.batch(lote);
    return r;
  } catch (e) {
    if (esCambiado(e)) {
      const ahora = await q.db
        .prepare('SELECT version FROM pedido WHERE org_id = ? AND id = ?')
        .bind(q.org, d.pedido)
        .first<{ version: number }>();
      return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: ahora?.version ?? null };
    }
    if (esOperacionRepetida(e)) return (await yaAplicada(q, d.op)) ?? r;
    // Otra venta o un pago se llevó las unidades entre la lectura y el lote: el CHECK lo detuvo.
    if (/CHECK constraint failed/i.test(String(e))) {
      return (
        sinAlcanzar(await leerLineas()) ??
        problema(
          'No alcanza el inventario para confirmar. Revisa las existencias y vuelve a intentar.',
        )
      );
    }
    throw e;
  }
}
