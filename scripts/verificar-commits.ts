/**
 * `node scripts/verificar-commits.ts`: la guardia de la convención de commits y PR (HU-C0.2).
 *
 * Lee el rango `COMMITS_DESDE..COMMITS_HASTA` (la base y la cabeza del PR) y, si vienen,
 * `PR_TITULO` y `PR_CUERPO`. Todo llega por variables de entorno, nunca interpolado en el
 * `run:` del flujo (guardia de inyección de `scripts/lib/flujos.ts`). Nombra cada commit que
 * falla y por qué, todos a la vez (P15), y sale con código 1.
 *
 * En local: `COMMITS_DESDE=origin/main node scripts/verificar-commits.ts`.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { leerLog, revisar } from './lib/commits.ts';
import { RAIZ } from './lib/repo.ts';

const desde = process.env['COMMITS_DESDE']?.trim();
const hasta = process.env['COMMITS_HASTA']?.trim() || 'HEAD';
if (!desde) {
  console.error('❌ Falta COMMITS_DESDE: sin la base del PR no se sabe qué commits revisar.');
  process.exit(1);
}

const log = spawnSync('git', ['log', '--format=%H%x1f%B%x1e', `${desde}..${hasta}`], {
  cwd: RAIZ,
  encoding: 'utf8',
});
if (log.status !== 0) {
  // Sin el rango no hay revisión: se dice, no se da por bueno (P1).
  console.error(`❌ git log ${desde}..${hasta} falló:\n${log.stderr}`);
  process.exit(1);
}

const commits = leerLog(log.stdout);
const titulo = process.env['PR_TITULO'];
const hallazgos = revisar(
  commits,
  titulo === undefined ? undefined : { titulo, cuerpo: process.env['PR_CUERPO'] ?? '' },
);

const lineas =
  hallazgos.length === 0
    ? [`✅ ${commits.length} commits con la convención tipo(alcance): descripción y sin marca.`]
    : [
        `❌ ${hallazgos.length} fallas de la convención (BACKLOG_CORE §2.2):`,
        ...hallazgos.map((h) => `- ${h.donde}: ${h.falla}`),
        '',
        'Para corregir un commit que aún no está en main: `git rebase -i` con «reword», o rehacer la rama.',
      ];
console.log(lineas.join('\n'));

const resumen = process.env['GITHUB_STEP_SUMMARY'];
if (resumen) appendFileSync(resumen, `## Convención de commits\n\n${lineas.join('\n')}\n`);

process.exitCode = hallazgos.length === 0 ? 0 : 1;
