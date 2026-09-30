/**
 * `pnpm verificar`: lint, typecheck, pruebas y build, en ese orden.
 *
 * Corre todos los pasos aunque uno falle y al final los resume juntos (P15), para no
 * descubrir una falla por corrida. Sale con código 1 si alguno falló.
 *
 * Los comandos son constantes y portables; `shell: true` se usa solo porque en Windows
 * `pnpm` es un `.cmd` y Node no los lanza sin shell.
 */
import { spawnSync } from 'node:child_process';
import { RAIZ } from './lib/repo.ts';
import { type ResultadoPaso, resumir } from './lib/resumen.ts';

const PASOS = ['lint', 'typecheck', 'test', 'build'] as const;

const resultados: ResultadoPaso[] = PASOS.map((paso) => {
  console.log(`\n▶ ${paso}`);
  const inicio = performance.now();
  const r = spawnSync(`pnpm run ${paso}`, { cwd: RAIZ, stdio: 'inherit', shell: true });
  return { paso, ok: r.status === 0, segundos: (performance.now() - inicio) / 1000 };
});

console.log(`\n${resumir(resultados)}`);
process.exitCode = resultados.every((r) => r.ok) ? 0 : 1;
