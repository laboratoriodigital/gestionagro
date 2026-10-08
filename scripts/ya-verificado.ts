/**
 * `node scripts/ya-verificado.ts`: en el CI de `main`, decide si el PR que se acaba de fusionar ya
 * verificó este mismo árbol (`scripts/lib/ya-verificado.ts`). Escribe `verificado=true|false` en
 * `$GITHUB_OUTPUT` y el motivo en el resumen. Pregunta a la API de GitHub con `GH_TOKEN`.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { RAIZ } from './lib/repo.ts';
import { decidirYaVerificado } from './lib/ya-verificado.ts';

const git = (...args: string[]) => spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8' });

async function corridasEnVerde(punta: string): Promise<number | null> {
  const repo = process.env['GITHUB_REPOSITORY'];
  const token = process.env['GH_TOKEN'];
  const api = process.env['GITHUB_API_URL'] ?? 'https://api.github.com';
  if (!repo || !token) return null;
  try {
    const r = await fetch(
      `${api}/repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${punta}&event=pull_request&status=success&per_page=1`,
      { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' } },
    );
    if (!r.ok) return null;
    const cuerpo = (await r.json()) as { total_count?: unknown };
    return typeof cuerpo.total_count === 'number' ? cuerpo.total_count : null;
  } catch {
    return null;
  }
}

const segundo = git('rev-parse', '--verify', '--quiet', 'HEAD^2');
const puntaDelPr = segundo.status === 0 ? segundo.stdout.trim() : null;
const prAlDia =
  puntaDelPr !== null && git('merge-base', '--is-ancestor', 'HEAD^1', puntaDelPr).status === 0;
const decision = decidirYaVerificado({
  puntaDelPr,
  prAlDia,
  corridasEnVerde: puntaDelPr && prAlDia ? await corridasEnVerde(puntaDelPr) : 0,
});

console.log(decision.motivo);
const salida = process.env['GITHUB_OUTPUT'];
if (salida) appendFileSync(salida, `verificado=${String(decision.verificado)}\n`);
const resumen = process.env['GITHUB_STEP_SUMMARY'];
if (resumen) appendFileSync(resumen, `## ¿Ya verificado en el PR?\n\n${decision.motivo}.\n\n`);
