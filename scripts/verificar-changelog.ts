/**
 * `node scripts/verificar-changelog.ts`: en el CI, que ninguna versión publicada del agro ni del
 * CORE haya cambiado su sección del CHANGELOG (`seccionesReescritas`). Compara con el archivo tal
 * como estaba en su etiqueta (`vX.Y.Z`, `core-vX.Y.Z`): el CI trae la historia completa.
 *
 * Vigila las versiones publicadas después de la corrección del 6 oct 2026 (agro 0.4.0, CORE
 * 0.2.0): hasta ahí, dos fusiones habían dejado entradas en la versión equivocada, y se corrigieron
 * a mano (bitácora core 6).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seccionesReescritas } from './lib/publicacion.ts';
import { RAIZ } from './lib/repo.ts';
import { notasDe } from './notas-de-version.ts';

const git = (...args: string[]) => spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8' });

/** a > b en versión semántica x.y.z. */
const posterior = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) {
    const d = (x?.[i] ?? 0) - (y?.[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
};

const fallas: string[] = [];
for (const [archivo, prefijo, desde] of [
  // Con barras de git, no las del sistema: `git show` las pide así también en Windows.
  ['CHANGELOG.md', 'v', '0.4.0'],
  ['apps/core/CHANGELOG.md', 'core-v', '0.2.0'],
  // HU-Q0.3: todas las del parqueadero, desde la primera.
  ['apps/parqueadero-sitio/CHANGELOG.md', 'parqueadero-v', '0.0.0'],
  // HU-T0.2: todas las de la Tienda, desde la primera.
  ['apps/tienda-api/CHANGELOG.md', 'tienda-v', '0.0.0'],
] as const) {
  const etiquetas = git('tag', '--list', `${prefijo}[0-9]*`)
    .stdout.split(/\r?\n/)
    .filter((e) => e && posterior(e.slice(prefijo.length), desde));
  const publicadas = etiquetas.flatMap((etiqueta) => {
    const entonces = git('show', `${etiqueta}:${archivo}`);
    return entonces.status === 0
      ? [{ version: etiqueta.slice(prefijo.length), changelog: entonces.stdout }]
      : [];
  });
  const actual = readFileSync(join(RAIZ, archivo), 'utf8');
  for (const version of seccionesReescritas(actual, publicadas, notasDe)) {
    fallas.push(
      `${archivo}: la sección [${version}] ya se publicó (${prefijo}${version}) y cambió. Lo nuevo va en «[Sin publicar]».`,
    );
  }
}

if (fallas.length > 0) {
  console.error(`❌ ${fallas.join('\n❌ ')}`);
  process.exit(1);
}
console.log('✅ Las versiones publicadas siguen diciendo lo que dijeron.');
