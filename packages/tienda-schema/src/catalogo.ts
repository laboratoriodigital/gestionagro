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
  ivaPct: z
    .union([z.literal(0), z.literal(5), z.literal(19)])
    .nullable()
    .default(null),
});
export type GuardarProducto = z.infer<typeof guardarProducto>;

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
