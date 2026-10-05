/**
 * Qué se publica al fusionar a main (HU-C0.3, PLATAFORMA §6.3, ARQUITECTURA §7.3).
 *
 * Dos productos con versión propia:
 * - **el agro** (CultivoPro): la versión de `package.json` de la raíz, etiquetas `vX.Y.Z`;
 * - **el CORE**: la de `apps/core/package.json`, etiquetas `core-vX.Y.Z`.
 *
 * Una versión sin etiqueta es nueva y se publica: etiqueta, versión en GitHub con las notas de su
 * CHANGELOG y despliegue a producción **solo de ese producto**. Así una publicación del agro no
 * lleva a producción cambios del CORE que nadie publicó, ni al revés.
 */

export type ProductoPublicable = 'agro' | 'core';

export interface EstadoDeVersion {
  version: string;
  /** Ya tiene su etiqueta en el repositorio. */
  publicada: boolean;
}

export interface Publicacion {
  publicarAgro: boolean;
  publicarCore: boolean;
  /** Lo que se despliega a producción, separado por comas; vacío: nada, solo staging. */
  productos: string;
}

export const etiquetaDe = (producto: ProductoPublicable, version: string): string =>
  producto === 'core' ? `core-v${version}` : `v${version}`;

export function decidirPublicacion(agro: EstadoDeVersion, core: EstadoDeVersion): Publicacion {
  for (const [nombre, e] of [
    ['agro', agro],
    ['core', core],
  ] as const) {
    if (!/^\d+\.\d+\.\d+$/.test(e.version)) {
      throw new Error(`la versión del ${nombre} («${e.version}») no es x.y.z`);
    }
  }
  const productos = [...(core.publicada ? [] : ['core']), ...(agro.publicada ? [] : ['agro'])];
  return {
    publicarAgro: !agro.publicada,
    publicarCore: !core.publicada,
    productos: productos.join(','),
  };
}

/** Lee la lista de `--productos` del despliegue; sin nada, todos (el «Run workflow» a mano). */
export function productosADesplegar(valor: string | undefined): Set<ProductoPublicable> {
  const lista = (valor ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const todos: ProductoPublicable[] = ['core', 'agro'];
  if (lista.length === 0) return new Set(todos);
  const raros = lista.filter((x) => !todos.includes(x as ProductoPublicable));
  if (raros.length > 0) throw new Error(`productos desconocidos: ${raros.join(', ')}`);
  return new Set(lista as ProductoPublicable[]);
}

/**
 * Lo que cambia el código del CORE y tiene que contarse en su CHANGELOG (la guardia del PR): el
 * código de `apps/core`, no sus pruebas ni su configuración generada.
 */
export function cambiaElCodigoDelCore(archivos: readonly string[]): boolean {
  return archivos.some((a) => /^apps\/core\/src\/.+\.ts$/.test(a) && !a.endsWith('.test.ts'));
}
