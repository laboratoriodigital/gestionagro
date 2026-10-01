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
const riegoV1 = z
  .strictObject({
    unidad: z.enum(['mL_gotero', 'L_area']),
    volumenAplicado: medida('de volumen', 0.001, 1_000_000),
    volumenDrenado: medida('de volumen', 0, 1_000_000).nullable(),
    drenajePct: z.number().min(0).max(100).nullable(),
    ceEntradaDsM: medida('dS/m', 0, 10).nullable(),
    phEntrada: medida('de pH', 3, 10).nullable(),
    ceDrenajeDsM: medida('dS/m', 0, 10).nullable(),
    phDrenaje: medida('de pH', 3, 10).nullable(),
  })
  .superRefine((r, ctx) => {
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
  });

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

export const ESQUEMAS_DE_DATOS: Readonly<Record<string, Readonly<Record<number, z.ZodType>>>> = {
  clima: { 1: climaV1 },
  riego: { 1: riegoV1 },
  labor: { 1: laborV1 },
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
