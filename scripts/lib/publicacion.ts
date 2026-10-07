/**
 * Qué se publica al fusionar a main (HU-C0.3, PLATAFORMA §6.3, ARQUITECTURA §7.3).
 *
 * Tres productos con versión propia:
 * - **el agro** (CultivoPro): la versión de `package.json` de la raíz, etiquetas `vX.Y.Z`;
 * - **el CORE**: la de `apps/core/package.json`, etiquetas `core-vX.Y.Z`;
 * - **el parqueadero** (HU-Q0.3): la de `apps/parqueadero-sitio/package.json`, etiquetas
 *   `parqueadero-vX.Y.Z`. En `0.0.0` aún no se publica: vive en staging hasta tener su dominio
 *   (HU-Q5.2), y la `0.1.0` de la demostración es la primera.
 *
 * Una versión sin etiqueta es nueva y se publica: etiqueta, versión en GitHub con las notas de su
 * CHANGELOG y despliegue a producción **solo de ese producto**. Así una publicación del agro no
 * lleva a producción cambios del CORE que nadie publicó, ni al revés.
 */

export type ProductoPublicable = 'agro' | 'core' | 'parqueadero';

/** La versión de un producto que todavía no se publica nunca (HU-Q0.3). */
export const SIN_PUBLICAR_AUN = '0.0.0';

export interface EstadoDeVersion {
  version: string;
  /** Ya tiene su etiqueta en el repositorio. */
  publicada: boolean;
}

export interface Publicacion {
  publicarAgro: boolean;
  publicarCore: boolean;
  publicarParqueadero: boolean;
  /** Lo que se despliega a producción, separado por comas; vacío: nada, solo staging. */
  productos: string;
}

export const etiquetaDe = (producto: ProductoPublicable, version: string): string =>
  producto === 'agro' ? `v${version}` : `${producto}-v${version}`;

export function decidirPublicacion(
  agro: EstadoDeVersion,
  core: EstadoDeVersion,
  parqueadero: EstadoDeVersion = { version: SIN_PUBLICAR_AUN, publicada: false },
): Publicacion {
  for (const [nombre, e] of [
    ['agro', agro],
    ['core', core],
    ['parqueadero', parqueadero],
  ] as const) {
    if (!/^\d+\.\d+\.\d+$/.test(e.version)) {
      throw new Error(`la versión del ${nombre} («${e.version}») no es x.y.z`);
    }
  }
  const publicarParqueadero = !parqueadero.publicada && parqueadero.version !== SIN_PUBLICAR_AUN;
  const productos = [
    ...(core.publicada ? [] : ['core']),
    ...(agro.publicada ? [] : ['agro']),
    ...(publicarParqueadero ? ['parqueadero'] : []),
  ];
  return {
    publicarAgro: !agro.publicada,
    publicarCore: !core.publicada,
    publicarParqueadero,
    productos: productos.join(','),
  };
}

/**
 * Lee la lista de `--productos` del despliegue; sin nada, el CORE y el agro (el «Run workflow» a
 * mano). El parqueadero va a producción solo cuando se publica su versión: en staging sale con el
 * CORE.
 */
export function productosADesplegar(valor: string | undefined): Set<ProductoPublicable> {
  const lista = (valor ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const todos: ProductoPublicable[] = ['core', 'agro'];
  if (lista.length === 0) return new Set(todos);
  const validos: ProductoPublicable[] = [...todos, 'parqueadero'];
  const raros = lista.filter((x) => !validos.includes(x as ProductoPublicable));
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

/**
 * Lo que cambia el parqueadero y tiene que contarse en su CHANGELOG (HU-Q0.3 CA3): el código de
 * `apps/parqueadero-*` y `packages/parqueadero-*`, no sus pruebas.
 */
export function cambiaElParqueadero(archivos: readonly string[]): boolean {
  return archivos.some(
    (a) =>
      /^(apps|packages)\/parqueadero-[^/]+\/src\/.+\.(ts|tsx|astro|css)$/.test(a) &&
      !/\.(test|spec)\.tsx?$/.test(a),
  );
}

/**
 * Las versiones publicadas cuya sección del CHANGELOG ya no dice lo que decía al publicarse. Una
 * versión publicada no se reescribe: lo nuevo va en «[Sin publicar]». Pasó el 6 oct 2026, al fusionar
 * un sprint justo después de su publicación: Git juntó las entradas nuevas con las de la versión.
 * `extraer` es `notasDe` (scripts/notas-de-version.ts).
 */
export function seccionesReescritas(
  actual: string,
  publicadas: readonly { version: string; changelog: string }[],
  extraer: (changelog: string, version: string) => string | null,
): string[] {
  return publicadas
    .filter(({ version, changelog }) => {
      const entonces = extraer(changelog, version);
      return entonces !== null && extraer(actual, version) !== entonces;
    })
    .map(({ version }) => version);
}
