/**
 * Piezas comunes de los esquemas. Regla de P1: **ningún campo de medida tiene `default`**.
 * Vacío, texto o NaN son error y el error nombra el campo; «no medido» se escribe `null`,
 * nunca 0.
 */
import { z } from 'zod';

z.config(z.locales.es());

export const id = z.uuid({ version: 'v7', error: 'debe ser un UUIDv7' });

/** Día local de la finca, `YYYY-MM-DD`, que además existe en el calendario. */
export const fechaAgronomica = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'debe tener el formato AAAA-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'no es una fecha que exista');

/** Instante UTC en ISO 8601 con zona (`…Z`). */
export const instante = z.iso.datetime({ error: 'debe ser un instante ISO 8601 en UTC' });

/**
 * Número medido en campo: finito y dentro de [min, max]. Sin `default` ni coerción: el texto
 * «24,5» lo convierte el formulario, no el esquema (P1).
 */
export function medida(unidad: string, min: number, max: number) {
  return z
    .number({
      error: (issue) =>
        issue.input === undefined ? 'falta el valor' : `debe ser un número en ${unidad}`,
    })
    .min(min, `debe ser ${min} ${unidad} o más`)
    .max(max, `debe ser ${max} ${unidad} o menos`);
}

export const texto = z.string().trim().min(1, 'no puede estar vacío');

/** Metadatos de un catálogo: última escritura gana, con historial (ADR-4). */
export const metaDeCatalogo = {
  id,
  /** Nulo mientras la finca vive solo en el teléfono; se llena al reclamarla (HU-E4.3). */
  org_id: id.nullable(),
  version: z.int().min(1),
  actualizado: instante,
};
