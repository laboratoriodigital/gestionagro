/**
 * `pnpm licencias`: falla si alguna dependencia es AGPL o no declara licencia (HU-E1.2).
 *
 * Se comprueba a sí misma (P17): toda dependencia declarada en un `package.json` del workspace
 * tiene que aparecer en el listado. Sin `--recursive`, pnpm solo lista la raíz y lo de
 * `apps/` y `packages/` pasaba sin revisar (bitácora agro 6).
 *
 * Comando constante y portable; `shell: true` solo porque en Windows `pnpm` es un `.cmd`.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  dependenciasDeclaradas,
  faltantesEnListado,
  type ListadoDeLicencias,
  revisarLicencias,
} from './lib/licencias.ts';
import { listarArchivos, RAIZ } from './lib/repo.ts';

const r = spawnSync('pnpm --recursive licenses list --json', {
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
  const declaradas = listarArchivos(
    (rel) => rel === 'package.json' || rel.endsWith('/package.json'),
  ).flatMap((archivo) =>
    dependenciasDeclaradas(JSON.parse(readFileSync(join(RAIZ, archivo), 'utf8'))),
  );
  const faltantes = faltantesEnListado(listado, declaradas);
  const rechazos = revisarLicencias(listado);
  const total = Object.values(listado).reduce((n, ps) => n + ps.length, 0);
  for (const f of faltantes) {
    console.error(`❌ ${f}: declarada en un package.json pero ausente del listado de licencias`);
  }
  for (const x of rechazos) console.error(`❌ ${x.paquete}: ${x.motivo} (${x.licencia})`);
  if (faltantes.length === 0 && rechazos.length === 0) {
    console.log(`✅ ${total} dependencias con licencia permitida.`);
  } else {
    console.error(
      `\n${rechazos.length} rechazadas y ${faltantes.length} sin revisar. Se decide a mano (ARQUITECTURA §5.3).`,
    );
    process.exitCode = 1;
  }
}
