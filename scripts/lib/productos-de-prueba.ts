/**
 * Los productos que existen solo en staging y en D1 local (HU-C3.7): `infrastructure/
 * productos-de-prueba.json`. Se validan con el mismo esquema y las mismas reglas que
 * `productos.json` (P2), y sus celdas existen solo en el directorio del CORE de staging.
 *
 * `registroDelDestino` es lo único que el despliegue usa: en producción, nunca los trae.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conActivosEnStaging, type Producto, type RegistroDeProductos } from '@ed1/productos';
import { type Celda, cargarCeldas } from './celdas.ts';
import type { Destino } from './despliegue.ts';
import { cargarProductos } from './registro-productos.ts';
import { RAIZ } from './repo.ts';

export const ARCHIVO_PRODUCTOS_DE_PRUEBA = 'infrastructure/productos-de-prueba.json';

interface CeldaDePrueba {
  id: string;
  producto: string;
  shards: string[];
}

export interface ProductosDePrueba {
  productos: Producto[];
  /** Listas para el directorio de staging: activas, en el anillo 0, con la API de c0 de staging. */
  celdas: Celda[];
  /** Productos de verdad, pausados en producción, que se activan en staging (HU-T2.10). */
  activosEnStaging: string[];
}

/** Todas las fallas a la vez (P15); vacío si el archivo está bien. */
export function fallasDePrueba(
  datos: { productos: Producto[]; celdas: CeldaDePrueba[]; activos_en_staging?: string[] },
  reales: RegistroDeProductos,
  celdasReales: readonly Celda[],
): string[] {
  const fallas: string[] = [];
  try {
    cargarProductos({ productos: datos.productos });
  } catch (e) {
    fallas.push((e as Error).message);
  }
  const ids = new Set(reales.productos.map((p) => p.id));
  // HU-T2.10: solo se activa en staging un producto de verdad que en producción está pausado.
  for (const id of datos.activos_en_staging ?? []) {
    const real = reales.productos.find((p) => p.id === id);
    if (!real) fallas.push(`activos_en_staging nombra «${id}», que no es un producto de verdad`);
    else if (real.estado !== 'pausado') {
      fallas.push(`activos_en_staging nombra «${id}», que está «${real.estado}», no pausado`);
    }
  }
  for (const p of datos.productos) {
    if (ids.has(p.id))
      fallas.push(`«${p.id}» ya es un producto de verdad: uno de prueba no lo pisa`);
    const prefijos = reales.productos.flatMap((r) => r.prefijo_de_cobro ?? []);
    if (p.prefijo_de_cobro && prefijos.includes(p.prefijo_de_cobro)) {
      fallas.push(
        `«${p.id}» usa el prefijo de cobro «${p.prefijo_de_cobro}» de un producto de verdad`,
      );
    }
  }
  const deCeldas = new Set(celdasReales.map((c) => c.id));
  const dePrueba = new Set(datos.productos.map((p) => p.id));
  for (const c of datos.celdas) {
    if (deCeldas.has(c.id)) fallas.push(`la celda de prueba «${c.id}» ya existe en celdas.json`);
    if (!dePrueba.has(c.producto)) {
      fallas.push(
        `la celda de prueba «${c.id}» es de «${c.producto}», que no es un producto de prueba`,
      );
    }
    const patron = new RegExp(`^${c.producto}_${c.id}_s[0-9]+$`);
    for (const s of c.shards.filter((x) => !patron.test(x))) {
      fallas.push(
        `la celda de prueba «${c.id}» tiene el shard «${s}»; debe ser ${c.producto}_${c.id}_s<k>`,
      );
    }
  }
  return fallas;
}

export function cargarProductosDePrueba(
  datos: unknown = JSON.parse(readFileSync(join(RAIZ, ARCHIVO_PRODUCTOS_DE_PRUEBA), 'utf8')),
  reales: RegistroDeProductos = cargarProductos(),
  celdasReales: readonly Celda[] = cargarCeldas().celdas,
): ProductosDePrueba {
  const d = datos as {
    productos: Producto[];
    celdas: CeldaDePrueba[];
    activos_en_staging?: string[];
  };
  const fallas = fallasDePrueba(d, reales, celdasReales);
  if (fallas.length > 0) {
    throw new Error(`${ARCHIVO_PRODUCTOS_DE_PRUEBA} inválido:\n- ${fallas.join('\n- ')}`);
  }
  const c0 = celdasReales[0];
  if (!c0) throw new Error('celdas.json no trae celdas');
  return {
    productos: d.productos,
    activosEnStaging: d.activos_en_staging ?? [],
    celdas: d.celdas.map((c) => ({
      ...c0,
      id: c.id,
      producto: c.producto,
      shards: c.shards,
      estado: 'activa',
      anillo_despliegue: 0,
      // Solo existe en el directorio: su API es la de c0 de staging, que rechaza sus tokens.
      api: c0.api_staging,
      api_staging: c0.api_staging,
    })),
  };
}

/** Los productos que el despliegue copia a la base de ese destino: los de prueba, solo en staging. */
export function registroDelDestino(
  destino: Destino,
  reales: RegistroDeProductos = cargarProductos(),
  prueba: () => ProductosDePrueba = () => cargarProductosDePrueba(),
): RegistroDeProductos {
  if (destino !== 'staging') return reales;
  const d = prueba();
  return {
    productos: [
      ...conActivosEnStaging(reales.productos, d.activosEnStaging, destino),
      ...d.productos,
    ],
  };
}

/** Los productos de prueba que hay en la base (HU-C3.7, CA3): en producción, ninguno. */
export function productosDePruebaEn(
  filas: readonly Record<string, unknown>[][],
  dePrueba: readonly string[],
): string[] {
  return (filas[0] ?? [])
    .map((f) => String(f['id']))
    .filter((id) => dePrueba.includes(id))
    .map(
      (id) => `el producto de prueba «${id}» está en la base de producción; ahí no puede existir`,
    );
}
