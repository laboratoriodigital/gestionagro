/**
 * HU-P2.1 (sprint PF1): los correos del pedido al comprador, cuando el pedido se confirma, se paga,
 * se despacha o se cancela. Solo si el comprador dejó su correo.
 *
 * - Salen desde la marca con `Reply-To` al comercio, como el acuse (HU-T18.4), una sola vez por
 *   pedido y estado (`estado:<pedido>:<estado>`) y dentro del tope de la tienda y de la celda.
 *   Van con el tipo `acuse` del registro de correos: son correos al comprador sobre su pedido, y así
 *   no hace falta rehacer la tabla (su `CHECK` solo conoce tres tipos).
 * - El estado se lee de la base al armar el correo: si el pedido ya cambió (lo cancelaron justo
 *   después de confirmarlo), no se manda el viejo.
 * - El enlace de seguimiento no va: su secreto nace en el navegador y la base solo guarda su huella
 *   (TIENDA §8.4). El correo dice el código del pedido y que el enlace es el de su primer correo.
 * - Un correo que falla nunca cambia el pedido: quien lo pide lo manda en segundo plano.
 */
import type { Kek } from '@ed1/cifrado';
import { formatearPesos } from '@ed1/dinero';
import { abrirContactos } from './bandeja.ts';
import {
  type ContextoDeCorreo,
  correosDeLaTienda,
  mandarUnaVez,
  type ResultadoDelCorreo,
} from './correos.ts';

export const ESTADOS_AVISADOS = ['confirmado', 'pagado', 'despachado', 'cancelado'] as const;
export type EstadoAvisado = (typeof ESTADOS_AVISADOS)[number];

export interface DatosDelAviso {
  tienda: string;
  codigo: string;
  nombre?: string | undefined;
  totalCop: number;
  transportadora?: string | null;
  guia?: string | null;
  responderA: boolean;
}

/** El texto de cada estado: lo que pasó y lo que sigue, sin tecnicismos. */
export function correoDelEstado(
  estado: EstadoAvisado,
  d: DatosDelAviso,
): { asunto: string; texto: string } {
  const hola = d.nombre ? `Hola, ${d.nombre}:` : 'Hola:';
  const cuerpo: Record<EstadoAvisado, { asunto: string; lineas: string[] }> = {
    confirmado: {
      asunto: `${d.tienda} confirmó tu pedido ${d.codigo}`,
      lineas: [
        `${d.tienda} confirmó tu pedido ${d.codigo}, por ${formatearPesos(d.totalCop)}. Ya lo están preparando.`,
        'Te avisamos por aquí cuando salga.',
      ],
    },
    pagado: {
      asunto: `Recibimos tu pago del pedido ${d.codigo}`,
      lineas: [
        `Tu pago de ${formatearPesos(d.totalCop)} para el pedido ${d.codigo} en ${d.tienda} quedó aprobado.`,
        'Te avisamos por aquí cuando salga.',
      ],
    },
    despachado: {
      asunto: `Tu pedido ${d.codigo} va en camino`,
      lineas: [
        `${d.tienda} despachó tu pedido ${d.codigo}.`,
        ...(d.transportadora && d.guia
          ? [`Va con ${d.transportadora}, guía ${d.guia}.`]
          : d.transportadora
            ? [`Va con ${d.transportadora}.`]
            : []),
      ],
    },
    cancelado: {
      asunto: `Tu pedido ${d.codigo} fue cancelado`,
      lineas: [
        `${d.tienda} canceló tu pedido ${d.codigo}.`,
        'Si ya habías pagado, la tienda te devuelve el dinero. Si tienes dudas, escríbele.',
      ],
    },
  };
  const c = cuerpo[estado];
  return {
    asunto: c.asunto,
    texto: [
      hola,
      '',
      ...c.lineas,
      '',
      'Puedes seguir tu pedido con el enlace del primer correo que te llegó, o con el que te dio la tienda.',
      ...(d.responderA ? ['', `¿Preguntas? Responde este correo: le llega a ${d.tienda}.`] : []),
    ].join('\n'),
  };
}

/**
 * Manda el correo de un estado, si el pedido sigue en él y el comprador dejó su correo. `no-toca`
 * si no hay a quién o el pedido ya está en otro estado.
 */
export async function avisarAlComprador(
  c: ContextoDeCorreo,
  kek: Kek | null,
  pedidoId: string,
  estado: EstadoAvisado,
): Promise<ResultadoDelCorreo | 'no-toca'> {
  const p = await c.db
    .prepare(
      'SELECT codigo, estado, total_cop, transportadora, guia FROM pedido WHERE org_id = ? AND id = ?',
    )
    .bind(c.org, pedidoId)
    .first<{
      codigo: string;
      estado: string;
      total_cop: number;
      transportadora: string | null;
      guia: string | null;
    }>();
  if (!p || p.estado !== estado) return 'no-toca';
  const quien = { db: c.db, org: c.org, actor: 'sistema', instante: c.ahora };
  const contacto = (await abrirContactos(quien, kek, [pedidoId])).get(pedidoId);
  const para = contacto?.correo;
  if (!para) return 'no-toca';
  const t = await correosDeLaTienda(c.db, c.org);
  return mandarUnaVez(c, `estado:${pedidoId}:${estado}`, 'acuse', () => ({
    para,
    nombre: t.nombre,
    ...(t.responderA ? { responderA: t.responderA } : {}),
    ...correoDelEstado(estado, {
      tienda: t.nombre,
      codigo: p.codigo,
      nombre: contacto?.nombre,
      totalCop: p.total_cop,
      transportadora: p.transportadora,
      guia: p.guia,
      responderA: t.responderA !== null,
    }),
  }));
}
