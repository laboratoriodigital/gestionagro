/**
 * Formato `agro-export` v1 (HU-E3.13): todo el cuaderno de un teléfono en un archivo JSON.
 * Es la misma fuente para el respaldo, la mudanza entre teléfonos y, más adelante, la
 * exportación del servidor (P2). `schemas/agro-export.schema.json` se genera desde aquí.
 *
 * Cada tabla trae su recuento y el SHA-256 de sus filas en forma canónica: un archivo cortado
 * o editado a mano se detecta antes de escribir nada (P21).
 */
import { z } from 'zod';
import {
  area,
  ciclo,
  cultivo,
  finca,
  insumo,
  persona,
  tipoLabor,
  valorJornal,
} from './catalogos.ts';
import { id, instante } from './comunes.ts';
import { registroBase } from './registro.ts';

/** Versión anterior de un catálogo (HU-E3.3): se exporta para no perder la traza. */
export const versionAnterior = z.strictObject({
  id,
  entidad: z.string().min(1),
  entidad_id: id,
  version: z.int().min(1),
  datos: z.unknown(),
  reemplazada: instante,
});

const tabla = <T extends z.ZodType>(fila: T) =>
  z.strictObject({
    recuento: z.int().min(0),
    hash: z.string().regex(/^[0-9a-f]{64}$/, 'debe ser un SHA-256 en hexadecimal'),
    filas: z.array(fila),
  });

/** Esquema de cada fila por tabla. El orden es el de escritura al importar. */
export const FILAS_EXPORTADAS = {
  finca,
  area,
  cultivo,
  ciclo,
  persona,
  valor_jornal: valorJornal,
  insumo,
  tipo_labor: tipoLabor,
  registro: registroBase,
  historial: versionAnterior,
} as const;

export type TablaExportada = keyof typeof FILAS_EXPORTADAS;
export const TABLAS_EXPORTADAS = Object.keys(FILAS_EXPORTADAS) as TablaExportada[];

export const agroExportV1 = z.strictObject({
  formato: z.literal('agro-export'),
  version: z.literal(1),
  generado: instante,
  /** Versión de la app que lo escribió. */
  app: z.string().min(1),
  finca_id: id,
  tablas: z.strictObject({
    finca: tabla(finca),
    area: tabla(area),
    cultivo: tabla(cultivo),
    ciclo: tabla(ciclo),
    persona: tabla(persona),
    valor_jornal: tabla(valorJornal),
    insumo: tabla(insumo),
    tipo_labor: tabla(tipoLabor),
    registro: tabla(registroBase),
    historial: tabla(versionAnterior),
  }),
});

export type AgroExportV1 = z.infer<typeof agroExportV1>;

/** JSON con las claves ordenadas a todo nivel: el mismo dato da siempre el mismo texto. */
export function jsonCanonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`;
  if (valor !== null && typeof valor === 'object') {
    const claves = Object.keys(valor)
      .filter((k) => (valor as Record<string, unknown>)[k] !== undefined)
      .sort();
    return `{${claves.map((k) => `${JSON.stringify(k)}:${jsonCanonico((valor as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(valor);
}

/** SHA-256 de las filas ordenadas por id, en forma canónica. No depende del orden de lectura. */
export async function hashDeFilas(filas: readonly { id: string }[]): Promise<string> {
  const ordenadas = [...filas].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const bytes = new TextEncoder().encode(jsonCanonico(ordenadas));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** JSON Schema del formato, para `schemas/agro-export.schema.json` (lo genera un script). */
export function esquemaJsonExport(): Record<string, unknown> {
  return z.toJSONSchema(agroExportV1, { unrepresentable: 'any' }) as Record<string, unknown>;
}
