/**
 * Pagar en línea con el botón de Bold (HU-T11.4, TIENDA-3.0 §7.2 y §9.3): `POST /api/v1/cobros`.
 *
 * Antes de escribir, lo mismo que un pedido por WhatsApp (los términos publicados, la cotización
 * del servidor y la edad, `prepararPedido`), y además: la tienda cobra en línea (`venta.modo`), tiene
 * las llaves de Bold del ambiente en que cobra (`cobro.ambiente`, pruebas si no dice), el total está
 * entre COP 1.000 y el tope, y la tienda no tiene ya 40 cobros abiertos.
 *
 * **Un solo lote** (CA1): vencer lo vencido de esas variantes, el pedido `por_pagar` con su
 * aceptación (el número es el siguiente, en la misma sentencia), sus líneas, el contacto cifrado,
 * el historial, el cobro `esperando` por 15 minutos y un apartado por línea. El trigger de
 * `apartado` suma a `variante.reservado`, y el CHECK `reservado <= stock` es la guarda: dos
 * compradores por la última unidad hacen que el segundo lote falle **entero** (CA3), sin pedido,
 * sin cobro y sin gastar consecutivo, porque D1 aplica un lote como una transacción.
 *
 * **La firma** (CA2) es `SHA-256(orderId + amount + "COP" + llave secreta)`, de `@ed1/pagos`. La
 * página recibe los datos del botón y guarda en `sessionStorage` solo su token, que nació en el
 * navegador: aquí queda su SHA-256 (`cobro.token_huella`). Reenviar el mismo pedido con el mismo
 * token responde el mismo botón (`duplicado`), sin otro cobro.
 *
 * Lo que sigue (el aviso de Bold, la consulta y cada respuesta) es HU-T11.5 a HU-T11.7.
 */
import type { BaseD1 } from '@ed1/d1';
import { proveedorBold } from '@ed1/pagos';
import { z } from 'zod';
import { cifrarContacto } from './bandeja.ts';
import type { Cotizacion } from './cotizar.ts';
import { type Ambiente, llavesDeBold } from './credenciales.ts';
import { kekDelEntorno } from './llaves.ts';
import {
  type ContextoDePedido,
  datosDeLaTienda,
  igual,
  lineasDelPedido,
  PeticionDePedido,
  prepararPedido,
  sha256,
} from './pedidos.ts';
import { indiceDelContacto, PURGAR_DESPUES } from './titular.ts';

/** Cuánto valen los apartados de un cobro: lo que tiene el comprador para pagar en Bold. */
export const MINUTOS_DEL_COBRO = 15;
/** Cobros abiertos por tienda (CA3): cada uno aparta unidades, y esto acota cuántas a la vez. */
export const COBROS_ABIERTOS_POR_TIENDA = 40;
/** Los montos que Bold acepta en el botón (TIENDA §9.3). */
export const MONTO_MINIMO = 1_000;
export const MONTO_MAXIMO = 5_000_000;

const TOKEN = /^[A-Za-z0-9_-]{22}$/;

export const PeticionDeCobro = PeticionDePedido.omit({ forma: true }).extend({
  /** El token opaco del cobro: lo crea la página y es lo único que guarda (CA2). */
  token: z.string().regex(TOKEN),
  /** Los datos de entrega, que la tienda necesita porque no hay chat: van cifrados. */
  entrega: z.object({
    nombre: z.string().trim().min(2).max(120),
    celular: z
      .string()
      .trim()
      .max(20)
      .refine((c) => /^3\d{9}$/.test(c.replace(/\D/g, '').replace(/^57(?=3\d{9}$)/, ''))),
    correo: z.email().max(200).optional(),
    direccion: z.string().trim().min(1).max(300).optional(),
    notas: z.string().trim().min(1).max(600).optional(),
  }),
});
export type PeticionDeCobro = z.infer<typeof PeticionDeCobro>;

export interface BotonDeBold {
  libreria: string;
  checkout: Record<string, string>;
}

export type ResultadoDeCobro =
  | {
      estado: 'registrado' | 'duplicado';
      codigo: string;
      numero: number;
      total: number;
      vence: string;
      boton: BotonDeBold;
    }
  | { estado: 'cambio'; cotizacion: Cotizacion }
  | { estado: 'terminos' | 'cerrada' | 'codigo-en-uso' | 'renovar' }
  | {
      estado: 'forma' | 'edad' | 'monto' | 'sin-linea' | 'ocupada' | 'pedido-existente';
      motivo: string;
    }
  | { estado: 'sin-existencias'; variante: string; motivo: string };

export interface ContextoDeCobro extends ContextoDePedido {
  /** La llave maestra del Worker (`TIENDA_KEK_V1`), para abrir las llaves de Bold y cifrar. */
  kekTexto: string | undefined;
}

export const OCUPADA = {
  estado: 'ocupada',
  motivo: 'La tienda tiene muchos pagos en curso. Intenta en unos minutos o pide por WhatsApp.',
} as const;

export const SIN_LINEA = {
  estado: 'sin-linea',
  motivo: 'El pago en línea no está disponible ahora. Puedes enviar tu pedido por WhatsApp.',
} as const;

/** «2026-10-14T15:15:00.000Z» en nanosegundos, como pide `expirationDate` de Bold. */
const enNanosegundos = (iso: string) => (BigInt(Date.parse(iso)) * 1_000_000n).toString();

export async function boton(
  c: ContextoDeCobro,
  llaves: NonNullable<Awaited<ReturnType<typeof llavesDeBold>>>,
  datos: {
    orden: string;
    monto: number;
    tienda: string;
    codigo: string;
    vence: string;
    entrega?: PeticionDeCobro['entrega'];
  },
): Promise<BotonDeBold> {
  const preparado = await proveedorBold(llaves, fetch).prepararCobro({
    orden: datos.orden,
    monto: datos.monto,
    descripcion: `Pedido ${datos.codigo} · ${datos.tienda}`,
    vuelta: `https://${c.host}/pedido/pago/`,
  });
  const e = datos.entrega;
  return {
    libreria: preparado.libreria,
    checkout: {
      ...preparado.checkout,
      renderMode: 'embedded',
      expirationDate: enNanosegundos(datos.vence),
      ...(e
        ? {
            customerData: JSON.stringify({
              fullName: e.nombre,
              phone: e.celular.replace(/\D/g, '').slice(-10),
              dialCode: '+57',
              ...(e.correo ? { email: e.correo } : {}),
            }),
          }
        : {}),
    },
  };
}

/**
 * El ambiente en que cobra la tienda (HU-T11.3): el de la versión que muestra. Así la franja «en
 * pruebas» y el cobro de verdad nunca se contradicen: pasar a producción en los ajustes cobra de
 * verdad cuando se publica, no antes. Una versión de antes de HU-T11.3 no lo guardó: usa el de los
 * ajustes, pruebas mientras no diga producción. `null`: la versión publicada no cobra en línea.
 */
export async function ambienteDe(
  db: BaseD1,
  org: string,
): Promise<{ ambiente: Ambiente; tope: number } | null> {
  const [fila, publicada] = await Promise.all([
    db
      .prepare("SELECT datos FROM ajuste WHERE org_id = ? AND seccion = 'cobro'")
      .bind(org)
      .first<{ datos: string }>(),
    db
      .prepare(
        `SELECT p.cobro_ambiente FROM tienda t JOIN publicacion p
           ON p.org_id = t.org_id AND p.version = t.version_publicada WHERE t.org_id = ?`,
      )
      .bind(org)
      .first<{ cobro_ambiente: string | null }>(),
  ]);
  const cobro = JSON.parse(fila?.datos ?? '{}') as { ambiente?: string; topeCop?: number };
  const deLaVersion = publicada?.cobro_ambiente ?? null;
  if (deLaVersion === 'ninguno') return null;
  const ambiente = deLaVersion ?? (cobro.ambiente === 'produccion' ? 'produccion' : 'pruebas');
  return {
    ambiente: ambiente === 'produccion' ? 'produccion' : 'pruebas',
    tope: Math.min(MONTO_MAXIMO, cobro.topeCop ?? MONTO_MAXIMO),
  };
}

/** Los apartados activos de estas variantes que ya vencieron pasan a `vencido` (el trigger resta). */
export const vencerApartados = (c: ContextoDeCobro, variantes: readonly string[]) =>
  c.db
    .prepare(
      `UPDATE apartado SET estado = 'vencido', cerrado = ?
        WHERE org_id = ? AND estado = 'activo' AND vence <= ?
          AND variante_id IN (${variantes.map(() => '?').join(', ')})`,
    )
    .bind(c.ahora, c.org, c.ahora, ...variantes);

/**
 * El mismo código otra vez. Con el mismo token y el cobro todavía abierto, otra vez su botón, firmado
 * con las llaves de ahora. Si el cobro de ese código ya se cerró (venció, se rechazó o nunca abrió)
 * y el pedido sigue por pagar, `renovar`: la página toma otro código y vuelve a intentar; el pedido
 * viejo se queda por pagar, por si el aviso de Bold llega tarde (HU-T11.6). Con otro token y el
 * cobro abierto, se está pagando en otra pestaña: se espera.
 */
async function repetido(
  c: ContextoDeCobro,
  pedidoId: string,
  p: PeticionDeCobro,
  tienda: string,
): Promise<ResultadoDeCobro> {
  const cobro = await c.db
    .prepare(
      `SELECT k.id, k.ambiente, k.monto_cop, k.vence, k.token_huella, p.codigo, p.numero, p.total_cop
         FROM cobro k JOIN pedido p ON p.org_id = k.org_id AND p.id = k.pedido_id
        WHERE k.org_id = ? AND k.pedido_id = ? AND k.estado = 'esperando' AND k.vence > ?`,
    )
    .bind(c.org, pedidoId, c.ahora)
    .first<{
      id: string;
      ambiente: Ambiente;
      monto_cop: number;
      vence: string;
      token_huella: string;
      codigo: string;
      numero: number;
      total_cop: number;
    }>();
  if (!cobro) {
    const pedido = await c.db
      .prepare('SELECT estado FROM pedido WHERE org_id = ? AND id = ?')
      .bind(c.org, pedidoId)
      .first<{ estado: string }>();
    if (pedido?.estado === 'por_pagar') return { estado: 'renovar' };
    return {
      estado: 'pedido-existente',
      motivo: 'Este pedido ya está registrado. Síguelo con el enlace de tu pedido.',
    };
  }
  const kek = await kekDelEntorno(c.kekTexto);
  if (!kek || !igual(cobro.token_huella, await sha256(p.token))) {
    return {
      estado: 'pedido-existente',
      motivo:
        'Este pedido se está pagando en otra pestaña o en otro navegador. Termina el pago allá, o vuelve a intentarlo aquí en 15 minutos.',
    };
  }
  const llaves = await llavesDeBold(c.db, c.org, cobro.ambiente, kek);
  if (!llaves) return SIN_LINEA;
  return {
    estado: 'duplicado',
    codigo: cobro.codigo,
    numero: cobro.numero,
    total: cobro.total_cop,
    vence: cobro.vence,
    boton: await boton(c, llaves, {
      orden: cobro.id,
      monto: cobro.monto_cop,
      tienda,
      codigo: cobro.codigo,
      vence: cobro.vence,
      entrega: p.entrega,
    }),
  };
}

/** Después de un CHECK que falló: la primera línea que ya no alcanza, para decirla. */
export async function laQueNoAlcanzo(
  c: ContextoDeCobro,
  carrito: Cotizacion['carrito'],
): Promise<string | null> {
  const { results } = await c.db
    .prepare(
      `SELECT v.id, v.stock, v.reservado FROM variante v
        WHERE v.org_id = ? AND v.id IN (${carrito.map(() => '?').join(', ')})`,
    )
    .bind(c.org, ...carrito.map((l) => l.variante))
    .all<{ id: string; stock: number | null; reservado: number }>();
  const porId = new Map(results.map((r) => [r.id, r]));
  for (const l of carrito) {
    const v = porId.get(l.variante);
    if (v && v.stock !== null && v.stock - v.reservado < l.cantidad) return l.variante;
  }
  return carrito[0]?.variante ?? null;
}

export async function iniciarCobro(
  c: ContextoDeCobro,
  p: PeticionDeCobro,
): Promise<ResultadoDeCobro> {
  const huellaDelSecreto = await sha256(p.seguimiento);
  const tienda = await datosDeLaTienda(c.db, c.org);

  const previo = await c.db
    .prepare('SELECT id, seguimiento_huella FROM pedido WHERE org_id = ? AND codigo = ?')
    .bind(c.org, p.codigo)
    .first<{ id: string; seguimiento_huella: string | null }>();
  if (previo) {
    if (!previo.seguimiento_huella || !igual(previo.seguimiento_huella, huellaDelSecreto)) {
      return { estado: 'codigo-en-uso' };
    }
    return repetido(c, previo.id, p, tienda.nombre);
  }

  if (tienda.venta['abierta'] === false) return { estado: 'cerrada' };
  // HU-T13.5 CA3: sin el plan que lo incluye, no cobra en línea; sigue recibiendo por WhatsApp.
  if (
    (tienda.venta['modo'] !== 'en_linea' && tienda.venta['modo'] !== 'ambos') ||
    !tienda.limites.cobroEnLinea
  ) {
    return { estado: 'forma', motivo: 'Esta tienda no cobra en línea. Elige otra forma de pago.' };
  }
  const kek = await kekDelEntorno(c.kekTexto);
  if (!kek) {
    console.error('tienda-api: sin la KEK no se abren las llaves de Bold ni se cifra la entrega');
    return SIN_LINEA;
  }
  const delCobro = await ambienteDe(c.db, c.org);
  if (!delCobro) return SIN_LINEA;
  const { ambiente, tope } = delCobro;
  const llaves = await llavesDeBold(c.db, c.org, ambiente, kek);
  if (!llaves) {
    console.error(`tienda-api: ${c.org} cobra en línea y le faltan las llaves de ${ambiente}`);
    return SIN_LINEA;
  }

  // Lo vencido se libera antes de cotizar: si no, la última unidad de un pago abandonado parece
  // agotada hasta que pase el cron (HU-T11.6). El lote lo vuelve a hacer, por si otro apartó entre tanto.
  await vencerApartados(c, [...new Set(p.lineas.map((l) => l.variante))]).run();
  const preparado = await prepararPedido(c, p);
  if ('estado' in preparado) return preparado;
  const { cotizacion, porId, conEdad, envio } = preparado;
  if (cotizacion.total < MONTO_MINIMO || cotizacion.total > tope) {
    return {
      estado: 'monto',
      motivo:
        cotizacion.total < MONTO_MINIMO
          ? 'El pago en línea es desde $1.000. Agrega algo más o elige otra forma de pago.'
          : 'Este total pasa el tope del pago en línea de la tienda. Elige otra forma de pago.',
    };
  }
  const abiertos = await c.db
    .prepare(
      "SELECT COUNT(*) AS n FROM cobro WHERE org_id = ? AND estado = 'esperando' AND vence > ?",
    )
    .bind(c.org, c.ahora)
    .first<{ n: number }>();
  if ((abiertos?.n ?? 0) >= COBROS_ABIERTOS_POR_TIENDA) return OCUPADA;

  const orden = `${p.codigo}-1`;
  const vence = new Date(Date.parse(c.ahora) + MINUTOS_DEL_COBRO * 60_000).toISOString();
  const contacto = { ...p.entrega, ...(p.ciudad ? { ciudad: p.ciudad } : {}) };
  const sobre = await cifrarContacto(c, kek, c.id, contacto, c.ahora);
  const indice = await indiceDelContacto(c, kek, contacto, c.ahora);
  const variantes = cotizacion.carrito.map((l) => l.variante);
  const lote = [
    // a. Lo vencido de estas variantes se libera antes de apartar (vencimiento perezoso).
    vencerApartados(c, variantes),
    c.db
      .prepare(
        `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, descuento_cop,
           envio_cop, total_cop, cupon_codigo, envio_opcion_id, envio_nombre, ciudad, seguimiento_huella,
           terminos_huella, aceptado, cambiado_por, creado, actualizado)
         VALUES (?, ?, ?, (SELECT COALESCE(MAX(numero), 1000) + 1 FROM pedido WHERE org_id = ?), 'por_pagar',
           'en_linea', 'en_linea', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'comprador', ?, ?)`,
      )
      .bind(
        c.org,
        c.id,
        p.codigo,
        c.org,
        cotizacion.subtotal,
        cotizacion.descuento,
        cotizacion.envio,
        cotizacion.total,
        p.cupon && cotizacion.descuento > 0 ? p.cupon.toUpperCase() : null,
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
    c.db
      .prepare(
        `INSERT INTO pedido_contacto (org_id, pedido_id, sobre, iv, llave_version, celular_indice, creado,
           purgar_despues) VALUES (?, ?, ?, ?, ?, ?, ?, ${PURGAR_DESPUES})`,
      )
      .bind(c.org, c.id, sobre.sobre, sobre.iv, sobre.version, indice, c.ahora, c.ahora, c.org),
    c.db
      .prepare(
        `INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, de, a, actor, detalle)
         VALUES (?, ?, ?, 'estado', NULL, 'por_pagar', 'comprador', ?)`,
      )
      .bind(
        c.org,
        c.id,
        c.ahora,
        JSON.stringify({ canal: 'en_linea', cobro: orden, mayorDeEdad: [...conEdad].sort() }),
      ),
    c.db
      .prepare(
        `INSERT INTO cobro (org_id, id, pedido_id, proveedor, ambiente, monto_cop, estado, token_huella, vence,
           creado, actualizado) VALUES (?, ?, ?, 'bold', ?, ?, 'esperando', ?, ?, ?, ?)`,
      )
      .bind(
        c.org,
        orden,
        c.id,
        ambiente,
        cotizacion.total,
        await sha256(p.token),
        vence,
        c.ahora,
        c.ahora,
      ),
    ...cotizacion.carrito.map((l) =>
      c.db
        .prepare(
          `INSERT INTO apartado (org_id, cobro_id, variante_id, cantidad, estado, vence, creado)
           VALUES (?, ?, ?, ?, 'activo', ?, ?)`,
        )
        .bind(c.org, orden, l.variante, l.cantidad, vence, c.ahora),
    ),
    // HU-T11.10: el tope de cobros abiertos se cuenta dentro del lote, que es una transacción.
    // Contado antes, 100 cobros a la vez pasaban todos (la batería de caos lo encontró: 101 abiertos).
    c.db
      .prepare(
        `SELECT CASE WHEN (SELECT count(*) FROM cobro INDEXED BY cobro_esperando
           WHERE org_id = ? AND estado = 'esperando' AND vence > ?) > ? THEN json('ocupada') ELSE 1 END`,
      )
      .bind(c.org, c.ahora, COBROS_ABIERTOS_POR_TIENDA),
  ];
  try {
    await c.db.batch(lote);
  } catch (e) {
    const texto = String(e);
    // El tope, contado en el lote: nada de este cobro quedó escrito.
    if (/malformed JSON/i.test(texto)) return OCUPADA;
    // Dos envíos del mismo pedido a la vez: el UNIQUE atrapa al segundo, que responde como duplicado.
    if (/UNIQUE/i.test(texto)) return iniciarCobro(c, p);
    // CA3: otro lote se llevó lo que quedaba. Nada de este quedó escrito.
    if (/CHECK/i.test(texto)) {
      const variante = await laQueNoAlcanzo(c, cotizacion.carrito);
      const nombre = variante ? porId.get(variante)?.nombre : undefined;
      return {
        estado: 'sin-existencias',
        variante: variante ?? '',
        motivo: `${nombre ? `De ${nombre} ya` : 'Ya'} no queda lo que pediste: alguien acaba de llevárselo. Revisa tu pedido.`,
      };
    }
    throw e;
  }
  return {
    estado: 'registrado',
    codigo: p.codigo,
    numero:
      (
        await c.db
          .prepare('SELECT numero FROM pedido WHERE org_id = ? AND id = ?')
          .bind(c.org, c.id)
          .first<{ numero: number }>()
      )?.numero ?? 0,
    total: cotizacion.total,
    vence,
    boton: await boton(c, llaves, {
      orden,
      monto: cotizacion.total,
      tienda: tienda.nombre,
      codigo: p.codigo,
      vence,
      entrega: p.entrega,
    }),
  };
}
