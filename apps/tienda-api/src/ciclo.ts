/**
 * El pedido después de confirmarlo (TIENDA-3.0 §8.7):
 *
 * - **Despachar con guía (HU-T9.4).** La transportadora y la guía quedan en el pedido, y el
 *   comprador las ve en su seguimiento. Un pedido contra entrega nace con su recaudo
 *   `por_recaudar` en el mismo lote, con la comisión y el flete de ida si el comercio los conoce;
 *   sin la guía o sin el recaudo, la base no lo deja despachar (`pedido_despachado_contraentrega`).
 * - **Recaudos (HU-T9.5).** Entregar contra entrega es recaudar, en el mismo lote; devolver dice el
 *   flete de vuelta y si las unidades vuelven al inventario; «perdido» queda aparte. Liquidar marca
 *   varios recaudos con el número de la liquidación de la transportadora. La base no deja entregar
 *   con la plata por recaudar, ni liquidar lo que no se recaudó.
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

// ── HU-T9.5: entregar, devolver, perder y liquidar ──────────────────────────────────────────

const CambioDeEstado = z.object({ op: Op, pedido: IdDePedido, version: z.number().int().min(1) });

/** El cambio de estado del pedido, con la versión: si otra escritura ganó, el lote se detiene. */
const cambiarEstado = (q: Quien, id: string, version: number, de: readonly string[], a: string) => [
  q.db
    .prepare(
      `UPDATE pedido SET estado = ?, cambiado_por = ?, version = version + 1, actualizado = ?
        WHERE org_id = ? AND id = ? AND version = ? AND estado IN (${de.map(() => '?').join(', ')})`,
    )
    .bind(a, q.actor, q.instante, q.org, id, version, ...de),
  q.db.prepare(SI_CAMBIO),
];

/** La fila de la contraentrega pasa de `por_recaudar` a `a`; el trigger la lleva a la historia. */
const cerrarRecaudo = (q: Quien, id: string, a: string, fleteVuelta: number | null = null) => [
  q.db
    .prepare(
      `UPDATE contraentrega SET estado = ?, flete_vuelta_cop = ?, cambiado_por = ?, actualizado = ?
        WHERE org_id = ? AND pedido_id = ? AND estado = 'por_recaudar'`,
    )
    .bind(a, fleteVuelta, q.actor, q.instante, q.org, id),
  q.db.prepare(SI_CAMBIO),
];

/**
 * HU-T9.5 y HU-T9.6 CA2: las unidades que salieron vuelven al inventario, una sola vez: cada línea
 * que vuelve deja de estar `descontado`, y lo que ya volvió no vuelve dos veces.
 */
const devolverAlInventario = (q: Quien, id: string) => [
  q.db
    .prepare(
      `UPDATE variante SET stock = stock + (
           SELECT SUM(l.cantidad) FROM pedido_linea l
            WHERE l.org_id = ? AND l.pedido_id = ? AND l.variante_id = variante.id AND l.descontado = 1),
         cambio_motivo = 'devolucion', cambio_ref = ?, actualizado = ?
        WHERE org_id = ? AND stock IS NOT NULL AND id IN (
          SELECT l.variante_id FROM pedido_linea l WHERE l.org_id = ? AND l.pedido_id = ? AND l.descontado = 1)`,
    )
    .bind(q.org, id, id, q.instante, q.org, q.org, id),
  q.db
    .prepare(
      'UPDATE pedido_linea SET descontado = 0 WHERE org_id = ? AND pedido_id = ? AND descontado = 1',
    )
    .bind(q.org, id),
];

/** Lee y revisa lo común: la `op` repetida, que exista, la versión y el estado de partida. */
async function paraCambiar(
  q: Quien,
  d: { op: string; pedido: string; version: number },
  desde: readonly string[],
  noEsta: string,
): Promise<{ p: FilaDelPedido } | { r: Resultado }> {
  const previa = await yaAplicada(q, d.op);
  if (previa) return { r: previa };
  const p = await leerFila(q, d.pedido);
  if (!p) return { r: { estado: 'no-existe', motivo: 'Ese pedido no está.' } };
  if (p.version !== d.version)
    return { r: { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: p.version } };
  if (!desde.includes(p.estado)) return { r: problemas({ campo: 'pedido', mensaje: noEsta }) };
  return { p };
}

const POR_RECAUDAR =
  'La plata de este pedido todavía está por recaudar: márcalo entregado cuando la transportadora lo cobre.';

/** CA1: entregar. Contra entrega, la plata queda recaudada en el mismo lote. */
export async function entregarPedido(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = CambioDeEstado.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const d = r0.data;
  const leido = await paraCambiar(q, d, ['despachado'], 'Este pedido no está en camino.');
  if ('r' in leido) return leido.r;
  const { p } = leido;
  const contraentrega = p.forma_pago === 'contraentrega';
  const r: Resultado = { estado: 'guardado', id: d.pedido, version: p.version + 1 };
  const lote: SentenciaD1[] = [
    ...(contraentrega ? cerrarRecaudo(q, d.pedido, 'recaudado') : []),
    ...cambiarEstado(q, d.pedido, d.version, ['despachado'], 'entregado'),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'pedido.entregar',
      entidad: 'pedido',
      entidadId: d.pedido,
      antes: { numero: p.numero, estado: p.estado },
      despues: {
        numero: p.numero,
        estado: 'entregado',
        ...(contraentrega ? { recaudadoCop: p.total_cop } : {}),
      },
      instante: q.instante,
    }),
    guardarOperacion(q, d.op, 'pedidos/entregar', r),
  ];
  return aplicar(q, d.op, d.pedido, lote, r, (e) =>
    /contraentrega-por-recaudar/.test(String(e))
      ? problemas({ campo: 'pedido', mensaje: POR_RECAUDAR })
      : null,
  );
}

const Devolver = CambioDeEstado.extend({
  /** El comercio dice si las unidades volvieron a su bodega (HU-T9.6 CA2). */
  volvio: z.boolean({ error: 'di si las unidades volvieron al inventario' }),
  fleteVueltaCop: PesosOpcionales,
});

/**
 * CA1: devolver. Si viajaba contra entrega y no se entregó, la plata queda `devuelto` con el flete
 * de vuelta; si ya se había recaudado (un retracto), el recaudo queda como estaba. Las unidades
 * vuelven al inventario solo si el comercio marca que volvieron.
 */
export async function devolverPedido(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = Devolver.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const d = r0.data;
  const leido = await paraCambiar(
    q,
    d,
    ['despachado', 'entregado'],
    'Solo se devuelve un pedido que ya salió.',
  );
  if ('r' in leido) return leido.r;
  const { p } = leido;
  const viajaba = p.forma_pago === 'contraentrega' && p.estado === 'despachado';
  const r: Resultado = { estado: 'guardado', id: d.pedido, version: p.version + 1 };
  const lote: SentenciaD1[] = [
    ...(viajaba ? cerrarRecaudo(q, d.pedido, 'devuelto', d.fleteVueltaCop ?? null) : []),
    ...cambiarEstado(q, d.pedido, d.version, ['despachado', 'entregado'], 'devuelto'),
    ...(d.volvio ? devolverAlInventario(q, d.pedido) : []),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'pedido.devolver',
      entidad: 'pedido',
      entidadId: d.pedido,
      antes: { numero: p.numero, estado: p.estado },
      despues: {
        numero: p.numero,
        estado: 'devuelto',
        volvio: d.volvio,
        ...(viajaba ? { fleteVueltaCop: d.fleteVueltaCop ?? null } : {}),
      },
      instante: q.instante,
    }),
    guardarOperacion(q, d.op, 'pedidos/devolver', r),
  ];
  return aplicar(q, d.op, d.pedido, lote, r);
}

/**
 * CA1: «perdido» queda aparte. La transportadora no responde por el paquete ni por la plata: el
 * recaudo queda `perdido` y el pedido se cierra como devuelto, sin unidades que vuelvan.
 */
export async function perderEnvio(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = CambioDeEstado.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const d = r0.data;
  const leido = await paraCambiar(q, d, ['despachado'], 'Este pedido no está en camino.');
  if ('r' in leido) return leido.r;
  const { p } = leido;
  if (p.forma_pago !== 'contraentrega')
    return problemas({
      campo: 'pedido',
      mensaje: 'Solo la plata de una contraentrega se marca como perdida.',
    });
  const r: Resultado = { estado: 'guardado', id: d.pedido, version: p.version + 1 };
  const lote: SentenciaD1[] = [
    ...cerrarRecaudo(q, d.pedido, 'perdido'),
    ...cambiarEstado(q, d.pedido, d.version, ['despachado'], 'devuelto'),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'pedido.perder',
      entidad: 'pedido',
      entidadId: d.pedido,
      antes: { numero: p.numero, estado: p.estado },
      despues: { numero: p.numero, estado: 'devuelto', perdidoCop: p.total_cop },
      instante: q.instante,
    }),
    guardarOperacion(q, d.op, 'pedidos/perder', r),
  ];
  return aplicar(q, d.op, d.pedido, lote, r);
}

const Liquidar = z.object({
  op: Op,
  pedidos: z.array(IdDePedido).min(1, { error: 'elige al menos un recaudo' }).max(200),
  liquidacionRef: z
    .string()
    .trim()
    .min(1, { error: 'escribe el número de la liquidación de la transportadora' })
    .max(60, { error: 'máximo 60 letras' }),
});

/**
 * CA2 y CA3: liquidar varios recaudos con el número de la liquidación. Todos o ninguno: si uno no
 * se ha recaudado o ya se liquidó, lo dice con su número y no marca nada.
 */
export async function liquidarRecaudos(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = Liquidar.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const ids = [...new Set(d.pedidos)];
  const { results } = await q.db
    .prepare(
      `SELECT c.pedido_id, c.estado, c.monto_cop, c.liquidado, c.liquidacion_ref, p.numero
         FROM contraentrega c JOIN pedido p ON p.org_id = c.org_id AND p.id = c.pedido_id
        WHERE c.org_id = ? AND c.pedido_id IN (${ids.map(() => '?').join(', ')})`,
    )
    .bind(q.org, ...ids)
    .all<{
      pedido_id: string;
      estado: string;
      monto_cop: number;
      liquidado: string | null;
      liquidacion_ref: string | null;
      numero: number;
    }>();
  const porId = new Map(results.map((f) => [f.pedido_id, f]));
  const dichos: string[] = [];
  for (const id of ids) {
    const f = porId.get(id);
    if (!f) dichos.push('Uno de los pedidos no tiene recaudo en esta tienda.');
    else if (f.estado !== 'recaudado')
      dichos.push(`#${f.numero} no se ha recaudado: no se puede liquidar.`);
    else if (f.liquidado) dichos.push(`#${f.numero} ya se liquidó (${f.liquidacion_ref}).`);
  }
  if (dichos.length) return problemas(...dichos.map((mensaje) => ({ campo: 'pedidos', mensaje })));

  const filas = ids.map((id) => porId.get(id) as (typeof results)[number]);
  const total = filas.reduce((s, f) => s + f.monto_cop, 0);
  const r: Resultado = { estado: 'guardado', id: d.liquidacionRef, version: 1 };
  const lote: SentenciaD1[] = [
    ...filas.flatMap((f) => [
      q.db
        .prepare(
          `UPDATE contraentrega SET liquidado = ?, liquidacion_ref = ?, cambiado_por = ?, actualizado = ?
            WHERE org_id = ? AND pedido_id = ? AND estado = 'recaudado' AND liquidado IS NULL`,
        )
        .bind(q.instante, d.liquidacionRef, q.actor, q.instante, q.org, f.pedido_id),
      q.db.prepare(SI_CAMBIO),
      q.db
        .prepare(
          `INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, de, a, actor, detalle)
           VALUES (?, ?, ?, 'recaudo', 'recaudado', 'liquidado', ?, ?)`,
        )
        .bind(
          q.org,
          f.pedido_id,
          q.instante,
          q.actor,
          JSON.stringify({ liquidacion: d.liquidacionRef }),
        ),
    ]),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'recaudos.liquidar',
      entidad: 'liquidacion',
      entidadId: d.liquidacionRef,
      antes: null,
      despues: {
        liquidacion: d.liquidacionRef,
        pedidos: filas.map((f) => f.numero),
        montoCop: total,
      },
      instante: q.instante,
    }),
    guardarOperacion(q, d.op, 'recaudos/liquidar', r),
  ];
  try {
    await q.db.batch(lote);
    return r;
  } catch (e) {
    if (esCambiado(e))
      return {
        estado: 'cambiado',
        motivo: 'Alguien más liquidó o cambió uno de estos recaudos. Revisa la lista.',
        version: null,
      };
    if (esOperacionRepetida(e)) return (await yaAplicada(q, d.op)) ?? r;
    throw e;
  }
}

/**
 * CA2: lo que le queda al comercio de un pedido contra entrega, con la comisión y los fletes.
 * Recaudado o por recaudar: el monto menos lo que costó llevarlo; devuelto o perdido: lo que costó.
 */
export function netoDelRecaudo(r: {
  estado: string;
  montoCop: number;
  comisionCop: number | null;
  fleteIdaCop: number | null;
  fleteVueltaCop: number | null;
}): number {
  const costos = (r.comisionCop ?? 0) + (r.fleteIdaCop ?? 0) + (r.fleteVueltaCop ?? 0);
  if (r.estado === 'devuelto' || r.estado === 'perdido')
    return -((r.fleteIdaCop ?? 0) + (r.fleteVueltaCop ?? 0));
  return r.montoCop - costos;
}

export interface FilaDeRecaudo {
  pedido: string;
  numero: number;
  estado: string;
  montoCop: number;
  comisionCop: number | null;
  fleteIdaCop: number | null;
  fleteVueltaCop: number | null;
  netoCop: number;
  transportadora: string | null;
  guia: string | null;
  /** Desde cuándo está así: el despacho (por recaudar) o el recaudo (por liquidar). */
  desde: string;
}

interface Total {
  montoCop: number;
  cantidad: number;
  /** El más viejo, para decir su antigüedad. */
  desde: string | null;
}

/**
 * La pantalla Recaudos: lo por recaudar y lo recaudado sin liquidar, con sus totales y su
 * antigüedad; lo perdido, aparte. Lo abierto sale entero (el índice `contraentrega_abierta`).
 */
export async function listarRecaudos(q: Quien): Promise<{
  porRecaudar: Total;
  sinLiquidar: Total;
  perdidos: Total;
  recaudos: FilaDeRecaudo[];
}> {
  const { results } = await q.db
    .prepare(
      `SELECT c.pedido_id, c.estado, c.monto_cop, c.comision_cop, c.flete_ida_cop, c.flete_vuelta_cop,
              c.creado, c.actualizado, p.numero, p.transportadora, p.guia
         FROM contraentrega c JOIN pedido p ON p.org_id = c.org_id AND p.id = c.pedido_id
        WHERE c.org_id = ? AND (c.estado IN ('por_recaudar', 'perdido') OR (c.estado = 'recaudado' AND c.liquidado IS NULL))
        ORDER BY c.creado LIMIT 1000`,
    )
    .bind(q.org)
    .all<{
      pedido_id: string;
      estado: string;
      monto_cop: number;
      comision_cop: number | null;
      flete_ida_cop: number | null;
      flete_vuelta_cop: number | null;
      creado: string;
      actualizado: string;
      numero: number;
      transportadora: string | null;
      guia: string | null;
    }>();
  const recaudos = results.map((f): FilaDeRecaudo => {
    const base = {
      estado: f.estado,
      montoCop: f.monto_cop,
      comisionCop: f.comision_cop,
      fleteIdaCop: f.flete_ida_cop,
      fleteVueltaCop: f.flete_vuelta_cop,
    };
    return {
      pedido: f.pedido_id,
      numero: f.numero,
      ...base,
      netoCop: netoDelRecaudo(base),
      transportadora: f.transportadora,
      guia: f.guia,
      desde: f.estado === 'por_recaudar' ? f.creado : f.actualizado,
    };
  });
  const total = (estado: string): Total => {
    const de = recaudos.filter((r) => r.estado === estado);
    return {
      montoCop: de.reduce((s, r) => s + r.montoCop, 0),
      cantidad: de.length,
      desde: de.map((r) => r.desde).sort()[0] ?? null,
    };
  };
  return {
    porRecaudar: total('por_recaudar'),
    sinLiquidar: total('recaudado'),
    perdidos: total('perdido'),
    recaudos,
  };
}
