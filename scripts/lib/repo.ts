import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Sube desde `desde` hasta la carpeta que tiene `pnpm-workspace.yaml`. No se usa una ruta fija
 * relativa a este archivo: un empaquetador (el build de Astro) lo mueve a otra carpeta.
 */
export function encontrarRaiz(desde: string): string {
  let carpeta = desde;
  while (!existsSync(join(carpeta, 'pnpm-workspace.yaml'))) {
    const padre = dirname(carpeta);
    if (padre === carpeta)
      throw new Error(`No se encontró pnpm-workspace.yaml subiendo desde ${desde}`);
    carpeta = padre;
  }
  return carpeta;
}

/** Raíz del repositorio, calculada con rutas del sistema y no con cadenas de URL (P3). */
export const RAIZ = encontrarRaiz(dirname(fileURLToPath(import.meta.url)));

const CARPETAS_IGNORADAS = new Set(['node_modules', '.git', 'dist', 'coverage', '_to_delete']);

/** Lista archivos del repositorio (rutas relativas con `/`) que cumplen `filtro`. */
export function listarArchivos(filtro: (rutaRelativa: string) => boolean, raiz = RAIZ): string[] {
  const encontrados: string[] = [];
  const recorrer = (carpeta: string): void => {
    for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
      if (CARPETAS_IGNORADAS.has(entrada.name)) continue;
      const ruta = join(carpeta, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(ruta);
      } else {
        const rel = relative(raiz, ruta).split(sep).join('/');
        if (filtro(rel)) encontrados.push(rel);
      }
    }
  };
  recorrer(raiz);
  return encontrados.sort();
}
