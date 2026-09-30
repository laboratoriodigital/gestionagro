/**
 * Registros inmutables (ADR-4, ARQUITECTURA §5.7). Columnas comunes + `datos` validado por
 * tipo y versión. Corregir es escribir otro registro con `anula_id`; nadie borra.
 */
import { z } from 'zod';
import { fechaAgronomica, id, instante, medida } from './comunes.ts';

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
export const ESQUEMAS_DE_DATOS: Readonly<Record<string, Readonly<Record<number, z.ZodType>>>> = {
  clima: { 1: climaV1 },
};

export type Registro = z.infer<typeof registroBase>;

export class ErrorDeRegistro extends Error {
  override readonly name = 'ErrorDeRegistro';
  /** Campos con problema, con su ruta (`datos.temperaturaC`) y el motivo. */
  readonly campos: ReadonlyArray<{ campo: string; motivo: string }>;

  constructor(campos: ReadonlyArray<{ campo: string; motivo: string }>) {
    super(`Registro inválido: ${campos.map((c) => `«${c.campo}» ${c.motivo}`).join('; ')}`);
    this.campos = campos;
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
