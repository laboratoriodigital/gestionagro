/**
 * El formato de carga y de exportación de una tienda: `tienda-import/1` = `tienda-export/1`
 * (TIENDA-3.0 §12.6 y §17.1, HU-T1.4). Es el mismo para que una tienda que se va se lleve lo que
 * necesita para volver (P2).
 *
 * - Idempotente por `refExterna`: cargar dos veces no duplica (lo aplica HU-T12.2).
 * - `revisarCarga` responde **todos** los problemas de una vez, sin escribir nada (P15).
 * - No lleva la sección `cobro` ni llaves: eso se entra en el panel, con entrada reciente.
 * - Los pedidos históricos no llevan datos personales (canal `carga`).
 */
import { z } from 'zod';
import { ESQUEMAS, type Problema } from './secciones.ts';

/** Topes de las opciones de un producto (TIENDA-3.0 §5.3 y §5.4). */
export const TOPES = { grupos: 3, valoresPorGrupo: 20, variantes: 100 } as const;

/** El id que la carga le da a un producto: lo usan la API al cargarlo y el script al subir sus fotos (HU-T12.3, P2). */
export const idDelProductoCargado = (refExterna: string) => `imp-p-${refExterna}`;

const ref = z
  .string()
  .regex(/^[A-Za-z0-9._-]{1,60}$/, 'una referencia externa sin espacios, de 1 a 60');
const slug = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, 'de 3 a 40 letras minúsculas, números o guiones')
  .refine((s) => !s.includes('--'), 'sin «--»: ese espacio es de la plataforma');
const nombre = z.string().trim().min(1).max(160);
const pesos = z.number().int('debe ser un número entero de pesos').min(0);

/**
 * HU-T18.11: en `sku`, `precioAntesCop` y `stock`, `undefined` es «el archivo no lo trae» y en una
 * combinación que ya existe no se toca; `null` lo quita (o, en `stock`, deja de contarlo).
 */
const variante = z.object({
  valores: z.array(z.string().trim().min(1).max(40)),
  sku: z.string().trim().min(1).max(60).nullable().optional(),
  precioCop: pesos.min(1, 'un precio de 0 no se carga: si es un regalo, se dice en el panel'),
  precioAntesCop: pesos.nullable().optional(),
  /** `null`: no se cuenta. Nunca se deduce de un vacío (bitácora ecommerce 54). */
  stock: z.number().int().min(0).nullable().optional(),
});

const producto = z.object({
  refExterna: ref,
  nombre,
  slug: slug.optional(),
  descripcionMd: z.string().max(20_000).optional(),
  // HU-T18.11: sin estado, uno nuevo nace en borrador y uno que existe queda como está.
  estado: z.enum(['borrador', 'activo', 'archivado']).optional(),
  opciones: z
    .array(
      z.object({
        nombre: z.string().trim().min(1).max(40),
        valores: z.array(z.string().trim().min(1).max(40)).min(1).max(TOPES.valoresPorGrupo),
      }),
    )
    .max(TOPES.grupos),
  variantes: z
    .array(variante)
    .min(1, 'todo producto tiene al menos una variante')
    .max(TOPES.variantes),
  medios: z
    .array(
      z.object({
        url: z.url({ protocol: /^https$/, error: 'una foto se carga desde una dirección https' }),
        alt: z.string().trim().min(1, 'toda foto lleva su texto alternativo').max(200),
        variante: z.array(z.string()).optional(),
      }),
    )
    .max(30)
    .default([]),
  colecciones: z.array(ref).default([]),
  // HU-T18.11: lo que no trae el archivo no se toca en un producto que ya existe; en uno nuevo vale
  // lo de siempre (retracto aplica, sin restricción de edad, IVA sin decir). Así una hoja con solo
  // precios e inventario no borra lo demás.
  retracto: z
    .union([
      z.object({ aplica: z.literal(true) }),
      z.object({ aplica: z.literal(false), motivo: z.string().trim().min(3).max(300) }),
    ])
    .optional(),
  soloMayores: z.boolean().optional(),
  ivaPct: z
    .union([z.literal(0), z.literal(5), z.literal(19)])
    .nullable()
    .optional(),
});

const linea = z.object({
  nombre,
  opciones: z.string().max(200).optional(),
  sku: z.string().max(60).optional(),
  precioCop: pesos,
  cantidad: z.number().int().min(1).max(200),
});

const pedidoHistorico = z.strictObject(
  {
    codigo: z
      .string()
      .regex(/^[0-9A-HJKMNP-TV-Z]{6}$/, '6 caracteres de Crockford, sin I, L, O ni U'),
    creado: z.iso.datetime(),
    estado: z.enum([
      'pendiente',
      'confirmado',
      'pagado',
      'despachado',
      'entregado',
      'cancelado',
      'devuelto',
    ]),
    formaPago: z.enum(['a_convenir', 'en_linea', 'contraentrega', 'transferencia', 'efectivo']),
    lineas: z.array(linea).min(1).max(30),
    totales: z.object({ subtotal: pesos, descuento: pesos, envio: pesos, total: pesos }),
  },
  { error: 'un pedido histórico no lleva datos personales ni otros campos' },
);

export const cargaTienda = z.object({
  formato: z.enum(['tienda-import/1', 'tienda-export/1']),
  tienda: z.object({ slug, nombre: z.string().trim().min(1).max(80) }),
  ajustes: z
    .strictObject(
      {
        identidad: ESQUEMAS.identidad[1],
        contacto: ESQUEMAS.contacto[1],
        apariencia: ESQUEMAS.apariencia[1],
        venta: ESQUEMAS.venta[1],
        legal: ESQUEMAS.legal[1],
        medicion: ESQUEMAS.medicion[1],
        agentes: ESQUEMAS.agentes[1],
        avisos: ESQUEMAS.avisos[1],
      },
      { error: 'la sección «cobro» y las llaves no se cargan: se entran en el panel' },
    )
    .partial(),
  colecciones: z.array(z.object({ refExterna: ref, nombre, slug })).default([]),
  productos: z.array(producto).default([]),
  envios: z
    .array(
      z.object({
        refExterna: ref,
        nombre,
        precioCop: pesos,
        gratisDesdeCop: pesos.nullable(),
        ciudades: z.array(z.string().trim().min(1)).nullable(),
        diasMin: z.number().int().min(0),
        diasMax: z.number().int().min(0),
      }),
    )
    .default([]),
  cupones: z
    .array(
      z.object({
        codigo: z.string().regex(/^[A-Z0-9]{3,30}$/, 'en mayúsculas, sin espacios'),
        tipo: z.enum(['porcentaje', 'valor', 'envio_gratis']),
        valor: z.number().int().min(0),
        minimoCop: pesos.default(0),
        usosMaximos: z.number().int().min(1).nullable(),
      }),
    )
    .default([]),
  paginas: z
    .array(z.object({ refExterna: ref, titulo: nombre, slug, md: z.string().max(50_000) }))
    .default([]),
  pedidos: z.array(pedidoHistorico).default([]),
});

export type CargaTienda = z.infer<typeof cargaTienda>;

function repetidos(valores: readonly string[]): string[] {
  const vistos = new Set<string>();
  const rep = new Set<string>();
  for (const v of valores) (vistos.has(v) ? rep : vistos).add(v);
  return [...rep];
}

/**
 * Revisa un archivo de carga sin escribir nada. Devuelve todos los problemas juntos: los de forma
 * (zod) y los que cruzan partes (referencias, variantes, precios), cada uno con su lugar.
 */
export function revisarCarga(
  json: unknown,
): { ok: true; carga: CargaTienda } | { ok: false; problemas: Problema[] } {
  const r = cargaTienda.safeParse(json);
  if (!r.success) {
    return {
      ok: false,
      problemas: r.error.issues.map((i) => ({
        campo: i.path.map(String).join('.'),
        mensaje: i.message,
      })),
    };
  }
  const c = r.data;
  const problemas: Problema[] = [];
  const colecciones = new Set(c.colecciones.map((x) => x.refExterna));

  for (const rep of repetidos(c.productos.map((p) => p.refExterna))) {
    problemas.push({ campo: 'productos', mensaje: `la referencia ${rep} está repetida` });
  }
  for (const rep of repetidos(
    c.productos.flatMap((p) => p.variantes.map((v) => v.sku ?? '')).filter(Boolean),
  )) {
    problemas.push({ campo: 'productos', mensaje: `el SKU ${rep} está repetido` });
  }
  for (const rep of repetidos(c.cupones.map((x) => x.codigo))) {
    problemas.push({ campo: 'cupones', mensaje: `el cupón ${rep} está repetido` });
  }

  c.productos.forEach((p, i) => {
    const lugar = `productos.${i} (${p.refExterna})`;
    const grupos = p.opciones.length;
    const claves = p.variantes.map((v) => v.valores.join(' / '));
    for (const rep of repetidos(claves)) {
      problemas.push({ campo: lugar, mensaje: `la combinación «${rep}» está repetida` });
    }
    p.variantes.forEach((v, j) => {
      if (v.valores.length !== grupos) {
        problemas.push({
          campo: `${lugar}.variantes.${j}`,
          mensaje: `tiene ${v.valores.length} valores y el producto ${grupos} grupos de opciones`,
        });
      } else {
        v.valores.forEach((valor, k) => {
          if (!p.opciones[k]?.valores.includes(valor)) {
            problemas.push({
              campo: `${lugar}.variantes.${j}`,
              mensaje: `«${valor}» no es un valor de «${p.opciones[k]?.nombre}»`,
            });
          }
        });
      }
      if (v.precioAntesCop != null && v.precioAntesCop <= v.precioCop) {
        problemas.push({
          campo: `${lugar}.variantes.${j}`,
          mensaje: 'el precio «antes» tiene que ser mayor que el precio',
        });
      }
    });
    for (const col of p.colecciones) {
      if (!colecciones.has(col)) {
        problemas.push({ campo: lugar, mensaje: `la colección ${col} no está en el archivo` });
      }
    }
  });

  c.envios.forEach((e, i) => {
    if (e.diasMin > e.diasMax) {
      problemas.push({ campo: `envios.${i}`, mensaje: 'los días mínimos pasan de los máximos' });
    }
  });
  c.cupones.forEach((x, i) => {
    if (x.tipo === 'porcentaje' && (x.valor < 1 || x.valor > 100)) {
      problemas.push({ campo: `cupones.${i}`, mensaje: 'un porcentaje va de 1 a 100' });
    }
  });
  c.pedidos.forEach((p, i) => {
    const t = p.totales;
    if (t.total !== t.subtotal - t.descuento + t.envio) {
      problemas.push({ campo: `pedidos.${i}`, mensaje: 'los totales no cuadran' });
    }
  });

  return problemas.length ? { ok: false, problemas } : { ok: true, carga: c };
}
