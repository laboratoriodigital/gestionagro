/**
 * «Descargar todo» (HU-T10.7, TIENDA-3.0 §1.3 y §12.6): la tienda en `tienda-export/1`, el mismo
 * formato de la carga (`tienda-import/1`, HU-T12.2), para que sirva de respaldo y para volver.
 *
 * - Sale directo en la respuesta, sin pasar por el almacén: no queda una copia que alguien tenga
 *   que borrar.
 * - Lleva lo que la carga sabe escribir: ajustes (sin el cobro ni sus llaves, con los valores por
 *   omisión de su esquema, como los escribe la carga), colecciones,
 *   productos con sus variantes, envíos, cupones, páginas y los pedidos ya cerrados, sin datos
 *   personales. Las fotos van por su enlace.
 * - Lo que la carga no aceptaría no se exporta como si sirviera: los pedidos en curso y los que
 *   nombran una variante que ya no se vende se cuentan en `excluidos`, con su razón.
 * - `huellas`: el SHA-256 de cada tabla del archivo. Exportar, importar en una tienda vacía y
 *   volver a exportar da las mismas (CA3).
 * - Con datos personales (CA2): solo el propietario, con entrada reciente; queda en el registro.
 *   Van en `datosPersonales`, que la carga ignora.
 */

import type { Kek } from '@ed1/cifrado';
import { ESQUEMAS, leerFormatos } from '@ed1/tienda-schema';
import { abrirContactos } from './bandeja.ts';
import type { Quien } from './catalogo.ts';
import { abrirSolicitudes } from './panel-solicitudes.ts';
import { sha256 } from './pedidos.ts';
import { anotar } from './registro.ts';

export const FORMATO = 'tienda-export/1';
/** Las secciones de ajustes que viajan: todas menos `cobro`, que se entra en el panel. */
const SECCIONES = [
  'identidad',
  'contacto',
  'apariencia',
  'venta',
  'legal',
  'medicion',
  'agentes',
  'avisos',
] as const;
/** Lo que entra por la carga sale sin su prefijo: la ida y la vuelta dan la misma referencia. */
const sinPrefijo = (id: string, prefijo: string) =>
  id.startsWith(prefijo) ? id.slice(prefijo.length) : id;
const leerJson = (texto: string | null) => (texto ? (JSON.parse(texto) as unknown) : null);

interface Opcion {
  nombre: string;
  valores: string[];
}
const opcionesEnPalabras = (opciones: readonly Opcion[], valores: readonly string[]) =>
  opciones
    .map((o, i) => (valores[i] ? `${o.nombre}: ${valores[i]}` : ''))
    .filter(Boolean)
    .join(' · ');

export interface Exportacion {
  formato: typeof FORMATO;
  exportada: string;
  tienda: { slug: string; nombre: string };
  ajustes: Record<string, unknown>;
  colecciones: { refExterna: string; nombre: string; slug: string }[];
  productos: {
    refExterna: string;
    nombre: string;
    slug: string;
    descripcionMd: string;
    estado: string;
    opciones: Opcion[];
    variantes: {
      valores: string[];
      sku?: string;
      precioCop: number;
      precioAntesCop?: number;
      stock: number | null;
    }[];
    medios: { url: string; alt: string; variante?: string[] }[];
    colecciones: string[];
    retracto: { aplica: true } | { aplica: false; motivo: string };
    soloMayores: boolean;
    ivaPct: number | null;
  }[];
  envios: {
    refExterna: string;
    nombre: string;
    precioCop: number;
    gratisDesdeCop: number | null;
    ciudades: string[] | null;
    diasMin: number;
    diasMax: number;
  }[];
  cupones: {
    codigo: string;
    tipo: string;
    valor: number;
    minimoCop: number;
    usosMaximos: number | null;
  }[];
  paginas: { refExterna: string; titulo: string; slug: string; md: string }[];
  pedidos: {
    codigo: string;
    creado: string;
    estado: string;
    formaPago: string;
    lineas: {
      nombre: string;
      opciones?: string;
      sku?: string;
      precioCop: number;
      cantidad: number;
    }[];
    totales: { subtotal: number; descuento: number; envio: number; total: number };
  }[];
  excluidos: { pedidosEnCurso: number; pedidosSinSuVariante: number };
  huellas: Record<string, string>;
  datosPersonales?: {
    pedidos: ({ codigo: string } & Record<string, unknown>)[];
    solicitudes: Record<string, unknown>[];
  };
}

/** Las tablas que la ida y la vuelta tienen que dejar iguales, en el orden en que se cargan. */
export const TABLAS = [
  'ajustes',
  'colecciones',
  'productos',
  'variantes',
  'medios',
  'envios',
  'cupones',
  'paginas',
  'pedidos',
] as const;

async function huellas(e: Omit<Exportacion, 'huellas'>): Promise<Record<string, string>> {
  const de = {
    ajustes: e.ajustes,
    colecciones: e.colecciones,
    productos: e.productos.map(({ variantes: _v, medios: _m, ...p }) => p),
    variantes: e.productos.map((p) => [p.refExterna, p.variantes]),
    medios: e.productos.map((p) => [p.refExterna, p.medios]),
    envios: e.envios,
    cupones: e.cupones,
    paginas: e.paginas,
    pedidos: e.pedidos,
  };
  const r: Record<string, string> = {};
  for (const t of TABLAS) r[t] = await sha256(JSON.stringify(de[t]));
  return r;
}

const EN_CURSO = new Set(['pendiente', 'por_pagar']);
const MAS = 5000;

export async function exportarTienda(
  q: Quien,
  o: {
    medios: string | undefined;
    datosPersonales: boolean;
    kek: Kek | null;
    /** El respaldo semanal (HU-T17.3) no se anota: no lo descargó nadie, y su rastro es la tarea. */
    sinAnotar?: boolean;
  },
): Promise<Exportacion | { estado: 'sin-llave'; motivo: string }> {
  if (o.datosPersonales && !o.kek) {
    console.error('tienda-api: sin la KEK no se exportan los datos personales');
    return {
      estado: 'sin-llave',
      motivo: 'No pudimos abrir los datos personales ahora. Intenta en unos minutos.',
    };
  }
  const db = q.db;
  const [tienda, ajustes, colecciones, productos, variantes, medios, enColeccion] =
    await Promise.all([
      db
        .prepare('SELECT slug, nombre FROM tienda WHERE org_id = ?')
        .bind(q.org)
        .first<{ slug: string; nombre: string }>(),
      db
        .prepare(`SELECT seccion, datos FROM ajuste WHERE org_id = ? AND seccion <> 'cobro'`)
        .bind(q.org)
        .all<{ seccion: string; datos: string }>(),
      db
        .prepare(
          `SELECT id, slug, nombre FROM coleccion WHERE org_id = ? AND borrado IS NULL
            ORDER BY posicion, slug LIMIT ${MAS}`,
        )
        .bind(q.org)
        .all<{ id: string; slug: string; nombre: string }>(),
      db
        .prepare(
          `SELECT id, ref_externa, slug, nombre, descripcion_md, estado, opciones, retracto, retracto_motivo,
                  solo_mayores, iva_pct
             FROM producto WHERE org_id = ? AND borrado IS NULL ORDER BY posicion, slug LIMIT ${MAS}`,
        )
        .bind(q.org)
        .all<{
          id: string;
          ref_externa: string | null;
          slug: string;
          nombre: string;
          descripcion_md: string;
          estado: string;
          opciones: string;
          retracto: string;
          retracto_motivo: string | null;
          solo_mayores: number;
          iva_pct: number | null;
        }>(),
      db
        .prepare(
          `SELECT id, producto_id, clave, sku, precio_cop, precio_antes_cop, stock FROM variante
            WHERE org_id = ? AND activa = 1 ORDER BY producto_id, posicion, clave LIMIT ${MAS * 10}`,
        )
        .bind(q.org)
        .all<{
          id: string;
          producto_id: string;
          clave: string;
          sku: string | null;
          precio_cop: number;
          precio_antes_cop: number | null;
          stock: number | null;
        }>(),
      db
        .prepare(
          `SELECT id, producto_id, variante_id, alt, formatos FROM medio WHERE org_id = ?
            ORDER BY producto_id, posicion, id LIMIT ${MAS * 12}`,
        )
        .bind(q.org)
        .all<{
          id: string;
          producto_id: string;
          variante_id: string | null;
          alt: string;
          formatos: string;
        }>(),
      db
        .prepare(
          `SELECT cp.producto_id, c.slug FROM coleccion_producto cp
             JOIN coleccion c ON c.org_id = ? AND c.id = cp.coleccion_id AND c.borrado IS NULL
            WHERE cp.org_id = ? ORDER BY cp.producto_id, cp.posicion, c.slug`,
        )
        .bind(q.org, q.org)
        .all<{ producto_id: string; slug: string }>(),
    ]);
  const [envios, cupones, paginas, pedidos, lineas] = await Promise.all([
    db
      .prepare(
        `SELECT id, nombre, precio_cop, gratis_desde_cop, ciudades, dias_min, dias_max FROM envio_opcion
          WHERE org_id = ? AND activa = 1 AND borrado IS NULL ORDER BY posicion, id`,
      )
      .bind(q.org)
      .all<{
        id: string;
        nombre: string;
        precio_cop: number;
        gratis_desde_cop: number | null;
        ciudades: string | null;
        dias_min: number;
        dias_max: number;
      }>(),
    db
      .prepare(
        `SELECT codigo, tipo, valor, minimo_cop, usos_maximos FROM cupon
          WHERE org_id = ? AND activo = 1 AND borrado IS NULL ORDER BY codigo`,
      )
      .bind(q.org)
      .all<{
        codigo: string;
        tipo: string;
        valor: number;
        minimo_cop: number;
        usos_maximos: number | null;
      }>(),
    db
      .prepare(
        'SELECT id, slug, titulo, cuerpo_md FROM pagina WHERE org_id = ? AND borrado IS NULL ORDER BY slug',
      )
      .bind(q.org)
      .all<{ id: string; slug: string; titulo: string; cuerpo_md: string }>(),
    db
      .prepare(
        `SELECT id, codigo, creado, estado, forma_pago, subtotal_cop, descuento_cop, envio_cop, total_cop
           FROM pedido WHERE org_id = ? ORDER BY creado, codigo LIMIT ${MAS * 10}`,
      )
      .bind(q.org)
      .all<{
        id: string;
        codigo: string;
        creado: string;
        estado: string;
        forma_pago: string;
        subtotal_cop: number;
        descuento_cop: number;
        envio_cop: number;
        total_cop: number;
      }>(),
    db
      .prepare(
        `SELECT pedido_id, variante_id, nombre, opciones, sku, precio_unitario_cop, cantidad FROM pedido_linea
          WHERE org_id = ? ORDER BY pedido_id, linea`,
      )
      .bind(q.org)
      .all<{
        pedido_id: string;
        variante_id: string;
        nombre: string;
        opciones: string;
        sku: string | null;
        precio_unitario_cop: number;
        cantidad: number;
      }>(),
  ]);

  const deProducto = <T extends { producto_id: string }>(filas: readonly T[]) => {
    const m = new Map<string, T[]>();
    for (const f of filas) m.set(f.producto_id, [...(m.get(f.producto_id) ?? []), f]);
    return m;
  };
  const variantesDe = deProducto(variantes.results);
  const mediosDe = deProducto(medios.results);
  const coleccionesDe = deProducto(enColeccion.results);
  const valoresDe = (clave: string) => (clave === '' ? [] : clave.split('|'));
  const urlDe = (m: { id: string; formatos: string }) => {
    const { formato, anchos } = leerFormatos(m.formatos);
    const ancho = anchos.at(-1);
    return o.medios && ancho ? `https://${o.medios}/${q.org}/${m.id}/${ancho}.${formato}` : null;
  };

  const exportados = productos.results.map((p) => {
    const opciones = (leerJson(p.opciones) as Opcion[] | null) ?? [];
    const suyas = variantesDe.get(p.id) ?? [];
    return {
      fila: p,
      opciones,
      suyas,
      producto: {
        refExterna: p.ref_externa ?? p.id,
        nombre: p.nombre,
        slug: p.slug,
        descripcionMd: p.descripcion_md,
        estado: p.estado,
        opciones,
        variantes: suyas.map((v) => ({
          valores: valoresDe(v.clave),
          ...(v.sku ? { sku: v.sku } : {}),
          precioCop: v.precio_cop,
          ...(v.precio_antes_cop === null ? {} : { precioAntesCop: v.precio_antes_cop }),
          stock: v.stock,
        })),
        medios: (mediosDe.get(p.id) ?? []).flatMap((m) => {
          const url = urlDe(m);
          const variante = suyas.find((v) => v.id === m.variante_id);
          return url
            ? [{ url, alt: m.alt, ...(variante ? { variante: valoresDe(variante.clave) } : {}) }]
            : [];
        }),
        colecciones: (coleccionesDe.get(p.id) ?? []).map((c) => c.slug),
        retracto:
          p.retracto === 'aplica'
            ? ({ aplica: true } as const)
            : ({ aplica: false, motivo: p.retracto_motivo ?? '' } as const),
        soloMayores: p.solo_mayores === 1,
        ivaPct: p.iva_pct,
      },
    };
  });

  // Una línea vuelve a encontrar su variante por el SKU o por el nombre y las opciones (HU-T12.2).
  const porVariante = new Map(
    exportados.flatMap((e) => e.suyas.map((v) => [v.id, { e, v }] as const)),
  );
  const lineasDe = new Map<string, typeof lineas.results>();
  for (const l of lineas.results)
    lineasDe.set(l.pedido_id, [...(lineasDe.get(l.pedido_id) ?? []), l]);
  const excluidos = { pedidosEnCurso: 0, pedidosSinSuVariante: 0 };
  const historicos: Exportacion['pedidos'] = [];
  for (const p of pedidos.results) {
    if (EN_CURSO.has(p.estado)) {
      excluidos.pedidosEnCurso++;
      continue;
    }
    const suyas = lineasDe.get(p.id) ?? [];
    const vuelven = suyas.every((l) => {
      const x = porVariante.get(l.variante_id);
      if (!x) return false;
      if (l.sku) return x.v.sku === l.sku;
      return (
        x.e.producto.nombre === l.nombre &&
        opcionesEnPalabras(x.e.opciones, valoresDe(x.v.clave)) === l.opciones
      );
    });
    if (!vuelven || suyas.length === 0) {
      excluidos.pedidosSinSuVariante++;
      continue;
    }
    historicos.push({
      codigo: p.codigo,
      creado: p.creado,
      estado: p.estado,
      formaPago: p.forma_pago,
      lineas: suyas.map((l) => ({
        nombre: l.nombre,
        ...(l.opciones ? { opciones: l.opciones } : {}),
        ...(l.sku ? { sku: l.sku } : {}),
        precioCop: l.precio_unitario_cop,
        cantidad: l.cantidad,
      })),
      totales: {
        subtotal: p.subtotal_cop,
        descuento: p.descuento_cop,
        envio: p.envio_cop,
        total: p.total_cop,
      },
    });
  }

  const ajustesPorSeccion: Record<string, unknown> = {};
  for (const s of SECCIONES) {
    const fila = ajustes.results.find((a) => a.seccion === s);
    if (!fila) continue;
    // Como la escribe la carga: con los valores por omisión de su esquema. Si no lo cumple, sale
    // tal cual y la carga dirá qué falta.
    const datos = leerJson(fila.datos);
    const r = ESQUEMAS[s][1].safeParse(datos);
    ajustesPorSeccion[s] = r.success ? r.data : datos;
  }
  const base: Omit<Exportacion, 'huellas'> = {
    formato: FORMATO,
    exportada: q.instante,
    tienda: { slug: tienda?.slug ?? '', nombre: tienda?.nombre ?? '' },
    ajustes: ajustesPorSeccion,
    colecciones: colecciones.results.map((c) => ({
      refExterna: c.slug,
      nombre: c.nombre,
      slug: c.slug,
    })),
    productos: exportados.map((e) => e.producto),
    envios: envios.results.map((e) => ({
      refExterna: sinPrefijo(e.id, 'imp-e-'),
      nombre: e.nombre,
      precioCop: e.precio_cop,
      gratisDesdeCop: e.gratis_desde_cop,
      ciudades: leerJson(e.ciudades) as string[] | null,
      diasMin: e.dias_min,
      diasMax: e.dias_max,
    })),
    cupones: cupones.results.map((c) => ({
      codigo: c.codigo,
      tipo: c.tipo,
      valor: c.valor,
      minimoCop: c.minimo_cop,
      usosMaximos: c.usos_maximos,
    })),
    paginas: paginas.results.map((p) => ({
      refExterna: sinPrefijo(p.id, 'imp-g-'),
      titulo: p.titulo,
      slug: p.slug,
      md: p.cuerpo_md,
    })),
    pedidos: historicos,
    excluidos,
  };
  const exportacion: Exportacion = { ...base, huellas: await huellas(base) };

  if (o.datosPersonales && o.kek) {
    const ids = pedidos.results.map((p) => p.id);
    const contactos = new Map<string, Record<string, unknown>>();
    for (let i = 0; i < ids.length; i += 50) {
      for (const [id, c] of await abrirContactos(q, o.kek, ids.slice(i, i + 50)))
        contactos.set(id, c as unknown as Record<string, unknown>);
    }
    exportacion.datosPersonales = {
      pedidos: pedidos.results.flatMap((p) => {
        const c = contactos.get(p.id);
        return c ? [{ codigo: p.codigo, ...c }] : [];
      }),
      solicitudes: await abrirSolicitudes(q, o.kek),
    };
  }
  if (o.sinAnotar) return exportacion;
  await anotar(q.db, {
    org: q.org,
    actor: q.actor,
    accion: o.datosPersonales ? 'exportar.datos_personales' : 'exportar',
    entidad: 'tienda',
    entidadId: q.org,
    antes: null,
    despues: { productos: exportacion.productos.length, pedidos: exportacion.pedidos.length },
    instante: q.instante,
  }).then((s) => s.run());
  return exportacion;
}
