/**
 * `pnpm verificar`: lint, typecheck, contratos product.yaml, pruebas, build y licencias.
 *
 * Corre todos los pasos aunque uno falle y al final los resume juntos (P15), para no
 * descubrir una falla por corrida. Sale con código 1 si alguno falló.
 *
 * `node scripts/verificar.ts --ci` (lo que corre `ci.yml`) antepone la instalación desde cero
 * con el lockfile congelado —un `package.json` roto tiene que fallar ahí, no quedar oculto por
 * un `node_modules` viejo (bitácora ecommerce, «nota en devDependencies»)— y escribe el
 * resumen, con la salida de cada falla, en `$GITHUB_STEP_SUMMARY`.
 *
 * Los comandos son constantes y portables; `shell: true` se usa solo porque en Windows
 * `pnpm` es un `.cmd` y Node no los lanza sin shell.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { RAIZ } from './lib/repo.ts';
import { type ResultadoPaso, resumir } from './lib/resumen.ts';

const enCI = process.argv.includes('--ci');

const PASOS: ReadonlyArray<{ paso: string; comando: string }> = [
  ...(enCI ? [{ paso: 'instalar', comando: 'pnpm install --frozen-lockfile' }] : []),
  { paso: 'lint', comando: 'pnpm run lint' },
  { paso: 'typecheck', comando: 'pnpm run typecheck' },
  { paso: 'validar:productos', comando: 'pnpm run validar:productos' },
  { paso: 'test', comando: 'pnpm run test' },
  { paso: 'build', comando: 'pnpm run build' },
  { paso: 'licencias', comando: 'pnpm run licencias' },
];

const resultados: ResultadoPaso[] = [];
for (const { paso, comando } of PASOS) {
  // Sin instalación no hay nada que verificar: se dice, en vez de sumar fallas falsas.
  if (resultados[0]?.paso === 'instalar' && !resultados[0].ok) {
    resultados.push({ paso, ok: false, omitido: true, segundos: 0 });
    continue;
  }
  console.log(`\n▶ ${paso}`);
  const inicio = performance.now();
  const r = spawnSync(comando, {
    cwd: RAIZ,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  process.stdout.write(salida);
  resultados.push({
    paso,
    ok: r.status === 0,
    segundos: (performance.now() - inicio) / 1000,
    salida,
  });
}

console.log(`\n${resumir(resultados)}`);

const archivoResumen = process.env['GITHUB_STEP_SUMMARY'];
if (enCI && archivoResumen) {
  appendFileSync(archivoResumen, `## Verificación\n\n${resumir(resultados, { detalle: true })}\n`);
}

process.exitCode = resultados.every((r) => r.ok) ? 0 : 1;
