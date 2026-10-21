/**
 * Confirmar el pedido que preparó un asistente (HU-T15.5, TIENDA-3.0 §8.2 canal agente, PLATAFORMA
 * §5.6): `POST /api/v1/pedidos/confirmar`, desde `/pedido/confirmar/#c=<código>&s=<secreto>`.
 *
 * - **La persona da lo que el agente no dio** (CA1): la aceptación de los términos publicados, la
 *   forma de pago, la edad si algún producto la pide y, para pagar en línea, sus datos de entrega.
 * - **Antes de escribir se vuelve a cotizar** lo que se preparó: si cambió el precio, el envío o
 *   lo que hay, no se confirma y la página lo dice; la persona arma el pedido en la tienda.
 * - **Por WhatsApp:** el pedido sigue `pendiente`, ahora con su aceptación y su forma, como uno
 *   hecho en la tienda (§8.2), y la respuesta trae el texto para mandarlo.
 * - **En línea:** en un lote, como el botón de Bold (HU-T11.4): pasa a `por_pagar`, nace el cobro de
 *   15 minutos y se aparta cada línea. Antes de eso, ninguna unidad se aparta (CA3 de HU-T15.4).
 * - **CA3:** sin la aceptación, el pedido no sale de `pendiente`; el trigger `pedido_aceptacion` lo
 *   garantiza también en la base. Confirmar dos veces no hace otro pedido ni otro cobro.
 */
import type { BaseD1 } from '@ed1/d1';
import { formasDelPlan } from '@ed1/tienda-schema';
import { z } from 'zod';
import { cifrarContacto } from './bandeja.ts';
import {
  ambienteDe,
  type BotonDeBold,
  boton,
  COBROS_ABIERTOS_POR_TIENDA,
  type ContextoDeCobro,
  MINUTOS_DEL_COBRO,
  MONTO_MINIMO,
  OCUPADA,
  PeticionDeCobro,
  SIN_LINEA,
  vencerApartados,
} from './cobros.ts';
import type { Cotizacion } from './cotizar.ts';
import { llavesDeBold } from './credenciales.ts';
import { kekDelEntorno } from './llaves.ts';
import {
  datosDeLaTienda,
  datosDelPedidoEscrito,
  enlaceDeSeguimiento,
  FORMAS_POR_WHATSAPP,
  igual,
  prepararPedido,
  sha256,
  textoDelPedido,
} from './pedidos.ts';
import { indiceDelContacto, PURGAR_DESPUES } from './titular.ts';

const CROCKFORD = /^[0-9A-HJKMNP-TV-Z]{6}$/;
const SECRETO = /^[A-Za-z0-9_-]{22}$/;

export const PeticionDeConfirmar = z.object({
  codigo: z.string().regex(CROCKFORD),
  secreto: z.string().regex(SECRETO),
  forma: z.enum([...FORMAS_POR_WHATSAPP, 'en_linea']),
  /** La casilla, que nunca viene marcada (Ley 1480 art. 50 lit. d). */
  acepta: z.literal(true),
  terminos: z.string().regex(/^[0-9a-f]{64}$/),
  totalVisto: z.number().int().min(0),
  /** Las combinaciones para mayores de edad que la persona confirmó. */
  mayorDeEdad: z.array(z.string().min(1).max(64)).max(50).optional(),
  ciudad: z.string().trim().min(1).max(60).optional(),
  /** Solo en línea: el token del cobro y la entrega, como el botón de Bold. */
  token: PeticionDeCobro.shape.token.optional(),
  entrega: PeticionDeCobro.shape.entrega.optional(),
});
export type PeticionDeConfirmar = z.infer<typeof PeticionDeConfirmar>;

export type ResultadoDeConfirmar =
  | {
      estado: 'confirmado';
      codigo: string;
      numero: number;
      total: number;
      texto: string;
      whatsapp: string | null;
      enlace: string;
    }
  | {
      estado: 'por-pagar';
      codigo: string;
      numero: number;
      total: number;
      vence: string;
      boton: BotonDeBold;
      enlace: string;
    }
  | { estado: 'no-encontrado' | 'terminos' | 'cerrada' }
  | { estado: 'ya-confirmado'; enlace: string; motivo: string }
  | { estado: 'cambio'; motivo: string; cotizacion: Cotizacion }
  | {
      estado: 'forma' | 'edad' | 'monto' | 'entrega' | 'sin-linea' | 'ocupada' | 'sin-existencias';
      motivo: string;
    };

const YA = 'Este pedido ya está confirmado. Síguelo con su enlace.';
const CAMBIO =
  'Desde que tu asistente lo preparó cambió el precio, el envío o lo que hay. Arma tu pedido en la tienda, o pídele a tu asistente que lo prepare de nuevo.';

interface PedidoPorConfirmar {
  id: string;
  codigo: string;
  numero: number;
  estado: string;
  canal: string;
  aceptado: string | null;
  seguimiento_huella: string | null;
  total_cop: number;
  envio_opcion_id: string | null;
  cupon_codigo: string | null;
  ciudad: string | null;
}

export async function confirmarPedidoDeAgente(
  c: ContextoDeCobro,
  p: PeticionDeConfirmar,
): Promise<ResultadoDeConfirmar> {
  const pedido = await c.db
    .prepare(
      `SELECT id, codigo, numero, estado, canal, aceptado, seguimiento_huella, total_cop, envio_opcion_id,
         cupon_codigo, ciudad FROM pedido WHERE org_id = ? AND codigo = ?`,
    )
    .bind(c.org, p.codigo)
    .first<PedidoPorConfirmar>();
  // El mismo trabajo con o sin pedido, y la misma respuesta para todo fallo (HU-T6.3 CA3).
  const huellaDada = await sha256(p.secreto);
  if (!pedido?.seguimiento_huella || !igual(pedido.seguimiento_huella, huellaDada)) {
    return { estado: 'no-encontrado' };
  }
  const enlace = enlaceDeSeguimiento(c.host, pedido.codigo, p.secreto);
  if (pedido.canal !== 'agente' || pedido.aceptado !== null || pedido.estado !== 'pendiente') {
    return { estado: 'ya-confirmado', enlace, motivo: YA };
  }
  if (!c.terminosPublicados || !igual(c.terminosPublicados, p.terminos))
    return { estado: 'terminos' };

  const tienda = await datosDeLaTienda(c.db, c.org);
  if (tienda.venta['abierta'] === false) return { estado: 'cerrada' };
  const enLinea = tienda.venta['modo'] === 'en_linea' || tienda.venta['modo'] === 'ambos';
  const ofrecidas = formasDelPlan(
    (tienda.venta['formas'] ?? []) as { forma: string }[],
    tienda.limites,
    enLinea,
  ).map((f) => f.forma);
  const pagaEnLinea = p.forma === 'en_linea';
  if (pagaEnLinea ? !enLinea || !tienda.limites.cobroEnLinea : !ofrecidas.includes(p.forma)) {
    return { estado: 'forma', motivo: 'Esta tienda no ofrece esa forma de pago. Elige otra.' };
  }

  // Lo que se preparó, cotizado otra vez: si algo cambió, no se confirma.
  const { results: lineas } = await c.db
    .prepare(
      'SELECT variante_id, cantidad FROM pedido_linea WHERE org_id = ? AND pedido_id = ? ORDER BY linea',
    )
    .bind(c.org, pedido.id)
    .all<{ variante_id: string; cantidad: number }>();
  const conEdad = new Set(p.mayorDeEdad ?? []);
  if (pagaEnLinea)
    await vencerApartados(
      c,
      lineas.map((l) => l.variante_id),
    ).run();
  const preparado = await prepararPedido(
    { ...c, id: pedido.id },
    {
      lineas: lineas.map((l) => ({
        variante: l.variante_id,
        cantidad: l.cantidad,
        ...(conEdad.has(l.variante_id) ? { mayorDeEdad: true as const } : {}),
      })),
      totalVisto: p.totalVisto,
      terminos: p.terminos,
      ...(pedido.envio_opcion_id ? { envio: pedido.envio_opcion_id } : {}),
      ...(pedido.cupon_codigo ? { cupon: pedido.cupon_codigo } : {}),
    },
  );
  if ('estado' in preparado) {
    if (preparado.estado === 'edad') return preparado;
    if (preparado.estado === 'terminos') return preparado;
    return { estado: 'cambio', motivo: CAMBIO, cotizacion: preparado.cotizacion };
  }
  if (preparado.cotizacion.total !== pedido.total_cop) {
    return { estado: 'cambio', motivo: CAMBIO, cotizacion: preparado.cotizacion };
  }
  const ciudad = p.ciudad ?? pedido.ciudad;
  const aceptacion = c.db
    .prepare(
      `INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, de, a, actor, detalle)
       VALUES (?, ?, ?, 'aceptacion', NULL, NULL, 'comprador', ?)`,
    )
    .bind(
      c.org,
      pedido.id,
      c.ahora,
      JSON.stringify({ forma: p.forma, mayorDeEdad: [...conEdad].sort() }),
    );
  // Que nadie lo haya confirmado entre tanto: dentro del lote, que es una transacción.
  const sigueSinConfirmar = c.db
    .prepare(
      `SELECT CASE WHEN EXISTS (SELECT 1 FROM pedido WHERE org_id = ? AND id = ? AND estado = 'pendiente'
         AND aceptado IS NULL) THEN 1 ELSE json('confirmado') END`,
    )
    .bind(c.org, pedido.id);

  if (!pagaEnLinea) {
    try {
      await c.db.batch([
        sigueSinConfirmar,
        c.db
          .prepare(
            `UPDATE pedido SET forma_pago = ?, terminos_huella = ?, aceptado = ?, ciudad = ?, cambiado_por = 'comprador',
               actualizado = ?, version = version + 1
             WHERE org_id = ? AND id = ? AND estado = 'pendiente' AND aceptado IS NULL`,
          )
          .bind(p.forma, p.terminos, c.ahora, ciudad, c.ahora, c.org, pedido.id),
        aceptacion,
      ]);
    } catch (e) {
      if (/malformed JSON/i.test(String(e))) return { estado: 'ya-confirmado', enlace, motivo: YA };
      throw e;
    }
    const d = await datosDelPedidoEscrito(c, pedido.id, tienda.nombre, p.secreto);
    return {
      estado: 'confirmado',
      codigo: d.codigo,
      numero: d.numero,
      total: d.total,
      texto: textoDelPedido(d),
      whatsapp: tienda.whatsapp,
      enlace,
    };
  }

  // En línea: lo mismo que el botón de Bold, sobre el pedido que ya existe.
  if (!p.token || !p.entrega) {
    return { estado: 'entrega', motivo: 'Para pagar en línea, escribe a quién se lo entregamos.' };
  }
  const kek = await kekDelEntorno(c.kekTexto);
  if (!kek) return SIN_LINEA;
  const delCobro = await ambienteDe(c.db, c.org);
  if (!delCobro) return SIN_LINEA;
  const llaves = await llavesDeBold(c.db, c.org, delCobro.ambiente, kek);
  if (!llaves) return SIN_LINEA;
  const { cotizacion } = preparado;
  if (cotizacion.total < MONTO_MINIMO || cotizacion.total > delCobro.tope) {
    return {
      estado: 'monto',
      motivo:
        cotizacion.total < MONTO_MINIMO
          ? 'El pago en línea es desde $1.000. Elige otra forma de pago.'
          : 'Este total pasa el tope del pago en línea de la tienda. Elige otra forma de pago.',
    };
  }
  const orden = `${pedido.codigo}-1`;
  const vence = new Date(Date.parse(c.ahora) + MINUTOS_DEL_COBRO * 60_000).toISOString();
  const contacto = { ...p.entrega, ...(ciudad ? { ciudad } : {}) };
  const ctx = { ...c, id: pedido.id };
  const sobre = await cifrarContacto(ctx, kek, pedido.id, contacto, c.ahora);
  const indice = await indiceDelContacto(ctx, kek, contacto, c.ahora);
  const variantes = cotizacion.carrito.map((l) => l.variante);
  try {
    await c.db.batch([
      sigueSinConfirmar,
      vencerApartados(c, variantes),
      c.db
        .prepare(
          `UPDATE pedido SET estado = 'por_pagar', forma_pago = 'en_linea', terminos_huella = ?, aceptado = ?, ciudad = ?,
             cambiado_por = 'comprador', actualizado = ?, version = version + 1
           WHERE org_id = ? AND id = ? AND estado = 'pendiente' AND aceptado IS NULL`,
        )
        .bind(p.terminos, c.ahora, ciudad, c.ahora, c.org, pedido.id),
      aceptacion,
      c.db
        .prepare(
          `INSERT INTO pedido_contacto (org_id, pedido_id, sobre, iv, llave_version, celular_indice, creado,
             purgar_despues) VALUES (?, ?, ?, ?, ?, ?, ?, ${PURGAR_DESPUES})`,
        )
        .bind(
          c.org,
          pedido.id,
          sobre.sobre,
          sobre.iv,
          sobre.version,
          indice,
          c.ahora,
          c.ahora,
          c.org,
        ),
      c.db
        .prepare(
          `INSERT INTO cobro (org_id, id, pedido_id, proveedor, ambiente, monto_cop, estado, token_huella, vence,
             creado, actualizado) VALUES (?, ?, ?, 'bold', ?, ?, 'esperando', ?, ?, ?, ?)`,
        )
        .bind(
          c.org,
          orden,
          pedido.id,
          delCobro.ambiente,
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
      c.db
        .prepare(
          `SELECT CASE WHEN (SELECT count(*) FROM cobro INDEXED BY cobro_esperando
             WHERE org_id = ? AND estado = 'esperando' AND vence > ?) > ? THEN json('ocupada') ELSE 1 END`,
        )
        .bind(c.org, c.ahora, COBROS_ABIERTOS_POR_TIENDA),
    ]);
  } catch (e) {
    const texto = String(e);
    if (/malformed JSON/i.test(texto)) {
      return (await sigueSinConfirmarAhora(c.db, c.org, pedido.id))
        ? OCUPADA
        : { estado: 'ya-confirmado', enlace, motivo: YA };
    }
    if (/CHECK/i.test(texto)) {
      return {
        estado: 'sin-existencias',
        motivo:
          'Ya no queda lo que pediste: alguien acaba de llevárselo. Arma tu pedido en la tienda.',
      };
    }
    throw e;
  }
  return {
    estado: 'por-pagar',
    codigo: pedido.codigo,
    numero: pedido.numero,
    total: cotizacion.total,
    vence,
    enlace,
    boton: await boton(c, llaves, {
      orden,
      monto: cotizacion.total,
      tienda: tienda.nombre,
      codigo: pedido.codigo,
      vence,
      entrega: p.entrega,
    }),
  };
}

async function sigueSinConfirmarAhora(db: BaseD1, org: string, id: string): Promise<boolean> {
  const f = await db
    .prepare('SELECT estado, aceptado FROM pedido WHERE org_id = ? AND id = ?')
    .bind(org, id)
    .first<{ estado: string; aceptado: string | null }>();
  return f?.estado === 'pendiente' && f.aceptado === null;
}

/** CA2: las horas que tiene la persona para confirmar lo que preparó su asistente. */
export const HORAS_PARA_CONFIRMAR = 48;

/**
 * CA2: los preparados que nadie confirmó en 48 horas pasan a `cancelado`, en todas las tiendas del
 * shard a la vez. Lee solo el índice parcial de los que esperan (0018), nunca los demás pedidos.
 */
export async function cancelarPreparadosVencidos(db: BaseD1, instante: string): Promise<number> {
  const antes = new Date(Date.parse(instante) - HORAS_PARA_CONFIRMAR * 3_600_000).toISOString();
  const r = await db
    .prepare(
      `UPDATE pedido INDEXED BY pedido_de_agente_por_confirmar
          SET estado = 'cancelado', cambiado_por = 'sistema', actualizado = ?, version = version + 1
        WHERE canal = 'agente' AND estado = 'pendiente' AND aceptado IS NULL AND creado < ?`,
    )
    .bind(instante, antes)
    .run();
  return r.meta?.changes ?? 0;
}
