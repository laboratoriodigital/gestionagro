/**
 * Lo que el panel manda para guardar el catálogo (HU-T8.2 y HU-T8.4, TIENDA-3.0 §5.3, §12.4 y
 * §13.3). Lo valida la API, que responde todos los problemas juntos con su campo (P15).
 *
 * - Un producto se guarda entero, con todas sus combinaciones: así las opciones y las variantes
 *   nunca quedan a medias (cambiar los colores y sus precios es una sola escritura).
 * - Toda escritura lleva `op` (repetirla no aplica dos veces) y, si edita, la `version` que leyó.
 * - CA4: un precio vacío o ilegible no llega como 0, y un stock vacío no es «no se cuenta»: el
 *   comercio lo elige con `null` a propósito (bitácora ecommerce 54).
 */
import { z } from 'zod';
import { TOPES } from './carga.ts';

const op = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'la clave de la operación va de 8 a 64');
const version = z.number().int().min(1);
const id = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
export const slugDeCatalogo = z
  .string()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/,
    'letras minúsculas, números y guiones, sin tildes',
  )
  .refine((s) => !s.includes('--'), 'sin «--»');
const texto = (max: number) => z.string().trim().min(1, 'no puede quedar vacío').max(max);
const valor = texto(40);

/** Un precio en pesos enteros, mayor que 0. Lo vacío o ilegible es un error, nunca 0 (CA4). */
const precio = z
  .number({ error: 'escribe el precio en pesos' })
  .int('el precio va en pesos enteros, sin centavos')
  .min(1, 'un precio de 0 no se guarda');

export const varianteDelPanel = z.object({
  valores: z.array(valor),
  sku: z.string().trim().min(1).max(60).nullable().default(null),
  precioCop: precio,
  precioAntesCop: precio.nullable().default(null),
  /** `null` solo si el comercio eligió «no se cuenta». Sin el campo, es un error (CA4). */
  stock: z
    .number({ error: 'di cuántas hay, o marca «no se cuenta»' })
    .int('las existencias van en unidades enteras')
    .min(0, 'las existencias no pueden ser negativas')
    .nullable(),
});
export type VarianteDelPanel = z.infer<typeof varianteDelPanel>;

/**
 * HU-P1.2 (sprint PF1): la promoción por cantidad de un producto. `hasta` es el último día de la
 * promoción, de Colombia (`AAAA-MM-DD`); sin él, no vence. La cuenta la hace `@ed1/dinero`.
 */
export const promocionDelProducto = z
  .discriminatedUnion('tipo', [
    z.object({
      tipo: z.literal('porcentaje'),
      porcentaje: z.number().int().min(1, 'desde el 1 %').max(90, 'hasta el 90 %'),
      desdeUnidades: z.number().int().min(2, 'desde 2 unidades').max(200),
      hasta: z.iso.date('una fecha AAAA-MM-DD').nullable().default(null),
    }),
    z.object({
      tipo: z.literal('regalo'),
      lleva: z.number().int().min(2, 'lleva al menos 2').max(20, 'hasta 20'),
      paga: z.number().int().min(1, 'paga al menos 1'),
      hasta: z.iso.date('una fecha AAAA-MM-DD').nullable().default(null),
    }),
  ])
  .superRefine((p, ctx) => {
    if (p.tipo === 'regalo' && p.paga >= p.lleva) {
      ctx.addIssue({ code: 'custom', path: ['paga'], message: 'paga menos de las que lleva' });
    }
  });
export type PromocionDelProducto = z.infer<typeof promocionDelProducto>;

/** Si la promoción sigue vigente en ese instante: hasta el final de su último día en Colombia. */
export const promocionVigente = (p: PromocionDelProducto, ahora: string): boolean =>
  p.hasta === null || Date.parse(ahora) <= Date.parse(`${p.hasta}T23:59:59.999-05:00`);

/** La promoción como se lee en la ficha: «Lleva 3, paga 2» o «10 % menos desde 2 unidades». */
export function promocionEnPalabras(p: PromocionDelProducto): string {
  return p.tipo === 'regalo'
    ? `Lleva ${p.lleva}, paga ${p.paga}`
    : `${p.porcentaje} % menos desde ${p.desdeUnidades} unidades`;
}

export const ESTADOS_DE_PRODUCTO = ['borrador', 'activo', 'archivado'] as const;

export const guardarProducto = z.object({
  op,
  /** Sin `id`, se crea. */
  id: id.optional(),
  version: version.optional(),
  nombre: texto(140),
  /** Sin `slug`, sale del nombre. Cambiarlo deja una redirección desde el anterior (CA3). */
  slug: slugDeCatalogo.optional(),
  descripcionMd: z.string().max(20_000).default(''),
  estado: z.enum(ESTADOS_DE_PRODUCTO).default('borrador'),
  opciones: z
    .array(
      z.object({
        nombre: texto(40),
        valores: z.array(valor).min(1).max(TOPES.valoresPorGrupo),
      }),
    )
    .max(TOPES.grupos, `hasta ${TOPES.grupos} grupos de opciones`),
  variantes: z
    .array(varianteDelPanel)
    .min(1, 'todo producto tiene al menos una combinación')
    .max(TOPES.variantes, `hasta ${TOPES.variantes} combinaciones`),
  retracto: z
    .union([
      z.object({ aplica: z.literal(true) }),
      z.object({ aplica: z.literal(false), motivo: z.string().trim().min(3).max(300) }),
    ])
    .default({ aplica: true }),
  soloMayores: z.boolean().default(false),
  /** HU-T5.10: lo destacado va primero en la portada; lo nuevo lleva su etiqueta. */
  destacado: z.boolean().default(false),
  nuevo: z.boolean().default(false),
  promocion: promocionDelProducto.nullable().default(null),
  /** HU-P6.1: un archivo que se descarga al pagar; no cuenta existencias ni pide envío. */
  tipo: z.enum(['fisico', 'digital']).default('fisico'),
  ivaPct: z
    .union([z.literal(0), z.literal(5), z.literal(19)])
    .nullable()
    .default(null),
});
export type GuardarProducto = z.infer<typeof guardarProducto>;

/** HU-P3.1: cuántos productos cambia un lote; cabe en una consulta con sus parámetros (D1: 100). */
export const PRODUCTOS_POR_LOTE = 80;

/**
 * HU-P3.1 (sprint PF1): cambiar varios productos a la vez, elegidos uno por uno o por su categoría.
 * `vistaPrevia` dice qué cambiaría sin escribir nada.
 */
export const cambioEnLote = z
  .object({
    op,
    ids: z
      .array(id)
      .min(1)
      .max(PRODUCTOS_POR_LOTE, `hasta ${PRODUCTOS_POR_LOTE} productos a la vez`)
      .optional(),
    coleccion: id.optional(),
    cambio: z.discriminatedUnion('tipo', [
      z.object({
        tipo: z.literal('precio'),
        modo: z.enum(['porcentaje', 'valor']),
        /** Más o menos: `5` sube el 5 % (o $5); `-10` baja. */
        cantidad: z
          .number({ error: 'escribe cuánto cambia el precio' })
          .int('sin decimales')
          .refine((n) => n !== 0, 'un cambio de 0 no cambia nada'),
      }),
      z.object({ tipo: z.literal('estado'), estado: z.enum(ESTADOS_DE_PRODUCTO) }),
      z.object({ tipo: z.literal('papelera') }),
      z.object({ tipo: z.literal('promocion'), promocion: promocionDelProducto.nullable() }),
    ]),
    vistaPrevia: z.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    if ((d.ids === undefined) === (d.coleccion === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['ids'], message: 'elige productos o una categoría' });
    }
    const k = d.cambio;
    if (k.tipo === 'precio' && k.modo === 'porcentaje' && (k.cantidad < -90 || k.cantidad > 300)) {
      ctx.addIssue({
        code: 'custom',
        path: ['cambio', 'cantidad'],
        message: 'entre −90 % y 300 %',
      });
    }
    if (k.tipo === 'precio' && k.modo === 'valor' && Math.abs(k.cantidad) > 10_000_000) {
      ctx.addIssue({ code: 'custom', path: ['cambio', 'cantidad'], message: 'hasta $10.000.000' });
    }
  });
export type CambioEnLote = z.infer<typeof cambioEnLote>;

/**
 * El precio nuevo de un cambio en lote: el porcentaje se redondea al peso más cercano y nunca baja
 * de $1. La misma cuenta la hace la base al aplicar (`lote-de-productos.ts`): una prueba las ata.
 */
export function precioDelLote(
  actual: number,
  modo: 'porcentaje' | 'valor',
  cantidad: number,
): number {
  const nuevo =
    modo === 'porcentaje' ? Math.floor((actual * (100 + cantidad) + 50) / 100) : actual + cantidad;
  return Math.max(1, nuevo);
}

export const cambiarEstadoDeProducto = z.object({
  op,
  id,
  version,
  estado: z.enum(ESTADOS_DE_PRODUCTO),
});
export const tocarProducto = z.object({ op, id, version });

export const guardarColeccion = z.object({
  op,
  id: id.optional(),
  version: version.optional(),
  nombre: texto(80),
  slug: slugDeCatalogo.optional(),
  descripcionMd: z.string().max(5_000).default(''),
  visible: z.boolean().default(true),
  /** Los productos en su orden; un producto puede estar en varias colecciones (HU-T8.4 CA1). */
  productos: z.array(id).max(500).default([]),
});
export const ordenarColecciones = z.object({ op, ids: z.array(id).min(1).max(200) });
export const borrarColeccion = z.object({ op, id, version });

type Problema = { campo: string; mensaje: string };

/** Los problemas de una petición del catálogo: los de forma y los que cruzan campos, todos juntos. */
export function revisarProducto(
  json: unknown,
): { ok: true; datos: GuardarProducto } | { ok: false; problemas: Problema[] } {
  const r = guardarProducto.safeParse(json);
  if (!r.success) {
    return {
      ok: false,
      problemas: r.error.issues.map((i) => ({
        campo: i.path.map(String).join('.'),
        mensaje: i.message,
      })),
    };
  }
  const p = r.data;
  // HU-P6.1: un producto digital no se agota: sus combinaciones no cuentan existencias.
  if (p.tipo === 'digital') p.variantes = p.variantes.map((v) => ({ ...v, stock: null }));
  const problemas: Problema[] = [];
  if (p.id && p.version === undefined) {
    problemas.push({ campo: 'version', mensaje: 'falta la versión que leíste' });
  }
  const grupos = p.opciones.length;
  const nombres = new Set<string>();
  p.opciones.forEach((o, i) => {
    if (nombres.has(o.nombre))
      problemas.push({ campo: `opciones.${i}.nombre`, mensaje: `«${o.nombre}» está repetido` });
    nombres.add(o.nombre);
    if (new Set(o.valores).size !== o.valores.length) {
      problemas.push({ campo: `opciones.${i}.valores`, mensaje: 'hay un valor repetido' });
    }
  });
  const claves = new Set<string>();
  p.variantes.forEach((v, j) => {
    const lugar = `variantes.${j}`;
    if (v.valores.length !== grupos) {
      problemas.push({
        campo: lugar,
        mensaje: `tiene ${v.valores.length} valores y el producto ${grupos} grupos de opciones`,
      });
    } else {
      v.valores.forEach((x, k) => {
        if (!p.opciones[k]?.valores.includes(x)) {
          problemas.push({
            campo: lugar,
            mensaje: `«${x}» no es un valor de «${p.opciones[k]?.nombre}»`,
          });
        }
      });
    }
    const clave = v.valores.join('|');
    if (claves.has(clave))
      problemas.push({
        campo: lugar,
        mensaje: `la combinación «${v.valores.join(' / ')}» está repetida`,
      });
    claves.add(clave);
    if (v.precioAntesCop !== null && v.precioAntesCop <= v.precioCop) {
      problemas.push({
        campo: `${lugar}.precioAntesCop`,
        mensaje: 'el precio «antes» tiene que ser mayor que el precio',
      });
    }
  });
  return problemas.length > 0 ? { ok: false, problemas } : { ok: true, datos: p };
}
