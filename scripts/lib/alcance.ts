/**
 * Cuánto CI necesita un cambio (HU-C11.6, BACKLOG_CORE). Con el repositorio privado cada minuto
 * de Actions cuenta (ED1 §41), y un PR que solo toca documentos no necesita compilar ni abrir
 * navegadores.
 *
 * La regla es cerrada a propósito (P1): solo se ahorra cuando se SABE que todo lo cambiado es
 * documentación. Si no se puede calcular el cambio, o no hay cambios, corre todo y lo dice.
 *
 * El e2e de lo afectado (HU-C11.3, primer paso): si todo lo que no es documento es del
 * parqueadero, solo corren las e2e del parqueadero. Las pruebas unitarias corren todas igual.
 */

export interface Alcance {
  /** true solo si se calcularon los archivos cambiados y todos son documentos. */
  soloDocumentos: boolean;
  /**
   * true si se calcularon y todo lo que no es documento es del parqueadero (`esDelParqueadero`):
   * el e2e del agro, de la cuenta y del sitio no puede cambiar de resultado.
   */
  soloParqueadero: boolean;
  /** Por qué se decidió así, en una frase para el resumen de la corrida (P15). */
  motivo: string;
}

/**
 * Un documento es lo que vive en `docs/` o un `.md` de la raíz (README, CHANGELOG). `content/**`
 * NO es documentación: alimenta el sitio y el build, aunque sea Markdown.
 */
export function esDocumento(ruta: string): boolean {
  const r = ruta.replaceAll('\\', '/');
  return r.startsWith('docs/') || /^[^/]+\.md$/.test(r);
}

/**
 * Lo que habla con D1 (HU-C11.8): las apps con Worker y base (CORE, celda del agro, API del
 * parqueadero), el instrumento `packages/d1`, las migraciones, las pruebas de integración y el
 * lockfile (una versión nueva de wrangler o workerd). Solo ahí el D1 de workerd y la base en
 * proceso pueden dar resultados distintos (P17). `tests/repo/alcance.test.ts` exige que todo código
 * con SQL viva en una de estas rutas.
 */
export function esDeLaBase(ruta: string): boolean {
  const r = ruta.replaceAll('\\', '/');
  return /^(packages\/d1\/|infrastructure\/migraciones\/|apps\/(core|api-celda|parqueadero-api)\/|tests\/integracion\/|pnpm-lock\.yaml$)/.test(
    r,
  );
}

/**
 * Qué instrumento de D1 usan las pruebas de un PR (HU-C11.8): el D1 de workerd si el cambio toca
 * la base, o si no se sabe qué cambió (P1: ante la duda, el fiel); si no, la base en proceso.
 */
export function instrumentoParaElCambio(archivos: readonly string[] | null): 'workerd' | 'sqlite' {
  // Sin archivos cambiados tampoco se sabe nada: como `decidirAlcance`, el camino completo.
  return archivos === null || archivos.length === 0 || archivos.some(esDeLaBase)
    ? 'workerd'
    : 'sqlite';
}

/**
 * Lo que solo usa el parqueadero: sus apps, sus paquetes, su contenido, su migración y sus
 * pruebas. Ningún otro producto importa sus paquetes (lo revisa `tests/repo/alcance.test.ts`).
 * Un paquete compartido (`packages/ui`, `@ed1/sync`, `@ed1/impresion`…), `scripts/` o la raíz no
 * es del parqueadero: corre todo (HU-C11.3 CA3).
 */
export function esDelParqueadero(ruta: string): boolean {
  const r = ruta.replaceAll('\\', '/');
  return /^(apps\/parqueadero-[^/]+\/|packages\/parqueadero-[^/]+\/|content\/parqueadero\/|infrastructure\/migraciones\/parqueadero\/|tests\/(e2e|integracion)\/parqueadero-)/.test(
    r,
  );
}

/** `archivos` es la lista cambiada, o `null` si no se pudo calcular. */
export function decidirAlcance(archivos: readonly string[] | null): Alcance {
  if (archivos === null) {
    return {
      soloDocumentos: false,
      soloParqueadero: false,
      motivo: 'no se pudo calcular qué cambió: corre todo',
    };
  }
  if (archivos.length === 0) {
    return {
      soloDocumentos: false,
      soloParqueadero: false,
      motivo: 'no hay archivos cambiados: corre todo',
    };
  }
  const otros = archivos.filter((a) => !esDocumento(a));
  if (otros.length === 0) {
    return {
      soloDocumentos: true,
      soloParqueadero: false,
      motivo: `los ${archivos.length} archivos cambiados son documentos`,
    };
  }
  if (otros.every(esDelParqueadero)) {
    return {
      soloDocumentos: false,
      soloParqueadero: true,
      motivo: `los ${otros.length} archivos de código cambiados son del parqueadero: solo sus e2e`,
    };
  }
  const muestra = otros.slice(0, 3).join(', ');
  return {
    soloDocumentos: false,
    soloParqueadero: false,
    motivo: `cambia código o contenido (${muestra}${otros.length > 3 ? ', …' : ''}): corre todo`,
  };
}

/** Lista de `git diff --name-only`, una ruta por línea, sin vacías. */
export function archivosDeDiff(salida: string): string[] {
  return salida
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Las pruebas que leen documentos (una ruta con `docs`, o un `.md`). Con un cambio solo de
 * documentos, son las únicas que pueden cambiar de resultado. Se derivan del código, no de una
 * lista escrita a mano (P2).
 */
export function leeDocumentos(fuente: string): boolean {
  return /['"`]docs['"`/]|docs\/|\.md['"`]/.test(fuente);
}
