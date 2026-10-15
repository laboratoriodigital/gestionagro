/**
 * El pedido después de confirmarlo (TIENDA-3.0 §8.7):
 *
 * - **Despachar con guía (HU-T9.4).** La transportadora y la guía quedan en el pedido, y el
 *   comprador las ve en su seguimiento. Un pedido contra entrega nace con su recaudo
 *   `por_recaudar` en el mismo lote, con la comisión y el flete de ida si el comercio los conoce;
 *   sin la guía o sin el recaudo, la base no lo deja despachar (`pedido_despachado_contraentrega`).
 */
import type { SentenciaD1 } from '@ed1/d1';
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
import { anotar } from './registro.ts';

const Op = z.string().min(8).max(64);
const IdDePedido = z.string().min(1).max(64);
/** Pesos enteros, o nada si el comercio no lo sabe todavía. */
const PesosOpcionales = z
  .number({ error: 'escribe el valor en pesos, sin puntos' })
  .int({ error: 'escribe el valor en pesos, sin puntos' })
  .min(0, { error: 'no puede ser negativo' })
  .max(100_000_000, { error: 'revisa el valor: es demasiado alto' })
  .nullable()
  .optional();

type Problema = { campo: string; mensaje: string };
const problemas = (...p: Problema[]): Resultado => ({ estado: 'problemas', problemas: p });
const problemasDe = (r: z.ZodSafeParseResult<unknown>): Problema[] =>
  r.success
    ? []
    : r.error.issues.map((i) => ({ campo: i.path.map(String).join('.'), mensaje: i.message }));

interface FilaDelPedido {
  numero: number;
  estado: string;
  forma_pago: string;
  total_cop: number;
  version: number;
}

async function leerFila(q: Quien, id: string) {
  return q.db
    .prepare(
      'SELECT numero, estado, forma_pago, total_cop, version FROM pedido WHERE org_id = ? AND id = ?',
    )
    .bind(q.org, id)
    .first<FilaDelPedido>();
}

/**
 * Corre el lote. Si otra escritura ganó, responde `cambiado` con la versión de ahora; si la misma
 * `op` entró por otro lado, la respuesta de aquella; si un trigger lo detuvo, lo que diga `traducir`.
 */
async function aplicar(
  q: Quien,
  op: string,
  pedido: string,
  lote: SentenciaD1[],
  r: Resultado,
  traducir: (e: unknown) => Resultado | null = () => null,
): Promise<Resultado> {
  try {
    await q.db.batch(lote);
    return r;
  } catch (e) {
    if (esCambiado(e)) {
      const ahora = await leerFila(q, pedido);
      return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: ahora?.version ?? null };
    }
    if (esOperacionRepetida(e)) return (await yaAplicada(q, op)) ?? r;
    const dicho = traducir(e);
    if (dicho) return dicho;
    throw e;
  }
}

// ── HU-T9.4: despachar ──────────────────────────────────────────────────────────────────────

const Despachar = z.object({
  op: Op,
  pedido: IdDePedido,
  version: z.number().int().min(1),
  transportadora: z.string().trim().max(80, { error: 'máximo 80 letras' }).default(''),
  guia: z.string().trim().max(60, { error: 'máximo 60 letras' }).default(''),
  comisionCop: PesosOpcionales,
  fleteIdaCop: PesosOpcionales,
});

export const FALTA_GUIA =
  'Falta la guía: sin ella no se puede seguir la plata de la contraentrega ni el comprador puede rastrear su paquete.';
export const FALTA_TRANSPORTADORA = 'Falta la transportadora que lleva el paquete.';

export async function despacharPedido(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = Despachar.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const p = await leerFila(q, d.pedido);
  if (!p) return { estado: 'no-existe', motivo: 'Ese pedido no está.' };
  if (p.version !== d.version)
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: p.version };
  if (p.estado === 'pendiente' || p.estado === 'por_pagar')
    return problemas({ campo: 'pedido', mensaje: 'Confirma el pedido antes de despacharlo.' });
  if (p.estado !== 'confirmado' && p.estado !== 'pagado')
    return problemas({ campo: 'pedido', mensaje: 'Este pedido ya no está por despachar.' });

  const contraentrega = p.forma_pago === 'contraentrega';
  // CA2: el panel dice cuál falta. La base también lo exige (la guía y la fila del recaudo).
  if (contraentrega) {
    const faltan: Problema[] = [];
    if (!d.transportadora) faltan.push({ campo: 'transportadora', mensaje: FALTA_TRANSPORTADORA });
    if (!d.guia) faltan.push({ campo: 'guia', mensaje: FALTA_GUIA });
    if (faltan.length) return problemas(...faltan);
  }

  const r: Resultado = { estado: 'guardado', id: d.pedido, version: p.version + 1 };
  const lote: SentenciaD1[] = [
    // CA1: el recaudo nace en el mismo lote, antes del cambio de estado que lo exige.
    ...(contraentrega
      ? [
          q.db
            .prepare(
              `INSERT INTO contraentrega (org_id, pedido_id, estado, monto_cop, comision_cop, flete_ida_cop,
                 cambiado_por, creado, actualizado)
               VALUES (?, ?, 'por_recaudar', ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              q.org,
              d.pedido,
              p.total_cop,
              d.comisionCop ?? null,
              d.fleteIdaCop ?? null,
              q.actor,
              q.instante,
              q.instante,
            ),
        ]
      : []),
    q.db
      .prepare(
        `UPDATE pedido SET estado = 'despachado', transportadora = ?, guia = ?, cambiado_por = ?,
           version = version + 1, actualizado = ?
          WHERE org_id = ? AND id = ? AND version = ? AND estado IN ('confirmado', 'pagado')`,
      )
      .bind(
        d.transportadora || null,
        d.guia || null,
        q.actor,
        q.instante,
        q.org,
        d.pedido,
        d.version,
      ),
    q.db.prepare(SI_CAMBIO),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'pedido.despachar',
      entidad: 'pedido',
      entidadId: d.pedido,
      antes: { numero: p.numero, estado: p.estado },
      despues: {
        numero: p.numero,
        estado: 'despachado',
        transportadora: d.transportadora || null,
        guia: d.guia || null,
      },
      instante: q.instante,
    }),
    guardarOperacion(q, d.op, 'pedidos/despachar', r),
  ];
  return aplicar(q, d.op, d.pedido, lote, r, (e) =>
    /contraentrega-sin-guia/.test(String(e))
      ? problemas({ campo: 'guia', mensaje: FALTA_GUIA })
      : null,
  );
}
