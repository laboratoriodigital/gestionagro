/**
 * Cargar una tienda desde un `tienda-import/1` (HU-T12.2, TIENDA-3.0 §17.1), por la API del panel.
 *
 * - **Revisar** responde todos los problemas a la vez sin escribir nada: los del archivo
 *   (`revisarCarga`, HU-T1.4) y los que solo se ven contra la base o al planear (un código de pedido
 *   que ya es de un pedido de verdad, una línea histórica sin su variante, una dirección repetida).
 * - **Aplicar** va por partes de `SENTENCIAS_POR_PARTE`, cada una un lote atómico de D1, dentro del
 *   límite de consultas por solicitud del plan gratuito. Cada sentencia es idempotente: inserta o
 *   actualiza por `ref_externa` (o por su clave natural) y **solo si algo cambió**, así cargar dos
 *   veces el mismo archivo no cambia nada (CA4). Nunca borra (P21): lo que falta en el archivo se
 *   queda como estaba.
 * - Una parte que falla deja las anteriores escritas y nada de la suya; volver a aplicar desde ella
 *   termina el trabajo. La tienda pública no ve nada hasta que se publique (HU-T4.4).
 * - Lo que escribe la carga es lo que escribirá el panel para una persona (P21): estas sentencias
 *   son las de los productos, las variantes y las colecciones que reusarán sus pantallas (HU-T8.x).
 * - Los pedidos históricos entran con canal `carga`, sin datos personales (CA3), y nunca se
 *   reescriben: su historia es la que fue.
 */
import type { BaseD1 } from '@ed1/d1';
import {
  type CargaTienda,
  idDelProductoCargado,
  type Problema,
  revisarCarga,
} from '@ed1/tienda-schema';

/** Cuántas sentencias por lote: el plan gratuito permite 50 consultas por solicitud. */
export const SENTENCIAS_POR_PARTE = 40;

export interface Sentencia {
  sql: string;
  params: (string | number | null)[];
}

export interface Plan {
  partes: Sentencia[][];
  resumen: Record<string, number>;
}

const json = (x: unknown) => JSON.stringify(x);
/** `nombre` en minúsculas, sin tildes ni signos: la dirección de un producto que no trae la suya. */
const slugDe = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'producto';

/** «Talla: M · Color: Arena», como lo escribe el pedido de la vitrina (HU-T6.1). */
const opcionesEnPalabras = (opciones: { nombre: string }[], valores: readonly string[]) =>
  opciones
    .map((o, i) => (valores[i] ? `${o.nombre}: ${valores[i]}` : ''))
    .filter(Boolean)
    .join(' · ');

/** Los problemas que solo se ven al planear, sin la base. */
function problemasDelPlan(c: CargaTienda): Problema[] {
  const problemas: Problema[] = [];
  const slugs = new Map<string, string>();
  c.productos.forEach((p, i) => {
    const s = p.slug ?? slugDe(p.nombre);
    const otro = slugs.get(s);
    if (otro) {
      problemas.push({
        campo: `productos.${i} (${p.refExterna})`,
        mensaje: `su dirección «${s}» es la de ${otro}: dale a uno su propio «slug»`,
      });
    } else {
      slugs.set(s, p.refExterna);
    }
  });
  c.pedidos.forEach((p, i) => {
    const lugar = `pedidos.${i} (${p.codigo})`;
    if (p.estado === 'pagado' && p.formaPago !== 'en_linea') {
      problemas.push({
        campo: lugar,
        mensaje: 'solo un pago en línea queda «pagado»; uno por fuera es «confirmado»',
      });
    }
    if (p.estado === 'confirmado' && p.formaPago === 'en_linea') {
      problemas.push({
        campo: lugar,
        mensaje: 'un pago en línea aprobado es «pagado», no «confirmado»',
      });
    }
    if (p.estado === 'pendiente') {
      problemas.push({
        campo: lugar,
        mensaje: 'un pedido histórico no queda pendiente: dile su estado final',
      });
    }
    p.lineas.forEach((l, j) => {
      if (!varianteDeLaLinea(c, l)) {
        problemas.push({
          campo: `${lugar}.lineas.${j}`,
          mensaje: `«${l.nombre}${l.opciones ? ` (${l.opciones})` : ''}» no es un producto del archivo: ponle el SKU de su variante`,
        });
      }
    });
    const suma = p.lineas.reduce((s, l) => s + l.precioCop * l.cantidad, 0);
    if (suma !== p.totales.subtotal) {
      problemas.push({
        campo: lugar,
        mensaje: `sus líneas suman ${suma} y el subtotal dice ${p.totales.subtotal}`,
      });
    }
  });
  return problemas;
}

/** La variante de una línea histórica: por su SKU, o por el nombre del producto y sus opciones. */
function varianteDeLaLinea(
  c: CargaTienda,
  l: CargaTienda['pedidos'][number]['lineas'][number],
): { ref: string; clave: string } | null {
  for (const p of c.productos) {
    for (const v of p.variantes) {
      const porSku = l.sku && v.sku === l.sku;
      const porNombre =
        !l.sku &&
        p.nombre === l.nombre &&
        opcionesEnPalabras(p.opciones, v.valores) === (l.opciones ?? '');
      if (porSku || porNombre) return { ref: p.refExterna, clave: v.valores.join('|') };
    }
  }
  return null;
}

/** Las sentencias de la carga, en orden: ajustes, colecciones, productos, variantes, el resto. */
export function planDeLaCarga(c: CargaTienda, org: string, ahora: string): Plan {
  const s: Sentencia[] = [];
  const poner = (sql: string, ...params: Sentencia['params']) => s.push({ sql, params });

  for (const [seccion, datos] of Object.entries(c.ajustes)) {
    if (!datos) continue;
    poner(
      `INSERT INTO ajuste (org_id, seccion, esquema, datos, actualizado, actualizado_por) VALUES (?, ?, 1, ?, ?, 'carga')
       ON CONFLICT (org_id, seccion) DO UPDATE SET datos = excluded.datos, actualizado = excluded.actualizado,
         actualizado_por = excluded.actualizado_por, version = ajuste.version + 1
       WHERE ajuste.datos IS NOT excluded.datos`,
      org,
      seccion,
      json(datos),
      ahora,
    );
  }
  c.colecciones.forEach((col, i) => {
    poner(
      `INSERT INTO coleccion (org_id, id, slug, nombre, posicion, actualizado) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (org_id, slug) WHERE borrado IS NULL DO UPDATE SET nombre = excluded.nombre,
         posicion = excluded.posicion, actualizado = excluded.actualizado, version = coleccion.version + 1
       WHERE coleccion.nombre IS NOT excluded.nombre OR coleccion.posicion IS NOT excluded.posicion`,
      org,
      `imp-c-${col.refExterna}`,
      col.slug,
      col.nombre,
      i,
      ahora,
    );
  });
  c.productos.forEach((p, i) => {
    const retracto = p.retracto.aplica ? 'aplica' : 'no_aplica';
    const motivo = p.retracto.aplica ? null : p.retracto.motivo;
    poner(
      `INSERT INTO producto (org_id, id, slug, nombre, descripcion_md, estado, opciones, retracto, retracto_motivo,
         solo_mayores, iva_pct, posicion, ref_externa, creado, actualizado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (org_id, ref_externa) WHERE ref_externa IS NOT NULL DO UPDATE SET slug = excluded.slug,
         nombre = excluded.nombre, descripcion_md = excluded.descripcion_md, estado = excluded.estado,
         opciones = excluded.opciones, retracto = excluded.retracto, retracto_motivo = excluded.retracto_motivo,
         solo_mayores = excluded.solo_mayores, iva_pct = excluded.iva_pct, posicion = excluded.posicion,
         actualizado = excluded.actualizado, version = producto.version + 1
       WHERE producto.slug IS NOT excluded.slug OR producto.nombre IS NOT excluded.nombre
         OR producto.descripcion_md IS NOT excluded.descripcion_md OR producto.estado IS NOT excluded.estado
         OR producto.opciones IS NOT excluded.opciones OR producto.retracto IS NOT excluded.retracto
         OR producto.retracto_motivo IS NOT excluded.retracto_motivo OR producto.solo_mayores IS NOT excluded.solo_mayores
         OR producto.iva_pct IS NOT excluded.iva_pct OR producto.posicion IS NOT excluded.posicion`,
      org,
      idDelProductoCargado(p.refExterna),
      p.slug ?? slugDe(p.nombre),
      p.nombre,
      p.descripcionMd ?? '',
      p.estado,
      json(p.opciones),
      retracto,
      motivo,
      p.soloMayores ? 1 : 0,
      p.ivaPct,
      i,
      p.refExterna,
      ahora,
      ahora,
    );
  });
  c.productos.forEach((p) => {
    p.variantes.forEach((v, j) => {
      const clave = v.valores.join('|');
      poner(
        `INSERT INTO variante (org_id, id, producto_id, clave, sku, precio_cop, precio_antes_cop, stock, posicion,
           cambio_motivo, actualizado)
         VALUES (?, ?, (SELECT id FROM producto WHERE org_id = ? AND ref_externa = ?), ?, ?, ?, ?, ?, ?, 'carga', ?)
         ON CONFLICT (org_id, producto_id, clave) DO UPDATE SET sku = excluded.sku, precio_cop = excluded.precio_cop,
           precio_antes_cop = excluded.precio_antes_cop, stock = excluded.stock, posicion = excluded.posicion,
           cambio_motivo = 'carga', actualizado = excluded.actualizado, version = variante.version + 1
         WHERE variante.sku IS NOT excluded.sku OR variante.precio_cop IS NOT excluded.precio_cop
           OR variante.precio_antes_cop IS NOT excluded.precio_antes_cop OR variante.stock IS NOT excluded.stock
           OR variante.posicion IS NOT excluded.posicion`,
        org,
        `imp-v-${p.refExterna}-${clave || 'unica'}`,
        org,
        p.refExterna,
        clave,
        v.sku ?? null,
        v.precioCop,
        v.precioAntesCop ?? null,
        v.stock,
        j,
        ahora,
      );
    });
    p.colecciones.forEach((col, k) => {
      const deCol = c.colecciones.find((x) => x.refExterna === col);
      if (!deCol) return;
      poner(
        `INSERT INTO coleccion_producto (org_id, coleccion_id, producto_id, posicion) VALUES (?,
           (SELECT id FROM coleccion WHERE org_id = ? AND slug = ? AND borrado IS NULL),
           (SELECT id FROM producto WHERE org_id = ? AND ref_externa = ?), ?)
         ON CONFLICT (org_id, coleccion_id, producto_id) DO NOTHING`,
        org,
        org,
        deCol.slug,
        org,
        p.refExterna,
        k,
      );
    });
  });
  c.envios.forEach((e, i) => {
    poner(
      `INSERT INTO envio_opcion (org_id, id, nombre, precio_cop, gratis_desde_cop, ciudades, dias_min, dias_max, posicion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (org_id, id) DO UPDATE SET nombre = excluded.nombre, precio_cop = excluded.precio_cop,
         gratis_desde_cop = excluded.gratis_desde_cop, ciudades = excluded.ciudades, dias_min = excluded.dias_min,
         dias_max = excluded.dias_max, posicion = excluded.posicion, version = envio_opcion.version + 1
       WHERE envio_opcion.nombre IS NOT excluded.nombre OR envio_opcion.precio_cop IS NOT excluded.precio_cop
         OR envio_opcion.gratis_desde_cop IS NOT excluded.gratis_desde_cop OR envio_opcion.ciudades IS NOT excluded.ciudades
         OR envio_opcion.dias_min IS NOT excluded.dias_min OR envio_opcion.dias_max IS NOT excluded.dias_max
         OR envio_opcion.posicion IS NOT excluded.posicion`,
      org,
      `imp-e-${e.refExterna}`,
      e.nombre,
      e.precioCop,
      e.gratisDesdeCop,
      e.ciudades ? json(e.ciudades) : null,
      e.diasMin,
      e.diasMax,
      i,
    );
  });
  for (const cu of c.cupones) {
    poner(
      `INSERT INTO cupon (org_id, codigo, tipo, valor, minimo_cop, usos_maximos) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (org_id, codigo) DO UPDATE SET tipo = excluded.tipo, valor = excluded.valor,
         minimo_cop = excluded.minimo_cop, usos_maximos = excluded.usos_maximos, version = cupon.version + 1
       WHERE cupon.tipo IS NOT excluded.tipo OR cupon.valor IS NOT excluded.valor
         OR cupon.minimo_cop IS NOT excluded.minimo_cop OR cupon.usos_maximos IS NOT excluded.usos_maximos`,
      org,
      cu.codigo,
      cu.tipo,
      cu.valor,
      cu.minimoCop,
      cu.usosMaximos,
    );
  }
  for (const pg of c.paginas) {
    poner(
      `INSERT INTO pagina (org_id, id, slug, titulo, cuerpo_md, actualizado) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (org_id, id) DO UPDATE SET slug = excluded.slug, titulo = excluded.titulo,
         cuerpo_md = excluded.cuerpo_md, actualizado = excluded.actualizado, version = pagina.version + 1
       WHERE pagina.slug IS NOT excluded.slug OR pagina.titulo IS NOT excluded.titulo
         OR pagina.cuerpo_md IS NOT excluded.cuerpo_md`,
      org,
      `imp-g-${pg.refExterna}`,
      pg.slug,
      pg.titulo,
      pg.md,
      ahora,
    );
  }
  // Los históricos: una vez, nunca se reescriben. El pedido y sus líneas van en la misma parte.
  const historicos: Sentencia[][] = c.pedidos.map((p) => {
    const id = `imp-o-${p.codigo}`;
    const grupo: Sentencia[] = [
      {
        sql: `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, descuento_cop,
                envio_cop, total_cop, cambiado_por, creado, actualizado)
              VALUES (?, ?, ?, (SELECT COALESCE(MAX(numero), 1000) + 1 FROM pedido WHERE org_id = ?), ?, 'carga', ?,
                ?, ?, ?, ?, 'carga', ?, ?)
              ON CONFLICT (org_id, codigo) DO NOTHING`,
        params: [
          org,
          id,
          p.codigo,
          org,
          p.estado,
          p.formaPago,
          p.totales.subtotal,
          p.totales.descuento,
          p.totales.envio,
          p.totales.total,
          p.creado,
          ahora,
        ],
      },
      ...p.lineas.map((l, j) => {
        const v = varianteDeLaLinea(c, l) as { ref: string; clave: string };
        return {
          sql: `INSERT INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, opciones, sku,
                  precio_unitario_cop, cantidad, total_cop)
                SELECT ?, ?, ?, p.id, v.id, ?, ?, ?, ?, ?, ? FROM variante v
                JOIN producto p ON p.org_id = v.org_id AND p.id = v.producto_id
                WHERE v.org_id = ? AND p.ref_externa = ? AND v.clave = ?
                ON CONFLICT (org_id, pedido_id, linea) DO NOTHING`,
          params: [
            org,
            id,
            j + 1,
            l.nombre,
            l.opciones ?? '',
            l.sku ?? null,
            l.precioCop,
            l.cantidad,
            l.precioCop * l.cantidad,
            org,
            v.ref,
            v.clave,
          ],
        };
      }),
      {
        sql: `INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, de, a, actor, detalle)
              SELECT ?, ?, ?, 'estado', NULL, ?, 'carga', '{"canal":"carga"}'
              WHERE NOT EXISTS (SELECT 1 FROM pedido_evento WHERE org_id = ? AND pedido_id = ?)`,
        params: [org, id, p.creado, p.estado, org, id],
      },
    ];
    return grupo;
  });

  const partes: Sentencia[][] = [];
  for (let i = 0; i < s.length; i += SENTENCIAS_POR_PARTE)
    partes.push(s.slice(i, i + SENTENCIAS_POR_PARTE));
  for (const grupo of historicos) {
    const ultima = partes.at(-1);
    if (ultima && ultima.length + grupo.length <= SENTENCIAS_POR_PARTE) ultima.push(...grupo);
    else partes.push([...grupo]);
  }
  return {
    partes,
    resumen: {
      productos: c.productos.length,
      variantes: c.productos.reduce((n, p) => n + p.variantes.length, 0),
      colecciones: c.colecciones.length,
      envios: c.envios.length,
      cupones: c.cupones.length,
      paginas: c.paginas.length,
      pedidos: c.pedidos.length,
      fotos: c.productos.reduce((n, p) => n + p.medios.length, 0),
      partes: partes.length,
    },
  };
}

/**
 * Revisar: todos los problemas a la vez, sin escribir. Con la base: un código de pedido histórico
 * que ya es de un pedido que no vino de una carga no se toca (sería mezclar dos pedidos).
 */
export async function revisarLaCarga(
  db: BaseD1,
  org: string,
  archivo: unknown,
  ahora: string,
): Promise<{ ok: true; carga: CargaTienda; plan: Plan } | { ok: false; problemas: Problema[] }> {
  const r = revisarCarga(archivo);
  if (!r.ok) return r;
  const problemas = problemasDelPlan(r.carga);
  const codigos = r.carga.pedidos.map((p) => p.codigo);
  for (let i = 0; i < codigos.length; i += 40) {
    const lote = codigos.slice(i, i + 40);
    const { results } = await db
      .prepare(
        `SELECT codigo FROM pedido WHERE org_id = ? AND canal <> 'carga' AND codigo IN (${lote.map(() => '?').join(', ')})`,
      )
      .bind(org, ...lote)
      .all<{ codigo: string }>();
    for (const x of results) {
      problemas.push({
        campo: `pedidos (${x.codigo})`,
        mensaje: 'ese código ya es de un pedido que llegó por la tienda: cámbialo en el archivo',
      });
    }
  }
  if (problemas.length > 0) return { ok: false, problemas };
  return { ok: true, carga: r.carga, plan: planDeLaCarga(r.carga, org, ahora) };
}

/** Aplica una parte del plan, en un lote atómico. */
export async function aplicarParte(db: BaseD1, parte: readonly Sentencia[]): Promise<void> {
  await db.batch(parte.map((x) => db.prepare(x.sql).bind(...x.params)));
}
