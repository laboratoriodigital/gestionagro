/**
 * HU-T8.2 y HU-T8.4: el catálogo desde el panel (TIENDA-3.0 §5.3, §12.4 y §13.3). Productos con
 * sus combinaciones, su estado y su papelera, y las colecciones.
 *
 * - **Concurrencia optimista (CA2).** Cada escritura lleva la `version` que leyó. La primera
 *   sentencia del lote sube la versión solo si sigue igual, y la segunda aborta el lote entero si
 *   no cambió nada: dos personas editando no se pisan, aunque escriban en el mismo instante.
 * - **Idempotencia (CA2).** La respuesta de cada `op` queda en `operacion`, en el mismo lote:
 *   repetirla devuelve lo mismo sin escribir otra vez.
 * - **El registro (HU-T10.6).** Cada cambio deja su fila con el antes y el después, en el mismo lote.
 * - **La dirección (CA3).** Cambiar el slug guarda el anterior en `seo.slugsAnteriores`; el horno
 *   deja una redirección 301 desde él.
 * - Las combinaciones no se borran (un pedido viejo las nombra): una que ya no está queda inactiva,
 *   y vuelve si se agrega otra vez.
 */
import type { BaseD1, SentenciaD1 } from '@ed1/d1';
import {
  cambiarEstadoDeProducto,
  borrarColeccion as esquemaBorrarColeccion,
  guardarColeccion as esquemaGuardarColeccion,
  ordenarColecciones as esquemaOrdenar,
  type GuardarProducto,
  leerFormatos,
  revisarProducto,
  tocarProducto,
} from '@ed1/tienda-schema';
import type { z } from 'zod';
import { anotar } from './registro.ts';

type Problema = { campo: string; mensaje: string };

export type Resultado =
  | { estado: 'guardado'; id: string; version: number; slug?: string }
  | { estado: 'problemas'; problemas: Problema[] }
  | { estado: 'cambiado'; motivo: string; version: number | null }
  | { estado: 'no-existe'; motivo: string };

export interface Quien {
  db: BaseD1;
  org: string;
  /** `usuario:<sub>`. */
  actor: string;
  instante: string;
}

export const MOTIVO_CAMBIADO =
  'Alguien más cambió esto mientras lo editabas. Revisa cómo quedó y vuelve a guardar tus cambios.';
const MOTIVO_NO_EXISTE = 'Eso ya no está: puede que lo hayan borrado.';
/** Aborta el lote si la sentencia anterior no cambió ninguna fila (`json()` de un texto inválido). */
export const SI_CAMBIO = "SELECT CASE changes() WHEN 0 THEN json('cambiado') ELSE 1 END";
export const esCambiado = (e: unknown) => /malformed JSON/i.test(String(e));
export const esOperacionRepetida = (e: unknown) =>
  /UNIQUE constraint failed: operacion/i.test(String(e));
/** Otra escritura tomó la dirección o el SKU entre la revisión y el lote. */
const choqueDe = (e: unknown): Problema | null => {
  const t = String(e);
  if (/UNIQUE constraint failed: (producto|coleccion)\.org_id, \1\.slug/i.test(t))
    return { campo: 'slug', mensaje: 'esa dirección la acaba de tomar otro: elige otra' };
  if (/UNIQUE constraint failed: variante\.org_id, variante\.sku/i.test(t))
    return { campo: 'variantes', mensaje: 'un SKU lo acaba de tomar otro producto' };
  return null;
};

/** La papelera guarda 30 días (CA1). Después el producto queda solo para la historia de los pedidos. */
export const DIAS_DE_PAPELERA = 30;
const finDePapelera = (instante: string) =>
  new Date(Date.parse(instante) - DIAS_DE_PAPELERA * 86_400_000).toISOString();

const idNuevo = (prefijo: string) =>
  `${prefijo}-${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;

/** `nombre` en minúsculas, sin tildes ni signos: la dirección que sale del nombre. */
export const slugDe = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'producto';

const problemasDe = (r: z.ZodSafeParseResult<unknown>): Problema[] =>
  r.success
    ? []
    : r.error.issues.map((i) => ({ campo: i.path.map(String).join('.'), mensaje: i.message }));

/** La respuesta guardada de una `op`, si ya se aplicó. */
export async function yaAplicada<R = Resultado>(q: Quien, op: string): Promise<R | null> {
  const fila = await q.db
    .prepare('SELECT respuesta FROM operacion WHERE org_id = ? AND op = ?')
    .bind(q.org, op)
    .first<{ respuesta: string }>();
  return fila ? (JSON.parse(fila.respuesta) as R) : null;
}

export const guardarOperacion = (q: Quien, op: string, ruta: string, r: object) =>
  q.db
    .prepare('INSERT INTO operacion (org_id, op, ruta, respuesta, creada) VALUES (?, ?, ?, ?, ?)')
    .bind(q.org, op, ruta, JSON.stringify(r), q.instante);

/**
 * Corre el lote. Si otra escritura ganó la carrera, responde `cambiado` con la versión actual; si
 * la misma `op` entró por otro lado, la respuesta de aquella.
 */
async function aplicar(
  q: Quien,
  op: string,
  lote: SentenciaD1[],
  r: Resultado,
  versionActual: () => Promise<number | null>,
): Promise<Resultado> {
  try {
    await q.db.batch(lote);
    return r;
  } catch (e) {
    if (esCambiado(e))
      return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: await versionActual() };
    if (esOperacionRepetida(e)) return (await yaAplicada(q, op)) ?? r;
    const choque = choqueDe(e);
    if (choque) return { estado: 'problemas', problemas: [choque] };
    throw e;
  }
}

// ── Productos ──────────────────────────────────────────────────────────────────────────────

interface FilaProducto {
  id: string;
  slug: string;
  nombre: string;
  descripcion_md: string;
  estado: string;
  opciones: string;
  retracto: string;
  retracto_motivo: string | null;
  solo_mayores: number;
  iva_pct: number | null;
  seo: string;
  version: number;
  borrado: string | null;
}
interface FilaVariante {
  id: string;
  clave: string;
  sku: string | null;
  precio_cop: number;
  precio_antes_cop: number | null;
  stock: number | null;
  reservado: number;
  activa: number;
  posicion: number;
}

const COLUMNAS_PRODUCTO =
  'id, slug, nombre, descripcion_md, estado, opciones, retracto, retracto_motivo, solo_mayores, iva_pct, seo, version, borrado';

async function filaDelProducto(q: Quien, id: string) {
  return q.db
    .prepare(`SELECT ${COLUMNAS_PRODUCTO} FROM producto WHERE org_id = ? AND id = ?`)
    .bind(q.org, id)
    .first<FilaProducto>();
}
async function variantesDe(q: Quien, productoId: string) {
  const { results } = await q.db
    .prepare(
      `SELECT id, clave, sku, precio_cop, precio_antes_cop, stock, reservado, activa, posicion
         FROM variante WHERE org_id = ? AND producto_id = ? ORDER BY posicion, clave`,
    )
    .bind(q.org, productoId)
    .all<FilaVariante>();
  return results;
}
const versionDe = (q: Quien, tabla: 'producto' | 'coleccion', id: string) => async () =>
  (
    await q.db
      .prepare(`SELECT version FROM ${tabla} WHERE org_id = ? AND id = ? AND borrado IS NULL`)
      .bind(q.org, id)
      .first<{ version: number }>()
  )?.version ?? null;

const seoDe = (t: string): Record<string, unknown> => {
  try {
    const v = JSON.parse(t) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};
const slugsAnteriores = (seo: Record<string, unknown>): string[] =>
  Array.isArray(seo['slugsAnteriores'])
    ? ((seo['slugsAnteriores'] as unknown[]).filter((s) => typeof s === 'string') as string[])
    : [];

/** Lo que el panel muestra de un producto: el producto, sus combinaciones activas y sus fotos. */
export async function leerProducto(q: Quien, id: string) {
  const p = await filaDelProducto(q, id);
  if (!p) return null;
  const variantes = (await variantesDe(q, id)).filter((v) => v.activa === 1);
  const { results: medios } = await q.db
    .prepare(
      'SELECT id, variante_id, alt, ancho, alto, formatos, posicion FROM medio WHERE org_id = ? AND producto_id = ? ORDER BY posicion, id',
    )
    .bind(q.org, id)
    .all<{
      id: string;
      variante_id: string | null;
      alt: string;
      ancho: number;
      alto: number;
      formatos: string;
      posicion: number;
    }>();
  return {
    id: p.id,
    version: p.version,
    slug: p.slug,
    nombre: p.nombre,
    descripcionMd: p.descripcion_md,
    estado: p.estado,
    enPapelera: p.borrado !== null,
    opciones: JSON.parse(p.opciones) as { nombre: string; valores: string[] }[],
    retracto:
      p.retracto === 'aplica'
        ? { aplica: true }
        : { aplica: false, motivo: p.retracto_motivo ?? '' },
    soloMayores: p.solo_mayores === 1,
    ivaPct: p.iva_pct,
    variantes: variantes.map((v) => ({
      id: v.id,
      valores: v.clave === '' ? [] : v.clave.split('|'),
      sku: v.sku,
      precioCop: v.precio_cop,
      precioAntesCop: v.precio_antes_cop,
      stock: v.stock,
      reservado: v.reservado,
    })),
    medios: medios.map((m) => ({
      id: m.id,
      varianteId: m.variante_id,
      alt: m.alt,
      ancho: m.ancho,
      alto: m.alto,
      ...leerFormatos(m.formatos),
    })),
  };
}

/** La lista del panel: nombre, estado, cuántas combinaciones, el precio desde y las existencias. */
export async function listarProductos(
  q: Quien,
  opciones: { papelera?: boolean; buscar?: string } = {},
) {
  const buscar = (opciones.buscar ?? '').trim().toLowerCase();
  const { results } = await q.db
    .prepare(
      `SELECT p.id, p.slug, p.nombre, p.estado, p.version, p.posicion, p.borrado,
              count(v.id) AS combinaciones, min(v.precio_cop) AS desde,
              CASE WHEN count(v.id) > 0 AND count(v.stock) = count(v.id) THEN sum(v.stock) END AS existencias,
              (SELECT m.id FROM medio m WHERE m.org_id = ? AND m.producto_id = p.id ORDER BY m.posicion, m.id LIMIT 1) AS foto
         FROM producto p LEFT JOIN variante v ON v.org_id = p.org_id AND v.producto_id = p.id AND v.activa = 1
        WHERE p.org_id = ? AND (p.borrado IS NULL) = ? AND (p.borrado IS NULL OR p.borrado >= ?)
          AND (? = '' OR lower(p.nombre) LIKE '%' || ? || '%')
        GROUP BY p.id ORDER BY p.posicion, p.nombre LIMIT 500`,
    )
    .bind(q.org, q.org, opciones.papelera ? 0 : 1, finDePapelera(q.instante), buscar, buscar)
    .all<{
      id: string;
      slug: string;
      nombre: string;
      estado: string;
      version: number;
      posicion: number;
      borrado: string | null;
      combinaciones: number;
      desde: number | null;
      existencias: number | null;
      foto: string | null;
    }>();
  return results.map((r) => ({
    id: r.id,
    slug: r.slug,
    nombre: r.nombre,
    estado: r.estado,
    version: r.version,
    combinaciones: r.combinaciones,
    desde: r.desde,
    existencias: r.existencias,
    foto: r.foto,
    borrado: r.borrado,
  }));
}

/** Lo que el registro guarda de un producto: lo que la frase cuenta, sin la descripción entera. */
const resumenDelProducto = (p: {
  nombre: string;
  slug: string;
  estado: string;
  opciones: unknown;
}) => ({ nombre: p.nombre, slug: p.slug, estado: p.estado, opciones: p.opciones });

async function slugLibre(q: Quien, slug: string, salvo: string | null): Promise<boolean> {
  const otro = await q.db
    .prepare(
      'SELECT id FROM producto WHERE org_id = ? AND slug = ? AND borrado IS NULL AND id IS NOT ?',
    )
    .bind(q.org, slug, salvo)
    .first<{ id: string }>();
  return !otro;
}

/** `productos/guardar`: crea o edita un producto con todas sus combinaciones (CA1 a CA4). */
export async function guardarProducto(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const revision = revisarProducto(cuerpo);
  if (!revision.ok) return { estado: 'problemas', problemas: revision.problemas };
  const d = revision.datos;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;

  const actual = d.id ? await filaDelProducto(q, d.id) : null;
  if (d.id && (!actual || actual.borrado !== null))
    return { estado: 'no-existe', motivo: MOTIVO_NO_EXISTE };
  if (actual && actual.version !== d.version) {
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: actual.version };
  }

  const problemas: Problema[] = [];
  // La dirección: la que pidió, la que tenía, o la del nombre (con -2, -3… si ya está tomada).
  let slug = d.slug ?? actual?.slug ?? slugDe(d.nombre);
  if (!d.slug && !actual) {
    const base = slug.slice(0, 96);
    for (let n = 2; !(await slugLibre(q, slug, null)) && n < 100; n++) slug = `${base}-${n}`;
  } else if (!(await slugLibre(q, slug, actual?.id ?? null))) {
    problemas.push({ campo: 'slug', mensaje: `la dirección «${slug}» ya la usa otro producto` });
  }
  const viejas = actual ? await variantesDe(q, actual.id) : [];
  const skus = d.variantes.map((v) => v.sku).filter((s): s is string => s !== null);
  if (new Set(skus).size !== skus.length)
    problemas.push({ campo: 'variantes', mensaje: 'hay un SKU repetido' });
  if (skus.length > 0) {
    const { results } = await q.db
      .prepare(
        `SELECT sku FROM variante WHERE org_id = ? AND sku IN (${skus.map(() => '?').join(', ')}) AND producto_id IS NOT ?`,
      )
      .bind(q.org, ...skus, actual?.id ?? null)
      .all<{ sku: string }>();
    for (const r of results)
      problemas.push({ campo: 'variantes', mensaje: `el SKU ${r.sku} ya lo usa otro producto` });
  }
  const porClave = new Map(viejas.map((v) => [v.clave, v]));
  d.variantes.forEach((v, j) => {
    const vieja = porClave.get(v.valores.join('|'));
    if (vieja && v.stock !== null && v.stock < vieja.reservado) {
      problemas.push({
        campo: `variantes.${j}.stock`,
        mensaje: `hay ${vieja.reservado} apartadas en pedidos: las existencias no pueden bajar de ahí`,
      });
    }
  });
  if (problemas.length > 0) return { estado: 'problemas', problemas };

  const id = actual?.id ?? idNuevo('p');
  const version = (actual?.version ?? 0) + 1;
  const seo = actual ? seoDe(actual.seo) : {};
  if (actual && actual.slug !== slug) {
    seo['slugsAnteriores'] = [...new Set([actual.slug, ...slugsAnteriores(seo)])]
      .filter((s) => s !== slug)
      .slice(0, 20);
  }
  const retracto = d.retracto.aplica ? 'aplica' : 'no_aplica';
  const motivo = d.retracto.aplica ? null : d.retracto.motivo;
  const lote: SentenciaD1[] = [];
  const registro: Promise<SentenciaD1>[] = [];
  const nuevo = resumenDelProducto({
    nombre: d.nombre,
    slug,
    estado: d.estado,
    opciones: d.opciones,
  });

  if (actual) {
    lote.push(
      q.db
        .prepare(
          `UPDATE producto SET slug = ?, nombre = ?, descripcion_md = ?, estado = ?, opciones = ?, retracto = ?,
             retracto_motivo = ?, solo_mayores = ?, iva_pct = ?, seo = ?, version = version + 1, actualizado = ?
           WHERE org_id = ? AND id = ? AND version = ? AND borrado IS NULL`,
        )
        .bind(
          slug,
          d.nombre,
          d.descripcionMd,
          d.estado,
          JSON.stringify(d.opciones),
          retracto,
          motivo,
          d.soloMayores ? 1 : 0,
          d.ivaPct,
          JSON.stringify(seo),
          q.instante,
          q.org,
          id,
          actual.version,
        ),
      q.db.prepare(SI_CAMBIO),
    );
    const antes = resumenDelProducto({ ...actual, opciones: JSON.parse(actual.opciones) });
    if (
      JSON.stringify(antes) !== JSON.stringify(nuevo) ||
      actual.descripcion_md !== d.descripcionMd
    ) {
      registro.push(
        anotar(q.db, {
          org: q.org,
          actor: q.actor,
          accion:
            actual.estado !== d.estado &&
            JSON.stringify({ ...antes, estado: d.estado }) === JSON.stringify(nuevo)
              ? 'producto.estado'
              : 'producto.editar',
          entidad: 'producto',
          entidadId: id,
          antes,
          despues: nuevo,
          instante: q.instante,
        }),
      );
    }
  } else {
    lote.push(
      q.db
        .prepare(
          `INSERT INTO producto (org_id, id, slug, nombre, descripcion_md, estado, opciones, retracto, retracto_motivo,
             solo_mayores, iva_pct, posicion, creado, actualizado)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
             (SELECT coalesce(max(posicion), -1) + 1 FROM producto WHERE org_id = ?), ?, ?)`,
        )
        .bind(
          q.org,
          id,
          slug,
          d.nombre,
          d.descripcionMd,
          d.estado,
          JSON.stringify(d.opciones),
          retracto,
          motivo,
          d.soloMayores ? 1 : 0,
          d.ivaPct,
          q.org,
          q.instante,
          q.instante,
        ),
    );
    registro.push(
      anotar(q.db, {
        org: q.org,
        actor: q.actor,
        accion: 'producto.crear',
        entidad: 'producto',
        entidadId: id,
        antes: null,
        despues: nuevo,
        instante: q.instante,
      }),
    );
  }

  // Las combinaciones: se agregan, se cambian o quedan inactivas; ninguna se borra. Si algún SKU
  // cambia de combinación, primero se sueltan todos los del producto: así dos combinaciones pueden
  // intercambiarlos sin chocar con el índice único a mitad del lote.
  const skuDe = new Map(viejas.map((v) => [v.clave, v.sku]));
  const muevenSku = d.variantes.some((v) => (skuDe.get(v.valores.join('|')) ?? null) !== v.sku);
  if (actual && muevenSku) {
    lote.push(
      q.db
        .prepare('UPDATE variante SET sku = NULL WHERE org_id = ? AND producto_id = ?')
        .bind(q.org, id),
    );
  }
  const enUso = new Set<string>();
  const resumenVariante = (
    clave: string,
    v: {
      precioCop: number;
      stock: number | null;
      sku: string | null;
      precioAntesCop: number | null;
    },
  ) => ({
    nombre: d.nombre,
    combinacion: clave,
    precioCop: v.precioCop,
    precioAntesCop: v.precioAntesCop,
    stock: v.stock,
    sku: v.sku,
  });
  d.variantes.forEach((v, j) => {
    const clave = v.valores.join('|');
    enUso.add(clave);
    const vieja = porClave.get(clave);
    if (!vieja) {
      lote.push(
        q.db
          .prepare(
            `INSERT INTO variante (org_id, id, producto_id, clave, sku, precio_cop, precio_antes_cop, stock, posicion,
               cambio_motivo, cambio_ref, actualizado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ajuste', ?, ?)`,
          )
          .bind(
            q.org,
            idNuevo('v'),
            id,
            clave,
            v.sku,
            v.precioCop,
            v.precioAntesCop,
            v.stock,
            j,
            `op:${d.op}`,
            q.instante,
          ),
      );
      registro.push(
        anotar(q.db, {
          org: q.org,
          actor: q.actor,
          accion: 'variante.crear',
          entidad: 'variante',
          entidadId: id,
          antes: null,
          despues: resumenVariante(clave, v),
          instante: q.instante,
        }),
      );
      return;
    }
    const cambia =
      (muevenSku && v.sku !== null) ||
      vieja.activa !== 1 ||
      vieja.sku !== v.sku ||
      vieja.precio_cop !== v.precioCop ||
      vieja.precio_antes_cop !== v.precioAntesCop ||
      vieja.stock !== v.stock ||
      vieja.posicion !== j;
    if (!cambia) return;
    lote.push(
      q.db
        .prepare(
          `UPDATE variante SET sku = ?, precio_cop = ?, precio_antes_cop = ?, stock = ?, activa = 1, posicion = ?,
             cambio_motivo = 'ajuste', cambio_ref = ?, version = version + 1, actualizado = ?
           WHERE org_id = ? AND id = ?`,
        )
        .bind(
          v.sku,
          v.precioCop,
          v.precioAntesCop,
          v.stock,
          j,
          `op:${d.op}`,
          q.instante,
          q.org,
          vieja.id,
        ),
    );
    const antes = resumenVariante(clave, {
      precioCop: vieja.precio_cop,
      precioAntesCop: vieja.precio_antes_cop,
      stock: vieja.stock,
      sku: vieja.sku,
    });
    const despues = resumenVariante(clave, v);
    if (vieja.activa !== 1) {
      registro.push(
        anotar(q.db, {
          org: q.org,
          actor: q.actor,
          accion: 'variante.crear',
          entidad: 'variante',
          entidadId: vieja.id,
          antes: null,
          despues,
          instante: q.instante,
        }),
      );
    } else if (JSON.stringify(antes) !== JSON.stringify(despues)) {
      registro.push(
        anotar(q.db, {
          org: q.org,
          actor: q.actor,
          accion: 'variante.editar',
          entidad: 'variante',
          entidadId: vieja.id,
          antes,
          despues,
          instante: q.instante,
        }),
      );
    }
  });
  for (const vieja of viejas) {
    if (vieja.activa !== 1 || enUso.has(vieja.clave)) continue;
    lote.push(
      q.db
        .prepare(
          'UPDATE variante SET activa = 0, version = version + 1, actualizado = ? WHERE org_id = ? AND id = ?',
        )
        .bind(q.instante, q.org, vieja.id),
    );
    registro.push(
      anotar(q.db, {
        org: q.org,
        actor: q.actor,
        accion: 'variante.quitar',
        entidad: 'variante',
        entidadId: vieja.id,
        antes: { nombre: d.nombre, combinacion: vieja.clave },
        despues: null,
        instante: q.instante,
      }),
    );
  }

  const r: Resultado = { estado: 'guardado', id, version, slug };
  lote.push(...(await Promise.all(registro)), guardarOperacion(q, d.op, 'productos/guardar', r));
  return aplicar(q, d.op, lote, r, versionDe(q, 'producto', id));
}

/** `productos/estado`, `productos/borrar` (a la papelera) y `productos/restaurar`. */
export async function tocarElProducto(
  q: Quien,
  cuerpo: unknown,
  accion: 'estado' | 'borrar' | 'restaurar',
): Promise<Resultado> {
  const r0 =
    accion === 'estado'
      ? cambiarEstadoDeProducto.safeParse(cuerpo)
      : tocarProducto.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const d = r0.data as { op: string; id: string; version: number; estado?: string };
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const actual = await filaDelProducto(q, d.id);
  const enPapelera = actual?.borrado !== null;
  const vencido = Boolean(actual?.borrado && actual.borrado < finDePapelera(q.instante));
  if (!actual || (accion === 'restaurar' ? !enPapelera || vencido : enPapelera)) {
    return { estado: 'no-existe', motivo: MOTIVO_NO_EXISTE };
  }
  if (actual.version !== d.version)
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: actual.version };
  if (accion === 'restaurar' && !(await slugLibre(q, actual.slug, actual.id))) {
    return {
      estado: 'problemas',
      problemas: [
        {
          campo: 'slug',
          mensaje: `otro producto ya usa la dirección «${actual.slug}»: cámbiala antes de restaurarlo`,
        },
      ],
    };
  }
  const sets = {
    estado: ['estado = ?', d.estado],
    borrar: ['borrado = ?', q.instante],
    restaurar: ['borrado = ?', null],
  }[accion] as [string, unknown];
  const r: Resultado = { estado: 'guardado', id: actual.id, version: actual.version + 1 };
  const resumen = resumenDelProducto({ ...actual, opciones: undefined });
  const lote = [
    q.db
      .prepare(
        `UPDATE producto SET ${sets[0]}, version = version + 1, actualizado = ?
          WHERE org_id = ? AND id = ? AND version = ? AND borrado IS ${accion === 'restaurar' ? 'NOT ' : ''}NULL`,
      )
      .bind(sets[1], q.instante, q.org, actual.id, actual.version),
    q.db.prepare(SI_CAMBIO),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: `producto.${accion}`,
      entidad: 'producto',
      entidadId: actual.id,
      antes: resumen,
      despues: accion === 'estado' ? { ...resumen, estado: d.estado } : resumen,
      instante: q.instante,
    }),
    guardarOperacion(q, d.op, `productos/${accion}`, r),
  ];
  return aplicar(
    q,
    d.op,
    lote,
    r,
    async () => (await filaDelProducto(q, actual.id))?.version ?? null,
  );
}

/** `productos/ordenar`: el orden del catálogo (HU-T8.4 CA1). */
export async function ordenarProductos(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = esquemaOrdenar.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const previa = await yaAplicada(q, r0.data.op);
  if (previa) return previa;
  const r: Resultado = { estado: 'guardado', id: 'catalogo', version: 1 };
  return aplicar(
    q,
    r0.data.op,
    [
      ...r0.data.ids.map((id, i) =>
        q.db
          .prepare('UPDATE producto SET posicion = ?, actualizado = ? WHERE org_id = ? AND id = ?')
          .bind(i, q.instante, q.org, id),
      ),
      await anotar(q.db, {
        org: q.org,
        actor: q.actor,
        accion: 'productos.ordenar',
        entidad: 'producto',
        entidadId: null,
        antes: null,
        despues: { orden: r0.data.ids },
        instante: q.instante,
      }),
      guardarOperacion(q, r0.data.op, 'productos/ordenar', r),
    ],
    r,
    async () => null,
  );
}

// ── Colecciones (HU-T8.4) ──────────────────────────────────────────────────────────────────

export async function listarColecciones(q: Quien) {
  const { results } = await q.db
    .prepare(
      `SELECT c.id, c.slug, c.nombre, c.descripcion_md, c.visible, c.version,
              (SELECT json_group_array(cp.producto_id) FROM (SELECT producto_id FROM coleccion_producto
                 WHERE org_id = ? AND coleccion_id = c.id ORDER BY posicion) cp) AS productos
         FROM coleccion c WHERE c.org_id = ? AND c.borrado IS NULL ORDER BY c.posicion, c.nombre`,
    )
    .bind(q.org, q.org)
    .all<{
      id: string;
      slug: string;
      nombre: string;
      descripcion_md: string;
      visible: number;
      version: number;
      productos: string;
    }>();
  return results.map((c) => ({
    id: c.id,
    slug: c.slug,
    nombre: c.nombre,
    descripcionMd: c.descripcion_md,
    visible: c.visible === 1,
    version: c.version,
    productos: JSON.parse(c.productos) as string[],
  }));
}

export async function guardarLaColeccion(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = esquemaGuardarColeccion.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const actual = d.id
    ? await q.db
        .prepare(
          'SELECT id, slug, nombre, version FROM coleccion WHERE org_id = ? AND id = ? AND borrado IS NULL',
        )
        .bind(q.org, d.id)
        .first<{ id: string; slug: string; nombre: string; version: number }>()
    : null;
  if (d.id && !actual) return { estado: 'no-existe', motivo: MOTIVO_NO_EXISTE };
  if (actual && actual.version !== d.version)
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: actual.version };
  const slug = d.slug ?? actual?.slug ?? slugDe(d.nombre).slice(0, 80).replace(/-$/, '');
  const problemas: Problema[] = [];
  if (slug.length > 80)
    problemas.push({
      campo: 'slug',
      mensaje: 'la dirección de una colección va hasta 80 caracteres',
    });
  const otra = await q.db
    .prepare(
      'SELECT id FROM coleccion WHERE org_id = ? AND slug = ? AND borrado IS NULL AND id IS NOT ?',
    )
    .bind(q.org, slug, actual?.id ?? null)
    .first();
  if (otra)
    problemas.push({ campo: 'slug', mensaje: `la dirección «${slug}» ya la usa otra colección` });
  const productos = [...new Set(d.productos)];
  if (productos.length > 0) {
    const { results } = await q.db
      .prepare(
        `SELECT id FROM producto WHERE org_id = ? AND borrado IS NULL AND id IN (${productos.map(() => '?').join(', ')})`,
      )
      .bind(q.org, ...productos)
      .all<{ id: string }>();
    const hay = new Set(results.map((x) => x.id));
    for (const p of productos)
      if (!hay.has(p)) problemas.push({ campo: 'productos', mensaje: `el producto ${p} no está` });
  }
  if (problemas.length > 0) return { estado: 'problemas', problemas };

  const id = actual?.id ?? idNuevo('c');
  const r: Resultado = { estado: 'guardado', id, version: (actual?.version ?? 0) + 1, slug };
  const lote: SentenciaD1[] = actual
    ? [
        q.db
          .prepare(
            `UPDATE coleccion SET slug = ?, nombre = ?, descripcion_md = ?, visible = ?, version = version + 1, actualizado = ?
              WHERE org_id = ? AND id = ? AND version = ? AND borrado IS NULL`,
          )
          .bind(
            slug,
            d.nombre,
            d.descripcionMd,
            d.visible ? 1 : 0,
            q.instante,
            q.org,
            id,
            actual.version,
          ),
        q.db.prepare(SI_CAMBIO),
      ]
    : [
        q.db
          .prepare(
            `INSERT INTO coleccion (org_id, id, slug, nombre, descripcion_md, visible, posicion, actualizado)
             VALUES (?, ?, ?, ?, ?, ?, (SELECT coalesce(max(posicion), -1) + 1 FROM coleccion WHERE org_id = ?), ?)`,
          )
          .bind(q.org, id, slug, d.nombre, d.descripcionMd, d.visible ? 1 : 0, q.org, q.instante),
      ];
  lote.push(
    q.db
      .prepare('DELETE FROM coleccion_producto WHERE org_id = ? AND coleccion_id = ?')
      .bind(q.org, id),
  );
  for (const [i, p] of productos.entries()) {
    lote.push(
      q.db
        .prepare(
          'INSERT INTO coleccion_producto (org_id, coleccion_id, producto_id, posicion) VALUES (?, ?, ?, ?)',
        )
        .bind(q.org, id, p, i),
    );
  }
  lote.push(
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: actual ? 'coleccion.editar' : 'coleccion.crear',
      entidad: 'coleccion',
      entidadId: id,
      antes: actual ? { nombre: actual.nombre, slug: actual.slug } : null,
      despues: { nombre: d.nombre, slug, productos: productos.length },
      instante: q.instante,
    }),
    guardarOperacion(q, d.op, 'colecciones/guardar', r),
  );
  return aplicar(q, d.op, lote, r, versionDe(q, 'coleccion', id));
}

export async function ordenarLasColecciones(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = esquemaOrdenar.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const previa = await yaAplicada(q, r0.data.op);
  if (previa) return previa;
  const r: Resultado = { estado: 'guardado', id: 'colecciones', version: 1 };
  return aplicar(
    q,
    r0.data.op,
    [
      ...r0.data.ids.map((id, i) =>
        q.db
          .prepare('UPDATE coleccion SET posicion = ?, actualizado = ? WHERE org_id = ? AND id = ?')
          .bind(i, q.instante, q.org, id),
      ),
      await anotar(q.db, {
        org: q.org,
        actor: q.actor,
        accion: 'colecciones.ordenar',
        entidad: 'coleccion',
        entidadId: null,
        antes: null,
        despues: { orden: r0.data.ids },
        instante: q.instante,
      }),
      guardarOperacion(q, r0.data.op, 'colecciones/ordenar', r),
    ],
    r,
    async () => null,
  );
}

/** Borrar una colección no borra sus productos (CA2): solo la colección y sus vínculos. */
export async function borrarLaColeccion(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = esquemaBorrarColeccion.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const actual = await q.db
    .prepare(
      'SELECT id, slug, nombre, version FROM coleccion WHERE org_id = ? AND id = ? AND borrado IS NULL',
    )
    .bind(q.org, d.id)
    .first<{ id: string; slug: string; nombre: string; version: number }>();
  if (!actual) return { estado: 'no-existe', motivo: MOTIVO_NO_EXISTE };
  if (actual.version !== d.version)
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: actual.version };
  const r: Resultado = { estado: 'guardado', id: d.id, version: actual.version + 1 };
  return aplicar(
    q,
    d.op,
    [
      q.db
        .prepare(
          'UPDATE coleccion SET borrado = ?, version = version + 1, actualizado = ? WHERE org_id = ? AND id = ? AND version = ? AND borrado IS NULL',
        )
        .bind(q.instante, q.instante, q.org, d.id, actual.version),
      q.db.prepare(SI_CAMBIO),
      q.db
        .prepare('DELETE FROM coleccion_producto WHERE org_id = ? AND coleccion_id = ?')
        .bind(q.org, d.id),
      await anotar(q.db, {
        org: q.org,
        actor: q.actor,
        accion: 'coleccion.borrar',
        entidad: 'coleccion',
        entidadId: d.id,
        antes: { nombre: actual.nombre, slug: actual.slug },
        despues: null,
        instante: q.instante,
      }),
      guardarOperacion(q, d.op, 'colecciones/borrar', r),
    ],
    r,
    versionDe(q, 'coleccion', d.id),
  );
}

export type { GuardarProducto };
