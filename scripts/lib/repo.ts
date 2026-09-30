import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Raíz del repositorio, calculada con rutas del sistema y no con cadenas de URL (P3). */
export const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

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
