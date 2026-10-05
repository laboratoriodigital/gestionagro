/**
 * `pnpm verificar`: lint, typecheck, contratos product.yaml, pruebas, build, e2e y licencias.
 * `--sin-e2e` omite el e2e (lo usa el flujo de Windows).
 *
 * Corre todos los pasos aunque uno falle y al final los resume juntos (P15), para no
 * descubrir una falla por corrida. Sale con código 1 si alguno falló.
 *
 * `node scripts/verificar.ts --ci` (lo que corre `ci.yml`) antepone la instalación desde cero
 * con el lockfile congelado —un `package.json` roto tiene que fallar ahí, no quedar oculto por
 * un `node_modules` viejo (bitácora ecommerce, «nota en devDependencies»)— y escribe el
 * resumen, con la salida de cada falla, en `$GITHUB_STEP_SUMMARY`.
 *
 * En CI, con `VERIFICAR_BASE` (el commit contra el que se compara), calcula qué cambió
 * (HU-C11.6). Si todo son documentos, salta navegadores, typecheck, build y e2e, y corre solo
 * las pruebas que leen documentos. Si no puede calcularlo, corre todo y lo dice (P1).
 *
 * Los comandos son constantes y portables; `shell: true` se usa solo porque en Windows
 * `pnpm` es un `.cmd` y Node no los lanza sin shell.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Alcance, archivosDeDiff, decidirAlcance, leeDocumentos } from './lib/alcance.ts';
import { listarArchivos, RAIZ } from './lib/repo.ts';
import { type ResultadoPaso, resumir } from './lib/resumen.ts';

const enCI = process.argv.includes('--ci');
/** El flujo de Windows lo omite: el e2e ya corre en Linux y allá los minutos cuentan doble. */
const conE2e = !process.argv.includes('--sin-e2e');

function calcularAlcance(): Alcance | null {
  const base = process.env['VERIFICAR_BASE']?.trim();
  if (!enCI || !base) return null;
  // Un sha de ceros es el «antes» de una rama nueva: no hay contra qué comparar.
  if (!/^[0-9a-f]{7,40}$/.test(base) || /^0+$/.test(base)) return decidirAlcance(null);
  const r = spawnSync('git', ['diff', '--name-only', base, 'HEAD'], {
    cwd: RAIZ,
    encoding: 'utf8',
  });
  return decidirAlcance(r.status === 0 ? archivosDeDiff(r.stdout) : null);
}

const alcance = calcularAlcance();
const soloDocumentos = alcance?.soloDocumentos === true;
const SALTA_CON_DOCUMENTOS = 'solo cambiaron documentos';
/**
 * Con un navegador del equipo (`PW_CANAL`, como el Edge del runner propio), no hay nada que
 * descargar: Playwright usa el instalado (docs/runbooks/runner-propio.md).
 */
const canalDelEquipo = process.env['PW_CANAL']?.trim();

/** Con un cambio solo de documentos, las únicas pruebas que pueden cambiar son las que los leen. */
function comandoDePruebas(): string {
  if (!soloDocumentos) return 'pnpm run test';
  const pruebas = listarArchivos((r) => r.endsWith('.test.ts')).filter((r) =>
    leeDocumentos(readFileSync(join(RAIZ, r), 'utf8')),
  );
  return `pnpm exec vitest run ${pruebas.join(' ')}`;
}

const PASOS: ReadonlyArray<{ paso: string; comando: string; saltaConDocumentos?: boolean }> = [
  ...(enCI ? [{ paso: 'instalar', comando: 'pnpm install --frozen-lockfile' }] : []),
  ...(enCI && conE2e
    ? [
        {
          paso: 'navegadores',
          comando: 'pnpm exec playwright install --with-deps chromium',
          saltaConDocumentos: true,
        },
      ]
    : []),
  { paso: 'lint', comando: 'pnpm run lint' },
  { paso: 'typecheck', comando: 'pnpm run typecheck', saltaConDocumentos: true },
  { paso: 'validar:productos', comando: 'pnpm run validar:productos' },
  { paso: 'test', comando: comandoDePruebas() },
  { paso: 'build', comando: 'pnpm run build', saltaConDocumentos: true },
  ...(conE2e ? [{ paso: 'e2e', comando: 'pnpm run e2e', saltaConDocumentos: true }] : []),
  { paso: 'licencias', comando: 'pnpm run licencias' },
];

if (alcance) console.log(`\nAlcance del cambio: ${alcance.motivo}.`);

const resultados: ResultadoPaso[] = [];
for (const { paso, comando, saltaConDocumentos } of PASOS) {
  // Sin instalación no hay nada que verificar: se dice, en vez de sumar fallas falsas.
  if (resultados[0]?.paso === 'instalar' && !resultados[0].ok) {
    resultados.push({ paso, ok: false, omitido: true, segundos: 0 });
    continue;
  }
  if (paso === 'navegadores' && canalDelEquipo) {
    resultados.push({
      paso,
      ok: true,
      saltado: `usa el navegador del equipo (${canalDelEquipo})`,
      segundos: 0,
    });
    continue;
  }
  if (soloDocumentos && saltaConDocumentos) {
    resultados.push({ paso, ok: true, saltado: SALTA_CON_DOCUMENTOS, segundos: 0 });
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
  const linea = alcance ? `Alcance del cambio: ${alcance.motivo}.\n\n` : '';
  appendFileSync(
    archivoResumen,
    `## Verificación\n\n${linea}${resumir(resultados, { detalle: true })}\n`,
  );
}

process.exitCode = resultados.every((r) => r.ok) ? 0 : 1;
