/**
 * Lectura y validación de `infrastructure/productos.json` (HU-C1.1, PLATAFORMA §4.2).
 *
 * Se llama «registro» para no confundirlo con `productos.ts`, que valida los `product.yaml` de
 * las herramientas (HU-E1.3): son dos cosas distintas que ED1 llama igual. El esquema JSON dice
 * la forma; `@ed1/productos` dice las reglas que el esquema no puede decir.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fallasDelRegistro, type RegistroDeProductos } from '@ed1/productos';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { PlanDelArchivo, ProductoDelCatalogo } from '../../apps/core/src/catalogo.ts';
import { RAIZ } from './repo.ts';

const leerJson = (ruta: string) => JSON.parse(readFileSync(join(RAIZ, ruta), 'utf8'));

/** Todas las fallas del registro, de forma y de reglas, a la vez (P15). */
export function fallasDeProductos(
  datos: unknown,
  existe: (ruta: string) => boolean = (r) => existsSync(join(RAIZ, r)),
): string[] {
  const validar = new Ajv2020({ allErrors: true, strict: true }).compile(
    leerJson('schemas/productos.schema.json'),
  );
  if (!validar(datos)) {
    return (validar.errors ?? []).map((e) => `${e.instancePath || '(raíz)'} ${e.message}`);
  }
  return fallasDelRegistro(datos as RegistroDeProductos, existe);
}

/** Lee y valida el registro; lanza con todas las fallas. */
export function cargarProductos(
  datos: unknown = leerJson('infrastructure/productos.json'),
): RegistroDeProductos {
  const fallas = fallasDeProductos(datos);
  if (fallas.length > 0) throw new Error(`productos.json inválido:\n- ${fallas.join('\n- ')}`);
  return datos as RegistroDeProductos;
}

/**
 * El catálogo que el despliegue escribe en la base del CORE (HU-C2.3): cada producto del registro
 * con los planes de su `planes.json`. La fuente sigue siendo el archivo (P2).
 */
export function catalogoDelRepositorio(
  registro: RegistroDeProductos = cargarProductos(),
): ProductoDelCatalogo[] {
  return registro.productos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    estado: p.estado,
    tipos: p.tipos,
    roles: p.roles,
    planes: (leerJson(p.planes) as { planes: PlanDelArchivo[] }).planes.map((plan) => ({
      id: plan.id,
      nombre: plan.nombre,
      ...(plan.gratuito === undefined ? {} : { gratuito: plan.gratuito }),
      ...(plan.cobro === undefined ? {} : { cobro: plan.cobro }),
    })),
  }));
}
