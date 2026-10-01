/// <reference types="astro/client" />
/**
 * Contenido de cada herramienta: los Markdown de `content/agro/<carpeta>/` (ARQUITECTURA §11).
 * La página se arma con el contrato y este contenido; nada se escribe dos veces (P2).
 */
import type { MarkdownInstance } from 'astro';
import { cargarProductos, type Producto } from '../../../../scripts/lib/productos.ts';
import { esHerramienta } from './seo.ts';

const markdown = import.meta.glob<MarkdownInstance<Record<string, unknown>>>(
  '../../../../content/agro/*/*.md',
  { eager: true },
);

/** Markdown de una carpeta de contenido (p. ej. `content/agro/calculadora-dpv`), en orden de nombre. */
export function contenidoDe(carpeta: string): MarkdownInstance<Record<string, unknown>>[] {
  const prefijo = `/${carpeta}/`;
  return Object.entries(markdown)
    .filter(([ruta]) => ruta.replace(/\\/g, '/').includes(prefijo))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, m]) => m);
}

export const productos: readonly Producto[] = cargarProductos();
export const herramientas: readonly Producto[] = productos.filter(esHerramienta);
export const productoPorId = (id: string): Producto | undefined =>
  productos.find((p) => p.id === id);
