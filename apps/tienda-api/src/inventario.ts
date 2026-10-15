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

const ID = z.string().min(1).max(64);
const OP = z.string().min(8).max(64);

export interface FilaDeInventario {
  variante: string;
  producto: string;
  nombre: string;
  /** «M / Arena»; '' en un producto sin opciones. */
  combinacion: string;
  sku: string | null;
  stock: number | null;
  apartadas: number;
  esperan: number;
  version: number;
}

const combinacionDe = (clave: string) => (clave === '' ? '' : clave.split('|').join(' / '));

/** Las combinaciones activas de los productos que no están en la papelera, en el orden del catálogo. */
export async function listarInventario(q: Quien): Promise<FilaDeInventario[]> {
  const { results } = await q.db
    .prepare(
      `SELECT v.id, v.producto_id, p.nombre, v.clave, v.sku, v.stock, v.reservado, v.version,
              (SELECT i.personas FROM interes_reposicion i WHERE i.org_id = ? AND i.variante_id = v.id) AS esperan
         FROM variante v JOIN producto p ON p.org_id = v.org_id AND p.id = v.producto_id
        WHERE v.org_id = ? AND v.activa = 1 AND p.borrado IS NULL
        ORDER BY p.posicion, p.slug, v.posicion`,
    )
    .bind(q.org, q.org)
    .all<{
      id: string;
      producto_id: string;
      nombre: string;
      clave: string;
      sku: string | null;
      stock: number | null;
      reservado: number;
      version: number;
      esperan: number | null;
    }>();
  return results.map((v) => ({
    variante: v.id,
    producto: v.producto_id,
    nombre: v.nombre,
    combinacion: combinacionDe(v.clave),
    sku: v.sku,
    stock: v.stock,
    apartadas: v.reservado,
    esperan: v.esperan ?? 0,
    version: v.version,
  }));
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
  const fila = (await listarInventario(q)).find((f) => f.variante === variante);
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
