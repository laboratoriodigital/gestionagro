/**
 * `node scripts/generar-catalogo-core.ts`: genera `apps/core/src/catalogo.generado.json`, lo que
 * el Worker del CORE sabe de cada producto sin consultar la base: la versión vigente de su política
 * y sus planes (HU-C3.1, HU-C3.4). El Worker no tiene sistema de archivos, así que lo importa al
 * compilar. Antes eran dos `import` por producto en `apps/core/src/productos.ts`; ahora agregar un
 * producto es un archivo y este comando, y ningún archivo de código del CORE lo nombra (R1,
 * HU-Q7.1). No se edita a mano; una prueba exige que sea el generado (P2).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RegistroDeProductos } from '@ed1/productos';
import { cargarProductosDePrueba } from './lib/productos-de-prueba.ts';
import { cargarProductos } from './lib/registro-productos.ts';
import { RAIZ } from './lib/repo.ts';

export const RUTA_CATALOGO_CORE = join(RAIZ, 'apps', 'core', 'src', 'catalogo.generado.json');

/** Lo que el CORE usa de un plan (`PlanDelProducto`), y nada del texto de la página de precios. */
interface PlanDelCatalogo {
  id: string;
  nombre: string;
  gratuito?: boolean;
  cobro_mensual_cop?: number;
  cobro?: Record<string, number>;
}

export interface ParteDelCatalogo {
  politicas: Record<string, string>;
  planes: Record<string, PlanDelCatalogo[]>;
}

const leer = (ruta: string) => JSON.parse(readFileSync(join(RAIZ, ruta), 'utf8'));

function parte(registro: RegistroDeProductos): ParteDelCatalogo {
  const politicas: Record<string, string> = {};
  const planes: Record<string, PlanDelCatalogo[]> = {};
  for (const p of registro.productos) {
    politicas[p.id] = (leer(p.politica) as { version: string }).version;
    // Un producto sin organizaciones (la cuenta, ADR-28) no tiene planes.
    planes[p.id] = (p.planes ? (leer(p.planes) as { planes: PlanDelCatalogo[] }).planes : []).map(
      (x) => ({
        id: x.id,
        nombre: x.nombre,
        ...(x.gratuito === undefined ? {} : { gratuito: x.gratuito }),
        ...(x.cobro_mensual_cop === undefined ? {} : { cobro_mensual_cop: x.cobro_mensual_cop }),
        ...(x.cobro === undefined ? {} : { cobro: x.cobro }),
      }),
    );
  }
  return { politicas, planes };
}

/** El catálogo real y, aparte, el de los productos que solo existen en staging (HU-C3.7). */
export function catalogoDelCore(): { real: ParteDelCatalogo; prueba: ParteDelCatalogo } {
  return {
    real: parte(cargarProductos()),
    prueba: parte({ productos: cargarProductosDePrueba().productos }),
  };
}

export const textoDelCatalogoCore = (): string => `${JSON.stringify(catalogoDelCore(), null, 2)}\n`;

if (process.argv[1]?.endsWith('generar-catalogo-core.ts')) {
  writeFileSync(RUTA_CATALOGO_CORE, textoDelCatalogoCore());
  console.log(`✅ ${RUTA_CATALOGO_CORE}`);
}
