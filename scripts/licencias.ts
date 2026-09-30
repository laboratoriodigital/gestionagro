/**
 * `pnpm licencias`: falla si alguna dependencia es AGPL o no declara licencia (HU-E1.2).
 * Comando constante y portable; `shell: true` solo porque en Windows `pnpm` es un `.cmd`.
 */
import { spawnSync } from 'node:child_process';
import { type ListadoDeLicencias, revisarLicencias } from './lib/licencias.ts';
import { RAIZ } from './lib/repo.ts';

const r = spawnSync('pnpm licenses list --json', {
  cwd: RAIZ,
  shell: true,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

if (r.status !== 0) {
  console.error(`❌ No se pudo listar las licencias:\n${r.stderr || r.stdout}`);
  process.exitCode = 1;
} else {
  const listado = JSON.parse(r.stdout) as ListadoDeLicencias;
  const rechazos = revisarLicencias(listado);
  const total = Object.values(listado).reduce((n, ps) => n + ps.length, 0);
  if (rechazos.length === 0) {
    console.log(`✅ ${total} dependencias con licencia permitida.`);
  } else {
    for (const x of rechazos) console.error(`❌ ${x.paquete}: ${x.motivo} (${x.licencia})`);
    console.error(
      `\n${rechazos.length} dependencias rechazadas. Se decide a mano (ARQUITECTURA §5.3).`,
    );
    process.exitCode = 1;
  }
}
