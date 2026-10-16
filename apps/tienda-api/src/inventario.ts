/**
 * HU-T8.5: el inventario y su libro (TIENDA-3.0 §7.1 y §7.4).
 *
 * - **Ajuste y conteo (CA1).** Un ajuste suma o resta («llegaron 6», «se dañó una»); un conteo dice
 *   cuántas hay de verdad. Los dos cambian `variante.stock` con su `cambio_motivo`, y el libro lo
 *   escribe el trigger `variante_libro`: ningún camino lo olvida.
 * - **Lo apartado (CA2).** El stock nunca baja de lo apartado por pagos en curso ni de cero: se
 *   revisa antes, para decirlo con palabras, y el `CHECK` de `variante` lo impide aunque otra
 *   escritura gane la carrera.
 * - **Avísame.** Cuántas personas esperan cada combinación agotada; marcarlo atendido lo vuelve a
 *   cero y queda en el registro. No hay datos de nadie: el contacto está en el chat del comercio.
 * - Cada escritura lleva `version` y `op`, como el catálogo (HU-T8.2), y deja su fila en el registro.
 */
import type { SentenciaD1 } from '@ed1/d1';
import { z } from 'zod';
import {
  cursorDe,
  esCambiado,
  esOperacionRepetida,
  guardarOperacion,
  leerCursor,
  MOTIVO_CAMBIADO,
  type Quien,
  type Resultado,
  SI_CAMBIO,
  yaAplicada,
} from './catalogo.ts';
import { anotar } from './registro.ts';

const ID = z.string().min(1).max(64);
const OP = z.string().min(8).max(64);

export interface FilaDeInventario {
  variante: string;
  producto: string;
  nombre: string;
  /** «M / Arena»; '' en un producto sin opciones. */
  combinacion: string;
  sku: string | null;
  /** HU-T9.6: el precio de hoy, para anotar un pedido. */
  precioCop: number;
  stock: number | null;
  apartadas: number;
  esperan: number;
  version: number;
}

const combinacionDe = (clave: string) => (clave === '' ? '' : clave.split('|').join(' / '));

type FilaLeida = {
  id: string;
  producto_id: string;
  nombre: string;
  clave: string;
  sku: string | null;
  precio_cop: number;
  stock: number | null;
  reservado: number;
  version: number;
  esperan: number | null;
  posicion_producto: number;
  slug: string;
  posicion: number;
};

const filaDe = (v: FilaLeida): FilaDeInventario => ({
  variante: v.id,
  producto: v.producto_id,
  nombre: v.nombre,
  combinacion: combinacionDe(v.clave),
  sku: v.sku,
  precioCop: v.precio_cop,
  stock: v.stock,
  apartadas: v.reservado,
  esperan: v.esperan ?? 0,
  version: v.version,
});

export const COMBINACIONES_POR_PAGINA = 50;

/**
 * Las combinaciones activas de los productos que no están en la papelera, en el orden del catálogo,
 * de a 50 y con el total; `buscar` filtra por el nombre del producto. Con la tienda llena eran
 * 12.000 filas y 2,2 MB de una vez (bitácora tienda3 21). La página elige primero los productos y
 * después lee sus combinaciones por `variante_por_producto`, y el total suma `combinaciones` de cada
 * producto: unir y contar todas las combinaciones leía 60.000 filas por página (bitácora tienda3 26).
 * Se piden dos productos más que combinaciones: el del cursor puede no tener ninguna después de él,
 * y cada uno de los demás tiene al menos una, así que siempre alcanza para saber si hay siguiente.
 */
export async function listarInventario(
  q: Quien,
  opciones: { buscar?: string; cursor?: string; limite?: number } = {},
): Promise<{ filas: FilaDeInventario[]; siguiente: string | null; total: number }> {
  const buscar = (opciones.buscar ?? '').trim().toLowerCase();
  const limite = opciones.limite ?? COMBINACIONES_POR_PAGINA;
  const despues = leerCursor<[number, string, number, string]>(opciones.cursor, [
    'n',
    's',
    'n',
    's',
  ]);
  const [pagina, cuenta] = await Promise.all([
    q.db
      .prepare(
        `WITH productos AS MATERIALIZED (
           SELECT p.id, p.nombre, p.posicion, p.slug FROM producto p INDEXED BY producto_en_orden_por_slug
            WHERE p.org_id = ? AND p.borrado IS NULL AND p.combinaciones > 0
              AND (? = '' OR lower(p.nombre) LIKE '%' || ? || '%')
              AND (? IS NULL OR (p.posicion, p.slug) >= (?, ?))
            ORDER BY p.posicion, p.slug LIMIT ?
         )
         SELECT v.id, v.producto_id, g.nombre, v.clave, v.sku, v.precio_cop, v.stock, v.reservado, v.version,
                g.posicion AS posicion_producto, g.slug, v.posicion,
                (SELECT i.personas FROM interes_reposicion i WHERE i.org_id = ? AND i.variante_id = v.id) AS esperan
           FROM productos g JOIN variante v INDEXED BY variante_por_producto ON v.org_id = ? AND v.producto_id = g.id
          WHERE v.activa = 1
            AND (? IS NULL OR (g.posicion, g.slug, v.posicion, v.id) > (?, ?, ?, ?))
          ORDER BY g.posicion, g.slug, v.posicion, v.id LIMIT ?`,
      )
      .bind(
        q.org,
        buscar,
        buscar,
        despues ? 1 : null,
        despues?.[0] ?? 0,
        despues?.[1] ?? '',
        limite + 2,
        q.org,
        q.org,
        despues ? 1 : null,
        despues?.[0] ?? 0,
        despues?.[1] ?? '',
        despues?.[2] ?? 0,
        despues?.[3] ?? '',
        limite + 1,
      )
      .all<FilaLeida>(),
    q.db
      .prepare(
        `SELECT coalesce(sum(p.combinaciones), 0) AS n FROM producto p
          WHERE p.org_id = ? AND p.borrado IS NULL
            AND (? = '' OR lower(p.nombre) LIKE '%' || ? || '%')`,
      )
      .bind(q.org, buscar, buscar)
      .first<{ n: number }>(),
  ]);
  const filas = pagina.results.slice(0, limite);
  const ultima = filas.at(-1);
  return {
    filas: filas.map(filaDe),
    siguiente:
      pagina.results.length > limite && ultima
        ? cursorDe([ultima.posicion_producto, ultima.slug, ultima.posicion, ultima.id])
        : null,
    total: cuenta?.n ?? 0,
  };
}

/** Una combinación del inventario, o `null` si no es de la tienda o está en la papelera. */
export async function filaDeInventario(
  q: Quien,
  variante: string,
): Promise<FilaDeInventario | null> {
  const v = await q.db
    .prepare(
      `SELECT v.id, v.producto_id, p.nombre, v.clave, v.sku, v.precio_cop, v.stock, v.reservado, v.version,
              p.posicion AS posicion_producto, p.slug, v.posicion,
              (SELECT i.personas FROM interes_reposicion i WHERE i.org_id = ? AND i.variante_id = v.id) AS esperan
         FROM variante v JOIN producto p ON p.org_id = v.org_id AND p.id = v.producto_id
        WHERE v.org_id = ? AND v.id = ? AND v.activa = 1 AND p.borrado IS NULL`,
    )
    .bind(q.org, q.org, variante)
    .first<FilaLeida>();
  return v ? filaDe(v) : null;
}

export interface Movimiento {
  id: number;
  delta: number;
  stock: number | null;
  motivo: string;
  ref: string | null;
  instante: string;
}

/** El libro de una combinación, del más nuevo al más viejo, de a `limite`. `null` si no es de la tienda. */
export async function libroDe(
  q: Quien,
  variante: string,
  cursor: number | null,
  limite = 50,
): Promise<{ fila: FilaDeInventario; movimientos: Movimiento[]; siguiente: number | null } | null> {
  const fila = await filaDeInventario(q, variante);
  if (!fila) return null;
  const { results } = await q.db
    .prepare(
      `SELECT id, delta, stock_resultante, motivo, ref, instante FROM movimiento_inventario
        WHERE org_id = ? AND variante_id = ? AND id < ? ORDER BY id DESC LIMIT ?`,
    )
    .bind(q.org, variante, cursor ?? Number.MAX_SAFE_INTEGER, limite + 1)
    .all<{
      id: number;
      delta: number;
      stock_resultante: number | null;
      motivo: string;
      ref: string | null;
      instante: string;
    }>();
  const movimientos = results.slice(0, limite).map((m) => ({
    id: m.id,
    delta: m.delta,
    stock: m.stock_resultante,
    motivo: m.motivo,
    ref: m.ref,
    instante: m.instante,
  }));
  return {
    fila,
    movimientos,
    siguiente: results.length > limite ? (movimientos.at(-1)?.id ?? null) : null,
  };
}

const Ajuste = z.discriminatedUnion('tipo', [
  z.object({
    op: OP,
    variante: ID,
    version: z.number().int().min(1),
    tipo: z.literal('ajuste'),
    /** Cuántas entran (+) o salen (−). */
    cantidad: z
      .number()
      .int('debe ser un número entero')
      .min(-100_000)
      .max(100_000)
      .refine((n) => n !== 0, 'escribe cuántas entran o salen'),
  }),
  z.object({
    op: OP,
    variante: ID,
    version: z.number().int().min(1),
    tipo: z.literal('conteo'),
    /** Cuántas hay, contadas. */
    cantidad: z
      .number()
      .int('debe ser un número entero')
      .min(0, 'no puede ser negativo')
      .max(1_000_000),
  }),
]);

const apartadasEnPalabras = (n: number) =>
  n === 1
    ? 'Hay 1 unidad apartada por un pago en curso'
    : `Hay ${n} unidades apartadas por pagos en curso`;

/** Ajustar o contar una combinación (CA1), sin bajar de lo apartado ni de cero (CA2). */
export async function ajustarInventario(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = Ajuste.safeParse(cuerpo);
  if (!r0.success) {
    return {
      estado: 'problemas',
      problemas: r0.error.issues.map((i) => ({
        campo: i.path.map(String).join('.'),
        mensaje: i.message,
      })),
    };
  }
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const leer = () =>
    q.db
      .prepare(
        `SELECT v.stock, v.reservado, v.version, v.clave, p.nombre
           FROM variante v JOIN producto p ON p.org_id = v.org_id AND p.id = v.producto_id
          WHERE v.org_id = ? AND v.id = ? AND v.activa = 1 AND p.borrado IS NULL`,
      )
      .bind(q.org, d.variante)
      .first<{
        stock: number | null;
        reservado: number;
        version: number;
        clave: string;
        nombre: string;
      }>();
  const v = await leer();
  if (!v) return { estado: 'no-existe', motivo: 'Esa combinación ya no está.' };
  if (v.version !== d.version)
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: v.version };
  if (v.stock === null) {
    return {
      estado: 'problemas',
      problemas: [
        {
          campo: 'cantidad',
          mensaje:
            'Esta combinación no cuenta existencias. Cámbialo en el producto para contarlas.',
        },
      ],
    };
  }
  const nuevo = d.tipo === 'conteo' ? d.cantidad : v.stock + d.cantidad;
  const sinApartar = (reservado: number, stock: number): Resultado => ({
    estado: 'problemas',
    problemas: [
      {
        campo: 'cantidad',
        mensaje:
          reservado > 0
            ? `${apartadasEnPalabras(reservado)}: las existencias no pueden quedar en menos de ${reservado}.`
            : `Hay ${stock}: no pueden salir más de las que hay.`,
      },
    ],
  });
  if (nuevo < 0 || nuevo < v.reservado) return sinApartar(v.reservado, v.stock);

  const r: Resultado = { estado: 'guardado', id: d.variante, version: v.version + 1 };
  const lote: SentenciaD1[] = [
    q.db
      .prepare(
        `UPDATE variante SET stock = ?, cambio_motivo = ?, cambio_ref = ?, version = version + 1, actualizado = ?
          WHERE org_id = ? AND id = ? AND version = ?`,
      )
      .bind(nuevo, d.tipo, d.op, q.instante, q.org, d.variante, d.version),
    q.db.prepare(SI_CAMBIO),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: d.tipo === 'conteo' ? 'inventario.contar' : 'inventario.ajustar',
      entidad: 'variante',
      entidadId: d.variante,
      antes: { nombre: v.nombre, combinacion: v.clave, stock: v.stock },
      despues: { nombre: v.nombre, combinacion: v.clave, stock: nuevo },
      instante: q.instante,
    }),
    guardarOperacion(q, d.op, 'inventario/ajustar', r),
  ];
  try {
    await q.db.batch(lote);
    return r;
  } catch (e) {
    if (esCambiado(e)) {
      return {
        estado: 'cambiado',
        motivo: MOTIVO_CAMBIADO,
        version: (await leer())?.version ?? null,
      };
    }
    if (esOperacionRepetida(e)) return (await yaAplicada(q, d.op)) ?? r;
    // Un pago apartó entre la lectura y el lote: el CHECK de `variante` lo detuvo.
    if (/CHECK constraint failed/i.test(String(e))) {
      const ahora = await leer();
      return sinApartar(ahora?.reservado ?? v.reservado, ahora?.stock ?? v.stock);
    }
    throw e;
  }
}

const Atender = z.object({ op: OP, variante: ID });

/** «Ya les avisé»: la cuenta de quienes esperan vuelve a cero, y queda en el registro. */
export async function atenderAvisame(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = Atender.safeParse(cuerpo);
  if (!r0.success) {
    return {
      estado: 'problemas',
      problemas: [{ campo: 'variante', mensaje: 'falta la combinación' }],
    };
  }
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const fila = await q.db
    .prepare(
      `SELECT i.personas, v.clave, p.nombre
         FROM interes_reposicion i
         JOIN variante v ON v.org_id = i.org_id AND v.id = i.variante_id
         JOIN producto p ON p.org_id = v.org_id AND p.id = v.producto_id
        WHERE i.org_id = ? AND i.variante_id = ?`,
    )
    .bind(q.org, d.variante)
    .first<{ personas: number; clave: string; nombre: string }>();
  if (!fila) return { estado: 'no-existe', motivo: 'Nadie está esperando esa combinación.' };
  const r: Resultado = { estado: 'guardado', id: d.variante, version: 1 };
  try {
    await q.db.batch([
      q.db
        .prepare(
          'DELETE FROM interes_reposicion WHERE org_id = ? AND variante_id = ? AND personas = ?',
        )
        .bind(q.org, d.variante, fila.personas),
      q.db.prepare(SI_CAMBIO),
      await anotar(q.db, {
        org: q.org,
        actor: q.actor,
        accion: 'avisame.atender',
        entidad: 'variante',
        entidadId: d.variante,
        antes: { nombre: fila.nombre, combinacion: fila.clave, personas: fila.personas },
        despues: null,
        instante: q.instante,
      }),
      guardarOperacion(q, d.op, 'avisame/atender', r),
    ]);
    return r;
  } catch (e) {
    // Alguien más pidió que le avisen mientras tanto: la cuenta cambió y se vuelve a mirar.
    if (esCambiado(e)) return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: null };
    if (esOperacionRepetida(e)) return (await yaAplicada(q, d.op)) ?? r;
    throw e;
  }
}

/**
 * HU-T4.5: qué combinaciones se pueden comprar ahora, como las ve la vitrina: activas, de un
 * producto activo, y sin contar o con más existencias que lo apartado.
 */
export async function disponibilidad(
  q: Pick<Quien, 'db' | 'org'>,
  variantes: readonly string[],
): Promise<Map<string, boolean>> {
  if (variantes.length === 0) return new Map();
  const { results } = await q.db
    .prepare(
      `SELECT v.id, (v.activa = 1 AND p.estado = 'activo' AND p.borrado IS NULL
                     AND (v.stock IS NULL OR v.stock - v.reservado > 0)) AS hay
         FROM variante v JOIN producto p ON p.org_id = v.org_id AND p.id = v.producto_id
        WHERE v.org_id = ? AND v.id IN (${variantes.map(() => '?').join(', ')})`,
    )
    .bind(q.org, ...variantes)
    .all<{ id: string; hay: number }>();
  return new Map(results.map((r) => [r.id, r.hay === 1]));
}

/** Si alguna combinación pasó de disponible a agotada, o al revés. */
export function cruzo(antes: Map<string, boolean>, despues: Map<string, boolean>): boolean {
  for (const [id, hay] of despues) if (antes.has(id) && antes.get(id) !== hay) return true;
  return false;
}
