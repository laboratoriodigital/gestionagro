/**
 * `node scripts/notas-de-version.ts 0.3.0`: imprime la sección `## [0.3.0]` del CHANGELOG, que el
 * flujo de publicación usa como notas de la versión en GitHub. Sin sección para esa versión, sale
 * con error: no se publica una versión sin decir qué trae.
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

if (process.argv[1]?.endsWith('notas-de-version.ts')) {
  const version = process.argv[2] ?? versionDelProducto();
  const notas = notasDe(readFileSync(join(RAIZ, 'CHANGELOG.md'), 'utf8'), version);
  if (!notas) {
    console.error(`❌ CHANGELOG.md no tiene la sección «## [${version}]».`);
    process.exit(1);
  }
  console.log(notas);
}
