/**
 * `node scripts/notas-de-version.ts 0.3.0`: imprime la sección `## [0.3.0]` del CHANGELOG, que el
 * flujo de publicación usa como notas de la versión en GitHub. Sin sección para esa versión, sale
 * con error: no se publica una versión sin decir qué trae.
 *
 * Con `--core`, lo mismo con la versión y el CHANGELOG del CORE (`apps/core/`, HU-C0.3); con
 * `--parqueadero`, con los del parqueadero (`apps/parqueadero-sitio/`, HU-Q0.3); con `--tienda`, con
 * los de la Tienda (`apps/tienda-api/`, HU-T0.2).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './lib/repo.ts';

/** El texto de la versión, sin su título; null si el CHANGELOG no tiene esa sección. */
export function notasDe(changelog: string, version: string): string | null {
  const titulo = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\][^\\n]*\\n`, 'm');
  const inicio = titulo.exec(changelog);
  if (!inicio) return null;
  const resto = changelog.slice(inicio.index + inicio[0].length);
  const fin = resto.search(/^## \[/m);
  return (fin < 0 ? resto : resto.slice(0, fin)).trim();
}

export const versionDelProducto = (): string =>
  (JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as { version: string }).version;

/** La versión del CORE (HU-C0.3): la de `apps/core/package.json`. */
export const versionDelCore = (): string =>
  (
    JSON.parse(readFileSync(join(RAIZ, 'apps', 'core', 'package.json'), 'utf8')) as {
      version: string;
    }
  ).version;

export const CHANGELOG_DEL_CORE = join('apps', 'core', 'CHANGELOG.md');

/** La versión del parqueadero (HU-Q0.3): la de `apps/parqueadero-sitio/package.json`. */
export const versionDelParqueadero = (): string =>
  (
    JSON.parse(readFileSync(join(RAIZ, 'apps', 'parqueadero-sitio', 'package.json'), 'utf8')) as {
      version: string;
    }
  ).version;

export const CHANGELOG_DEL_PARQUEADERO = join('apps', 'parqueadero-sitio', 'CHANGELOG.md');

/** La versión de la Tienda (HU-T0.2): la de `apps/tienda-api/package.json`. */
export const versionDeLaTienda = (): string =>
  (
    JSON.parse(readFileSync(join(RAIZ, 'apps', 'tienda-api', 'package.json'), 'utf8')) as {
      version: string;
    }
  ).version;

export const CHANGELOG_DE_LA_TIENDA = join('apps', 'tienda-api', 'CHANGELOG.md');

if (process.argv[1]?.endsWith('notas-de-version.ts')) {
  const delCore = process.argv.includes('--core');
  const delParqueadero = process.argv.includes('--parqueadero');
  const deLaTienda = process.argv.includes('--tienda');
  const argumentos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const version =
    argumentos[0] ??
    (delCore
      ? versionDelCore()
      : delParqueadero
        ? versionDelParqueadero()
        : deLaTienda
          ? versionDeLaTienda()
          : versionDelProducto());
  const archivo = delCore
    ? CHANGELOG_DEL_CORE
    : delParqueadero
      ? CHANGELOG_DEL_PARQUEADERO
      : deLaTienda
        ? CHANGELOG_DE_LA_TIENDA
        : 'CHANGELOG.md';
  const notas = notasDe(readFileSync(join(RAIZ, archivo), 'utf8'), version);
  if (!notas) {
    console.error(`❌ ${archivo} no tiene la sección «## [${version}]».`);
    process.exit(1);
  }
  console.log(notas);
}
