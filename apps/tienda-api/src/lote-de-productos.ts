/**
 * HU-P3.1 (sprint PF1): cambiar varios productos a la vez desde el panel, sin la hoja de cálculo:
 * el precio en un porcentaje o un valor, el estado, la papelera o la promoción.
 *
 * - **Todo o nada.** Todo el cambio va en un solo lote de D1, con su registro y su `op`: si algo
 *   falla, no queda la mitad cambiada. Por eso el lote tiene tope (`PRODUCTOS_POR_LOTE`): cabe en
 *   una consulta con sus parámetros y en las del plan gratuito.
 * - **Primero se ve.** `vistaPrevia` dice cuántos productos y combinaciones cambian y un ejemplo
 *   del precio antes y después, sin escribir nada.
 * - **El precio, con la misma cuenta.** La base aplica la fórmula de `precioDelLote`
 *   (`@ed1/tienda-schema`), en pesos enteros y nunca por debajo de $1. Un «antes» que ya no es más
 *   alto que el precio nuevo se quita: la base no deja guardarlo (y la ficha mentiría).
 * - Los cambios se ven en la tienda al publicar, como cualquier otro cambio del catálogo.
 */
import type { SentenciaD1 } from '@ed1/d1';
import {
  type CambioEnLote,
  cambioEnLote,
  PRODUCTOS_POR_LOTE,
  precioDelLote,
} from '@ed1/tienda-schema';
import {
  esCambiado,
  esOperacionRepetida,
  guardarOperacion,
  type Quien,
  SI_CAMBIO,
  yaAplicada,
} from './catalogo.ts';
import { anotar } from './registro.ts';

export type ResultadoDelLote =
  | {
      estado: 'vista-previa';
      productos: number;
      combinaciones: number;
      nombres: string[];
      ejemplo: { nombre: string; antes: number; despues: number } | null;
    }
  | { estado: 'guardado'; id: 'lote'; version: 1; productos: number }
  | { estado: 'problemas'; problemas: { campo: string; mensaje: string }[] }
  | { estado: 'no-existe'; motivo: string };

/** Lo que el registro y la pantalla dicen del cambio, en palabras. */
export function cambioEnPalabras(k: CambioEnLote['cambio']): string {
  if (k.tipo === 'precio') {
    const signo = k.cantidad > 0 ? 'subir' : 'bajar';
    const cuanto =
      k.modo === 'porcentaje'
        ? `${Math.abs(k.cantidad)} %`
        : `$${Math.abs(k.cantidad)
            .toString()
            .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
    return `${signo} el precio ${cuanto}`;
  }
  if (k.tipo === 'estado') {
    return { activo: 'activar', borrador: 'pasar a borrador', archivado: 'archivar' }[k.estado];
  }
  if (k.tipo === 'papelera') return 'mandar a la papelera';
  return k.promocion ? 'poner una promoción' : 'quitar la promoción';
}

export async function cambiarEnLote(q: Quien, cuerpo: unknown): Promise<ResultadoDelLote> {
  const r0 = cambioEnLote.safeParse(cuerpo);
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
  if (!d.vistaPrevia) {
    const previa = await yaAplicada<ResultadoDelLote>(q, d.op);
    if (previa) return previa;
  }
  // Los productos: los elegidos, o los de la categoría; nunca uno de la papelera.
  const { results: productos } = d.ids
    ? await q.db
        .prepare(
          `SELECT id, nombre FROM producto WHERE org_id = ? AND borrado IS NULL
             AND id IN (${d.ids.map(() => '?').join(', ')}) ORDER BY posicion, slug`,
        )
        .bind(q.org, ...d.ids)
        .all<{ id: string; nombre: string }>()
    : await q.db
        .prepare(
          `SELECT p.id, p.nombre FROM coleccion_producto cp
             JOIN producto p ON p.org_id = cp.org_id AND p.id = cp.producto_id
            WHERE cp.org_id = ? AND cp.coleccion_id = ? AND p.borrado IS NULL
            ORDER BY cp.posicion, p.slug LIMIT ?`,
        )
        .bind(q.org, d.coleccion, PRODUCTOS_POR_LOTE + 1)
        .all<{ id: string; nombre: string }>();
  if (productos.length === 0) {
    return { estado: 'no-existe', motivo: 'Ninguno de esos productos está en tu catálogo.' };
  }
  if (productos.length > PRODUCTOS_POR_LOTE) {
    return {
      estado: 'problemas',
      problemas: [
        {
          campo: 'coleccion',
          mensaje: `esa categoría tiene más de ${PRODUCTOS_POR_LOTE} productos: elígelos por partes`,
        },
      ],
    };
  }
  const ids = productos.map((p) => p.id);
  const marcas = ids.map(() => '?').join(', ');
  const k = d.cambio;

  const variantes = await q.db
    .prepare(
      `SELECT v.producto_id, v.precio_cop FROM variante v
        WHERE v.org_id = ? AND v.activa = 1 AND v.producto_id IN (${marcas})
        ORDER BY v.producto_id, v.posicion, v.clave`,
    )
    .bind(q.org, ...ids)
    .all<{ producto_id: string; precio_cop: number }>();

  if (d.vistaPrevia) {
    const primera = variantes.results[0];
    const nombre = productos.find((p) => p.id === primera?.producto_id)?.nombre;
    return {
      estado: 'vista-previa',
      productos: productos.length,
      combinaciones: variantes.results.length,
      nombres: productos.slice(0, 10).map((p) => p.nombre),
      ejemplo:
        k.tipo === 'precio' && primera && nombre
          ? {
              nombre,
              antes: primera.precio_cop,
              despues: precioDelLote(primera.precio_cop, k.modo, k.cantidad),
            }
          : null,
    };
  }

  const lote: SentenciaD1[] = [];
  if (k.tipo === 'precio') {
    // La fórmula de `precioDelLote`, en la base: enteros, redondeo al peso y nunca menos de $1. El
    // parámetro llega como REAL desde JavaScript: sin el CAST, la división daría centavos.
    const nuevo =
      k.modo === 'porcentaje'
        ? 'max(1, (precio_cop * (100 + CAST(?1 AS INTEGER)) + 50) / 100)'
        : 'max(1, precio_cop + CAST(?1 AS INTEGER))';
    lote.push(
      q.db
        .prepare(
          `UPDATE variante SET
             precio_antes_cop = CASE WHEN precio_antes_cop > ${nuevo} THEN precio_antes_cop ELSE NULL END,
             precio_cop = ${nuevo}, version = version + 1, actualizado = ?2
           WHERE org_id = ?3 AND activa = 1 AND producto_id IN (${ids.map((_, i) => `?${i + 4}`).join(', ')})`,
        )
        .bind(k.cantidad, q.instante, q.org, ...ids),
    );
  }
  const sets =
    k.tipo === 'estado'
      ? { sql: 'estado = ?', valor: k.estado as unknown }
      : k.tipo === 'papelera'
        ? { sql: 'borrado = ?', valor: q.instante as unknown }
        : k.tipo === 'promocion'
          ? { sql: 'promocion = ?', valor: k.promocion ? JSON.stringify(k.promocion) : null }
          : null;
  const conjunto = sets ? `${sets.sql}, ` : '';
  lote.push(
    q.db
      .prepare(
        `UPDATE producto SET ${conjunto}version = version + 1, actualizado = ?
          WHERE org_id = ? AND borrado IS NULL AND id IN (${marcas})`,
      )
      .bind(...(sets ? [sets.valor] : []), q.instante, q.org, ...ids),
    q.db.prepare(SI_CAMBIO),
  );
  const r: ResultadoDelLote = {
    estado: 'guardado',
    id: 'lote',
    version: 1,
    productos: productos.length,
  };
  lote.push(
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'productos.lote',
      entidad: 'producto',
      entidadId: null,
      antes: null,
      despues: {
        cambio: cambioEnPalabras(k),
        productos: productos.length,
        nombres: productos.slice(0, 10).map((p) => p.nombre),
      },
      instante: q.instante,
    }),
    guardarOperacion(q, d.op, 'productos/lote', r),
  );
  try {
    await q.db.batch(lote);
  } catch (e) {
    if (esOperacionRepetida(e)) return (await yaAplicada(q, d.op)) ?? r;
    if (esCambiado(e)) {
      return {
        estado: 'no-existe',
        motivo: 'Esos productos cambiaron mientras tanto. Vuelve a intentarlo.',
      };
    }
    throw e;
  }
  return r;
}
