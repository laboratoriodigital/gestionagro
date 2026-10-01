/**
 * `node scripts/validar-wrangler-celdas.ts` (build de apps/api-celda, HU-E5.1): valida con
 * `wrangler deploy --dry-run` la configuración generada de cada celda, en producción y staging.
 * Las celdas salen de celdas.json (P2): una celda nueva se valida sin tocar este script.
 * Node y el binario de wrangler, sin shell (P3).
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { cargarCeldas } from './lib/celdas.ts';
import { RAIZ } from './lib/repo.ts';

const dir = join(RAIZ, 'apps', 'api-celda');
const wrangler = join(
  dirname(createRequire(join(dir, 'package.json')).resolve('wrangler/package.json')),
  'bin',
  'wrangler.js',
);
let fallas = 0;
for (const celda of cargarCeldas().celdas) {
  for (const [entorno, salida] of [
    ['--env=', 'dry-run'],
    ['--env=staging', 'dry-run-staging'],
  ] as const) {
    const r = spawnSync(
      process.execPath,
      [
        wrangler,
        'deploy',
        '--dry-run',
        '-c',
        `wrangler.${celda.id}.jsonc`,
        '--outdir',
        join('.wrangler', `${salida}-${celda.id}`),
        entorno,
      ],
      { cwd: dir, encoding: 'utf8' },
    );
    process.stdout.write(`${r.stdout ?? ''}${r.stderr ?? ''}`);
    if (r.status !== 0) {
      fallas++;
      console.error(`❌ wrangler.${celda.id}.jsonc (${entorno}) no pasa el dry-run`);
    }
  }
}
process.exitCode = fallas > 0 ? 1 : 0;
