/**
 * Registros inmutables (ADR-4, ARQUITECTURA §5.7). Columnas comunes + `datos` validado por
 * tipo y versión. Corregir es escribir otro registro con `anula_id`; nadie borra.
 */
import { z } from 'zod';
import { fechaAgronomica, id, instante, medida, texto } from './comunes.ts';

export const registroBase = z.strictObject({
  id,
  org_id: id.nullable(),
  finca_id: id,
  area_ids: z.array(id),
  ciclo_id: id.nullable(),
  tipo: z.string().min(1),
  v: z.int().min(1),
  fecha_agronomica: fechaAgronomica,
  instante_evento: instante,
  autor_usuario_id: id.nullable(),
  persona_ids: z.array(id),
  dispositivo_id: z.string().min(1),
  origen: z.enum(['manual', 'tablero', 'dispositivo', 'importacion']),
  anula_id: id.nullable(),
  datos: z.unknown(),
});

/** `clima` v1: temperatura y humedad de la nave; el DPV se guarda y se puede recalcular (HU-E3.8). */
const climaV1 = z.strictObject({
  temperaturaC: medida('°C', -10, 60),
  humedadRelativaPct: medida('%', 0, 100),
  /** Nulo = no se midió la hoja. */
  temperaturaHojaC: medida('°C', -10, 60).nullable(),
  dpvKPa: z.number(),
});

/**
 * Esquemas de `datos` por tipo y versión. La API acepta todas las versiones que alguna app
 * publicada escribió (ADR-13): aquí no se borra una versión, se agrega la siguiente.
 */
/**
 * `riego` v1 (HU-E3.7): volumen aplicado y drenado en la misma unidad, y la solución de entrada y
 * de drenaje. Nulo = no medido, que no es 0 (P1). El % de drenaje lo calcula agro-calc.
 */
const camposRiegoV1 = {
  unidad: z.enum(['mL_gotero', 'L_area']),
  volumenAplicado: medida('de volumen', 0.001, 1_000_000),
  volumenDrenado: medida('de volumen', 0, 1_000_000).nullable(),
  drenajePct: z.number().min(0).max(100).nullable(),
  ceEntradaDsM: medida('dS/m', 0, 10).nullable(),
  phEntrada: medida('de pH', 3, 10).nullable(),
  ceDrenajeDsM: medida('dS/m', 0, 10).nullable(),
  phDrenaje: medida('de pH', 3, 10).nullable(),
};

function reglasDeRiego(
  r: { volumenAplicado: number; volumenDrenado: number | null; drenajePct: number | null },
  ctx: z.RefinementCtx,
) {
  if ((r.volumenDrenado === null) !== (r.drenajePct === null)) {
    ctx.addIssue({
      code: 'custom',
      path: ['drenajePct'],
      message: 'el % de drenaje va solo si se midió el drenaje',
    });
  }
  if (r.volumenDrenado !== null && r.volumenDrenado > r.volumenAplicado) {
    ctx.addIssue({
      code: 'custom',
      path: ['volumenDrenado'],
      message: 'no puede ser mayor que lo aplicado',
    });
  }
}

const riegoV1 = z.strictObject(camposRiegoV1).superRefine(reglasDeRiego);

/**
 * `riego` v2 (revisión del dueño, 1 oct 2026): v1 más la duración del riego en minutos.
 * Nulo = no se anotó, que no es 0 (P1).
 */
const riegoV2 = z
  .strictObject({ ...camposRiegoV1, duracionMin: medida('minutos', 0.1, 1440).nullable() })
  .superRefine(reglasDeRiego);

/**
 * `labor` v1 (HU-E3.9): qué labor y cuántas horas por persona, en medias horas. Las personas van
 * en `persona_ids` del registro base (modo tablero: sin cuenta).
 */
const laborV1 = z.strictObject({
  labor_id: id,
  labor: texto,
  horasPorPersona: medida('horas', 0.5, 24).refine(
    (h) => Number.isInteger(h * 2),
    'debe ir en medias horas (0,5; 1; 1,5…)',
  ),
});

/**
 * `aplicacion` v1 (HU-E3.10). La dosis es la de la etiqueta, como número y unidad tal como la
 * escribe la etiqueta: la app no sugiere dosis (CA2). Carencia y reentrada se copian del insumo
 * al aplicar; nulo = desconocida en la etiqueta, que bloquea, nunca 0 (CA4, P1). Quién aplicó va
 * en `persona_ids` del registro base.
 */
const aplicacionV1 = z.strictObject({
  insumo_id: id,
  insumo: texto,
  dosis: medida('de dosis', 0.0001, 1_000_000),
  dosisUnidad: texto,
  /** Litros de mezcla preparados; nulo = no se anotó. */
  volumenMezclaL: medida('L', 0.01, 1_000_000).nullable(),
  /** Bomba de espalda, estacionaria…; nulo = no se anotó. */
  equipo: z.string().trim().min(1).nullable(),
  carenciaDias: z.int().min(0).max(365).nullable(),
  reentradaHoras: z
    .int()
    .min(0)
    .max(24 * 365)
    .nullable(),
});

/**
 * `aplicacion` v2 (HU-E7.1): v1 más la cantidad del producto que se gastó, en la unidad del
 * insumo. De ella sale la salida de bodega: no hay un registro de salida aparte (P2), y corregir la
 * aplicación corrige la bodega. Nulo = no se anotó, que no es 0 (P1).
 */
const aplicacionV2 = aplicacionV1.extend({
  cantidadUsada: medida('de cantidad usada', 0.0001, 1_000_000).nullable(),
});

/**
 * `movimiento_insumo` v1 (HU-E7.1, ARQUITECTURA §5.7): una entrada a bodega (compra, con su
 * precio total en pesos o nulo si no se anotó) o un ajuste de inventario (cantidad con signo, sin
 * precio). Las salidas salen de las aplicaciones.
 */
const movimientoInsumoV1 = z
  .strictObject({
    insumo_id: id,
    insumo: texto,
    clase: z.enum(['compra', 'ajuste']),
    cantidad: z.number().refine((x) => Number.isFinite(x) && x !== 0, 'no puede ser 0'),
    unidad: texto,
    precio_total_cop: z.int('debe ser un valor entero en pesos').min(1).nullable(),
    nota: z.string().trim().max(280).nullable(),
  })
  .superRefine((m, ctx) => {
    if (m.clase === 'compra' && m.cantidad <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['cantidad'],
        message: 'una compra suma: debe ser mayor que 0',
      });
    }
    if (m.clase === 'ajuste' && m.precio_total_cop !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['precio_total_cop'],
        message: 'un ajuste no lleva precio',
      });
    }
  });

/**
 * `cosecha` v1 (HU-E6.1): cantidad en la unidad del cultivo (kg, tallos, cajas…), categoría de
 * calidad del catálogo y descarte en la misma unidad (nulo = no se anotó, que no es 0, P1).
 * Si el área estaba en carencia y se cosechó de todas formas, la confirmación queda aquí con lo
 * que la app mostró (CA2): nunca se pierde que se cosechó dentro del periodo.
 */
const cosechaV1 = z
  .strictObject({
    cantidad: medida('de cantidad', 0.001, 1_000_000),
    unidad: texto,
    categoria_id: id,
    categoria: texto,
    descarte: medida('de cantidad', 0, 1_000_000).nullable(),
    carenciaConfirmada: z
      .strictObject({
        tipo: z.enum(['hasta', 'desconocida']),
        /** Primer día en que se podía cosechar; nulo si la carencia era desconocida. */
        hasta: fechaAgronomica.nullable(),
        insumos: z.array(texto).min(1),
      })
      .nullable(),
  })
  .superRefine((c, ctx) => {
    const k = c.carenciaConfirmada;
    if (k && (k.tipo === 'hasta') !== (k.hasta !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['carenciaConfirmada', 'hasta'],
        message: 'la fecha va solo si la carencia era conocida',
      });
    }
  });

/**
 * `lote_venta` v1 (HU-E6.2): cosechas enteras agrupadas para despacharlas, con un código corto
 * que se lee en voz alta (`T-27MAR-2`: inicial del cultivo, día, mes en letras, consecutivo; los
 * primeros lotes de staging usaban `T-2703-2` y siguen siendo válidos). La cantidad es
 * lo vendible: lo cosechado menos el descarte. Una cosecha va en un solo lote.
 */
const loteVentaV1 = z.strictObject({
  codigo: z.string().regex(/^[A-Z]-(?:\d{2}[A-Z]{3}|\d{4})-\d+$/, 'debe tener la forma T-27MAR-2'),
  cosecha_ids: z.array(id).min(1, 'debe tener al menos una cosecha'),
  cantidad: medida('de cantidad', 0.001, 100_000_000),
  unidad: texto,
  cultivo: texto.nullable(),
});

/**
 * `monitoreo` v1 (HU-E3.11): lo que se vio en trampas y plantas, para actuar a tiempo y como
 * evidencia del manejo integrado. La foto, si hay, vive en el teléfono (`foto_id`): el registro
 * nunca lleva la imagen.
 */
const monitoreoV1 = z.strictObject({
  plaga: texto,
  clase: z.enum(['plaga', 'enfermedad']),
  metodo: z.enum(['trampa', 'conteo', 'observacion']),
  nivel: z.enum(['bajo', 'medio', 'alto']),
  /** Individuos en la trampa o contados; nulo si se observó sin contar. */
  cantidad: z.int('debe ser un número entero').min(0).max(1_000_000).nullable(),
  foto_id: id.nullable(),
  nota: z.string().trim().max(280, 'la nota es de máximo 280 letras').nullable(),
});

export const TIPOS_DE_CLIENTE = ['consumidor', 'restaurante', 'tienda', 'cadena'] as const;
export const MEDIOS_DE_PAGO = ['efectivo', 'transferencia', 'credito', 'otro'] as const;

/**
 * `despacho` v1 (HU-E6.3): a quién se vendió, de qué lotes, cuánto y a qué precio. El cliente va
 * dentro del despacho (nombre y tipo), sin datos de contacto: la app sugiere los ya usados.
 * Precio nulo = no se anotó; nunca cero (P1).
 */
const despachoV1 = z.strictObject({
  cliente: z.strictObject({ nombre: texto, tipo: z.enum(TIPOS_DE_CLIENTE) }),
  lineas: z
    .array(
      z.strictObject({
        lote_id: id,
        codigo: texto,
        cantidad: medida('de cantidad', 0.001, 100_000_000),
      }),
    )
    .min(1, 'debe tener al menos un lote'),
  unidad: texto,
  precio_unitario_cop: z
    .int('debe ser un valor entero en pesos')
    .min(1, 'debe ser mayor que 0')
    .nullable(),
  medio_pago: z.enum(MEDIOS_DE_PAGO),
});

export const ESQUEMAS_DE_DATOS: Readonly<Record<string, Readonly<Record<number, z.ZodType>>>> = {
  clima: { 1: climaV1 },
  riego: { 1: riegoV1, 2: riegoV2 },
  labor: { 1: laborV1 },
  aplicacion: { 1: aplicacionV1, 2: aplicacionV2 },
  cosecha: { 1: cosechaV1 },
  lote_venta: { 1: loteVentaV1 },
  despacho: { 1: despachoV1 },
  monitoreo: { 1: monitoreoV1 },
  movimiento_insumo: { 1: movimientoInsumoV1 },
};

export type Registro = z.infer<typeof registroBase>;

/** Datos que no cumplen su esquema. Nombra cada campo con su motivo (P1). */
export class ErrorDeValidacion extends Error {
  override readonly name: string = 'ErrorDeValidacion';
  /** Campos con problema, con su ruta (`datos.temperaturaC`) y el motivo. */
  readonly campos: ReadonlyArray<{ campo: string; motivo: string }>;

  constructor(entidad: string, campos: ReadonlyArray<{ campo: string; motivo: string }>) {
    super(`${entidad} inválido: ${campos.map((c) => `«${c.campo}» ${c.motivo}`).join('; ')}`);
    this.campos = campos;
  }
}

export class ErrorDeRegistro extends ErrorDeValidacion {
  override readonly name = 'ErrorDeRegistro';
  constructor(campos: ReadonlyArray<{ campo: string; motivo: string }>) {
    super('Registro', campos);
  }
}

const aCampos = (error: z.ZodError, prefijo: string) =>
  error.issues.map((i) => ({
    campo: [prefijo, ...i.path.map(String)].filter(Boolean).join('.') || '(registro)',
    motivo: i.message,
  }));

/** Valida columnas comunes y `datos` según su tipo y versión. Lanza ErrorDeRegistro. */
export function validarRegistro(entrada: unknown): Registro {
  const base = registroBase.safeParse(entrada);
  if (!base.success) throw new ErrorDeRegistro(aCampos(base.error, ''));
  const esquema = ESQUEMAS_DE_DATOS[base.data.tipo]?.[base.data.v];
  if (!esquema) {
    throw new ErrorDeRegistro([
      { campo: 'tipo', motivo: `no hay esquema para «${base.data.tipo}» versión ${base.data.v}` },
    ]);
  }
  const datos = esquema.safeParse(base.data.datos);
  if (!datos.success) throw new ErrorDeRegistro(aCampos(datos.error, 'datos'));
  return { ...base.data, datos: datos.data };
}

/** Valida un catálogo (finca, área…) contra su esquema. Lanza ErrorDeValidacion con los campos. */
export function validarCatalogo<T>(entidad: string, esquema: z.ZodType<T>, entrada: unknown): T {
  const r = esquema.safeParse(entrada);
  if (!r.success) throw new ErrorDeValidacion(entidad, aCampos(r.error, ''));
  return r.data;
}
