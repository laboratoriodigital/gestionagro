/**
 * `node scripts/generar-ui.ts`: escribe los `.css` de los tokens v2 desde
 * `packages/ui/src/v2/tokens.ts` (HU-C6.1, P2). Se corre después de cambiar un token; la prueba
 * `tests/repo/ui-tokens.test.ts` falla si alguien edita el CSS a mano o se olvida de correrlo.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './lib/repo.ts';
import { ARCHIVOS_UI } from './lib/ui-css.ts';

for (const [ruta, generar] of Object.entries(ARCHIVOS_UI)) {
  writeFileSync(join(RAIZ, ruta), generar());
  console.log(`✅ ${ruta}`);
}
