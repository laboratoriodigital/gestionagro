/**
 * Validación de los contratos `product.yaml` (HU-E1.3) contra `schemas/product.schema.json`.
 * Los mensajes van en español y nombran el campo; se reportan todas las fallas juntas (P15).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020, type ErrorObject } from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import { listarArchivos, RAIZ } from './repo.ts';

export interface ErrorDeProducto {
  archivo: string;
  mensaje: string;
}

const esquema = JSON.parse(readFileSync(join(RAIZ, 'schemas', 'product.schema.json'), 'utf8'));
const validar = new Ajv2020({ allErrors: true, strict: true }).compile(esquema);

const campo = (e: ErrorObject, extra?: string): string => {
  const partes = e.instancePath.split('/').filter(Boolean);
  if (extra) partes.push(extra);
  return `«${partes.join('.') || '(raíz)'}»`;
};

function traducir(e: ErrorObject): string | null {
  const p = e.params as Record<string, unknown>;
  switch (e.keyword) {
    case 'required':
      return `falta el campo ${campo(e, String(p['missingProperty']))}`;
    case 'additionalProperties':
      return `el campo ${campo(e, String(p['additionalProperty']))} no existe en el contrato`;
    case 'enum':
      return `${campo(e)} debe ser uno de: ${(p['allowedValues'] as unknown[]).join(', ')}`;
    case 'const':
      return `${campo(e)} debe ser ${JSON.stringify(p['allowedValue'])}`;
    case 'type':
      return `${campo(e)} debe ser de tipo ${String(p['type'])}`;
    case 'pattern':
      return `${campo(e)} no cumple el formato ${String(p['pattern'])}`;
    case 'minLength':
      return `${campo(e)} debe tener al menos ${String(p['limit'])} caracteres`;
    case 'maxLength':
      return `${campo(e)} debe tener como máximo ${String(p['limit'])} caracteres`;
    case 'minimum':
      return `${campo(e)} debe ser ${String(p['limit'])} o más`;
    case 'exclusiveMinimum':
      return e.instancePath === '/presupuesto/api_requests_dia'
        ? `${campo(e)} debe ser mayor que 0 cuando runtime es api`
        : `${campo(e)} debe ser mayor que ${String(p['limit'])}`;
    case 'uniqueItems':
      return `${campo(e)} tiene elementos repetidos`;
    case 'not':
      return e.instancePath === '/revision_agronomica'
        ? `un producto en estado activo necesita ${campo(e)} aprobada, no pendiente`
        : `${campo(e)} tiene un valor no permitido`;
    case 'if':
      return null; // el detalle ya lo da el error de la rama «then»
    default:
      return `${campo(e)}: ${e.message ?? e.keyword}`;
  }
}

export function validarProducto(archivo: string, datos: unknown): ErrorDeProducto[] {
  if (validar(datos)) return [];
  return (validar.errors ?? [])
    .map(traducir)
    .filter((m): m is string => m !== null)
    .map((mensaje) => ({ archivo, mensaje }));
}

/** Reglas entre productos: ids únicos y `relacionados` que apuntan a productos existentes. */
export function validarConjunto(
  productos: ReadonlyArray<{ archivo: string; datos: { id?: unknown; relacionados?: unknown } }>,
): ErrorDeProducto[] {
  const errores: ErrorDeProducto[] = [];
  const ids = new Map<string, string>();
  for (const { archivo, datos } of productos) {
    if (typeof datos.id !== 'string') continue;
    const previo = ids.get(datos.id);
    if (previo) errores.push({ archivo, mensaje: `el id «${datos.id}» ya lo usa ${previo}` });
    else ids.set(datos.id, archivo);
  }
  for (const { archivo, datos } of productos) {
    if (!Array.isArray(datos.relacionados)) continue;
    for (const rel of datos.relacionados) {
      if (typeof rel === 'string' && !ids.has(rel)) {
        errores.push({
          archivo,
          mensaje: `«relacionados» nombra «${rel}», que no es un producto existente`,
        });
      }
    }
  }
  return errores;
}

/** Lee y valida una lista de archivos `product.yaml` (rutas relativas a `raiz`). */
export function validarArchivos(archivos: readonly string[], raiz = RAIZ): ErrorDeProducto[] {
  const errores: ErrorDeProducto[] = [];
  const leidos: { archivo: string; datos: Record<string, unknown> }[] = [];
  for (const archivo of archivos) {
    let datos: unknown;
    try {
      datos = parse(readFileSync(join(raiz, archivo), 'utf8'));
    } catch (e) {
      errores.push({ archivo, mensaje: `YAML ilegible: ${(e as Error).message}` });
      continue;
    }
    errores.push(...validarProducto(archivo, datos));
    if (typeof datos === 'object' && datos !== null) {
      leidos.push({ archivo, datos: datos as Record<string, unknown> });
    }
  }
  return [...errores, ...validarConjunto(leidos)];
}

/** Todos los `product.yaml` del repositorio. */
export const esContrato = (rel: string): boolean =>
  rel === 'product.yaml' || rel.endsWith('/product.yaml');

/** Contrato ya validado (forma de `schemas/product.schema.json`). */
export interface Producto {
  id: string;
  nombre: string;
  slug: string;
  tipo: 'utility' | 'saas';
  estado: 'borrador' | 'activo' | 'pausado' | 'retirado';
  peldano: string;
  siguiente_paso: string;
  runtime: 'browser' | 'api';
  seo: { title: string; description: string };
  relacionados: string[];
  eventos: string[];
  revision_agronomica: string;
  fuentes: string[];
  /** Carpeta del contrato, relativa a la raíz (p. ej. `content/agro/calculadora-dpv`). */
  carpeta: string;
}

/**
 * Lee y valida todos los contratos. Lanza con TODAS las fallas si alguno es inválido: un build
 * no publica páginas desde un contrato roto.
 */
export function cargarProductos(raiz = RAIZ): Producto[] {
  const archivos = listarArchivos(esContrato, raiz);
  const errores = validarArchivos(archivos, raiz);
  if (errores.length > 0) {
    throw new Error(
      `Contratos inválidos:\n${errores.map((e) => `- ${e.archivo}: ${e.mensaje}`).join('\n')}`,
    );
  }
  return archivos.map((archivo) => ({
    ...(parse(readFileSync(join(raiz, archivo), 'utf8')) as Omit<Producto, 'carpeta'>),
    carpeta: archivo.replace(/\/?product\.yaml$/, ''),
  }));
}
