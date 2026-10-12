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
 * las pruebas que leen documentos. El e2e corre solo los grupos (agro, cuenta, parqueadero) a los
 * que llega el cambio (`scripts/lib/e2e-afectado.ts`, HU-C11.8); si no llega a ninguno, salta
 * navegadores y e2e. Si no puede calcularlo, corre todo y lo dice (P1).
 *
 * Con `VERIFICADO_EN_PR=true` (el CI de `main`, cuando `scripts/ya-verificado.ts` confirma que el
 * PR fusionado ya probó este mismo árbol), no corre nada: ni instalar (HU-C11.8). El D1 de workerd
 * corre en el PR que toca la base (`D1_INSTRUMENTO=auto`) y en la corrida semanal de `main`.
 *
 * Los comandos son constantes y portables; `shell: true` se usa solo porque en Windows
 * `pnpm` es un `.cmd` y Node no los lanza sin shell.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type Alcance,
  archivosDeDiff,
  decidirAlcance,
  instrumentoParaElCambio,
  leeDocumentos,
} from './lib/alcance.ts';
import { e2eDelCambio, leerUsos, type SeleccionE2e, specsDe } from './lib/e2e-afectado.ts';
import { listarArchivos, RAIZ } from './lib/repo.ts';
import { type ResultadoPaso, resumir } from './lib/resumen.ts';

const enCI = process.argv.includes('--ci');
/** El flujo de Windows lo omite: el e2e ya corre en Linux y allá los minutos cuentan doble. */
const conE2e = !process.argv.includes('--sin-e2e');

/** Los archivos cambiados contra `VERIFICAR_BASE`; `null` si no se puede saber. */
function archivosCambiados(): string[] | null {
  const base = process.env['VERIFICAR_BASE']?.trim();
  // Un sha de ceros es el «antes» de una rama nueva: no hay contra qué comparar.
  if (!base || !/^[0-9a-f]{7,40}$/.test(base) || /^0+$/.test(base)) return null;
  const r = spawnSync('git', ['diff', '--name-only', base, 'HEAD'], {
    cwd: RAIZ,
    encoding: 'utf8',
  });
  return r.status === 0 ? archivosDeDiff(r.stdout) : null;
}

const cambiados = enCI ? archivosCambiados() : null;
const alcance: Alcance | null =
  enCI && process.env['VERIFICAR_BASE']?.trim() ? decidirAlcance(cambiados) : null;

// HU-C11.8: con `D1_INSTRUMENTO=auto` (el CI de los PR), el D1 de workerd solo si el cambio toca
// la base; las pruebas lo leen de `process.env`, que heredan los comandos de abajo.
if (process.env['D1_INSTRUMENTO']?.trim() === 'auto') {
  const instrumento = instrumentoParaElCambio(cambiados);
  process.env['D1_INSTRUMENTO'] = instrumento;
  console.log(
    `\nInstrumento de D1: ${instrumento} (${
      instrumento === 'workerd'
        ? 'el cambio toca la base, o no se sabe qué cambió'
        : 'el cambio no toca la base'
    }).`,
  );
}
const soloDocumentos = alcance?.soloDocumentos === true;
const SALTA_CON_DOCUMENTOS = 'solo cambiaron documentos';
const yaVerificado = enCI && process.env['VERIFICADO_EN_PR']?.trim() === 'true';
const SALTA_YA_VERIFICADO = 'el PR ya verificó este mismo árbol';
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

/**
 * Qué e2e corren (HU-C11.8): las de los grupos que el cambio puede tocar. Sin base para comparar
 * (en local), todas.
 */
const seleccion: SeleccionE2e =
  alcance && !soloDocumentos && !yaVerificado
    ? e2eDelCambio(cambiados, leerUsos())
    : { todas: true, motivo: 'sin base para comparar: todas' };
const sinE2e = !seleccion.todas && seleccion.grupos.length === 0;
const SALTA_SIN_E2E = 'el cambio no toca nada que sirvan las e2e';

function comandoDeE2e(): string {
  if (seleccion.todas) return 'pnpm run e2e';
  const specs = specsDe(seleccion.grupos).join(' ');
  const telefono = `pnpm exec playwright test --project=telefono-360 ${specs}`;
  // Las mediciones `@rendimiento` son del sitio, el cuaderno y la cuenta; el parqueadero no tiene.
  return seleccion.grupos.some((g) => g !== 'parqueadero')
    ? `${telefono} && pnpm exec playwright test --project=rendimiento --no-deps --workers=1 --pass-with-no-tests ${specs}`
    : telefono;
}

const PASOS: ReadonlyArray<{
  paso: string;
  comando: string;
  saltaConDocumentos?: boolean;
  saltaSinE2e?: boolean;
}> = [
  ...(enCI ? [{ paso: 'instalar', comando: 'pnpm install --frozen-lockfile' }] : []),
  ...(enCI && conE2e
    ? [
        {
          paso: 'navegadores',
          comando: 'pnpm exec playwright install --with-deps chromium',
          saltaConDocumentos: true,
          saltaSinE2e: true,
        },
      ]
    : []),
  { paso: 'lint', comando: 'pnpm run lint' },
  { paso: 'typecheck', comando: 'pnpm run typecheck', saltaConDocumentos: true },
  { paso: 'validar:productos', comando: 'pnpm run validar:productos' },
  { paso: 'test', comando: comandoDePruebas() },
  { paso: 'build', comando: 'pnpm run build', saltaConDocumentos: true },
  ...(conE2e
    ? [
        {
          paso: 'e2e',
          comando: comandoDeE2e(),
          saltaConDocumentos: true,
          saltaSinE2e: true,
        },
      ]
    : []),
  { paso: 'licencias', comando: 'pnpm run licencias' },
];

if (alcance) console.log(`\nAlcance del cambio: ${alcance.motivo}.`);
if (alcance && !soloDocumentos) console.log(`E2E: ${seleccion.motivo}.`);
if (yaVerificado) console.log(`\n${SALTA_YA_VERIFICADO}: no corre ningún paso.`);

const resultados: ResultadoPaso[] = [];
for (const { paso, comando, saltaConDocumentos, saltaSinE2e } of PASOS) {
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
  if (yaVerificado) {
    resultados.push({ paso, ok: true, saltado: SALTA_YA_VERIFICADO, segundos: 0 });
    continue;
  }
  if (sinE2e && saltaSinE2e) {
    resultados.push({ paso, ok: true, saltado: SALTA_SIN_E2E, segundos: 0 });
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
  const linea = [
    alcance ? `Alcance del cambio: ${alcance.motivo}.\n\n` : '',
    alcance && !soloDocumentos ? `E2E: ${seleccion.motivo}.\n\n` : '',
    yaVerificado ? `${SALTA_YA_VERIFICADO}: no corre ningún paso.\n\n` : '',
  ].join('');
  appendFileSync(
    archivoResumen,
    `## Verificación\n\n${linea}${resumir(resultados, { detalle: true })}\n`,
  );
}

process.exitCode = resultados.every((r) => r.ok) ? 0 : 1;
