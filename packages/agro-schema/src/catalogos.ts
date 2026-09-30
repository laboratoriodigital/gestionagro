/**
 * Catálogos v1: finca, área, ciclo, persona e insumo (ARQUITECTURA §5.7, HU-E3.2).
 * Nada nombra un cultivo: cultivo, variedad y tipos son datos, no código (ARQUITECTURA §2.2).
 */
import { z } from 'zod';
import { fechaAgronomica, id, medida, metaDeCatalogo, texto } from './comunes.ts';

export const finca = z.strictObject({
  ...metaDeCatalogo,
  nombre: texto,
  municipio: texto,
  regimen: z.enum(['ecologico', 'convencional']),
});

export const area = z.strictObject({
  ...metaDeCatalogo,
  finca_id: id,
  padre_id: id.nullable(),
  tipo: z.enum(['nave', 'bloque', 'lote', 'cama', 'surco']),
  nombre: texto,
  area_m2: medida('m²', 0.01, 10_000_000),
  /** Nulo = no se sabe; nunca 0 por defecto (P1). */
  capacidad_plantas: z.int().min(0).nullable(),
  activa: z.boolean(),
});

export const ciclo = z.strictObject({
  ...metaDeCatalogo,
  finca_id: id,
  area_ids: z.array(id).min(1, 'el ciclo necesita al menos un área'),
  cultivo: texto,
  variedad: texto,
  fecha_trasplante: fechaAgronomica,
  plantas: z.int().min(1).nullable(),
  estado: z.enum(['activo', 'cerrado']),
  fecha_fin: fechaAgronomica.nullable(),
});

export const persona = z.strictObject({
  ...metaDeCatalogo,
  finca_id: id,
  nombre: texto,
  rol: z.enum(['operario', 'supervisor', 'propietario', 'asesor']),
  usuario_id: id.nullable(),
  activa: z.boolean(),
});

export const insumo = z.strictObject({
  ...metaDeCatalogo,
  finca_id: id,
  nombre_comercial: texto,
  tipo: z.enum(['bioinsumo', 'fertilizante', 'fitosanitario', 'sustrato', 'otro']),
  registro_ica: z.string().trim().nullable(),
  ingrediente_activo: z.string().trim().nullable(),
  unidad: texto,
  /** Copiados de la etiqueta. Nulo = desconocido, que NO es cero (P1, HU-E3.6). */
  carencia_dias: z.int().min(0).nullable(),
  reentrada_horas: z.int().min(0).nullable(),
  permitido_ecologico: z.boolean().nullable(),
});

export type Finca = z.infer<typeof finca>;
export type Area = z.infer<typeof area>;
export type Ciclo = z.infer<typeof ciclo>;
export type Persona = z.infer<typeof persona>;
export type Insumo = z.infer<typeof insumo>;
