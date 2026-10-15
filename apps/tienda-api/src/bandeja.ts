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
import { taparCelular, taparNombre } from '@ed1/tienda-schema/tapado';
import { z } from 'zod';
import type { Quien } from './catalogo.ts';
import { deksDeLaTienda, dekVigente } from './llaves.ts';

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
  };
}
