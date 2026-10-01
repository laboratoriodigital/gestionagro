/**
 * `node scripts/armar-despliegue.ts`: une el build del cuaderno al del sitio en
 * `apps/sitio/dist/agro/app/`, que es lo que sube el Worker del sitio (ADR-19, HU-E1.5).
 *
 * Se niega a pisar algo: si el sitio ya generó una página dentro de `/agro/app/`, dos productos
 * se estarían disputando la misma ruta, y eso se decide a mano.
 */
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './lib/repo.ts';

const origen = join(RAIZ, 'apps', 'cuaderno', 'dist');
const sitio = join(RAIZ, 'apps', 'sitio', 'dist');
const destino = join(sitio, 'agro', 'app');

for (const [carpeta, nombre] of [
  [origen, 'apps/cuaderno/dist'],
  [sitio, 'apps/sitio/dist'],
] as const) {
  if (!existsSync(join(carpeta, 'index.html')) && !existsSync(join(carpeta, 'herramientas'))) {
    console.error(`❌ Falta el build en ${nombre}. Corre «pnpm build».`);
    process.exit(1);
  }
}

if (existsSync(destino) && readdirSync(destino).some((a) => !existsSync(join(origen, a)))) {
  console.error(
    '❌ El sitio generó archivos dentro de /agro/app/, que es del cuaderno. Revisa las rutas.',
  );
  process.exit(1);
}

rmSync(destino, { recursive: true, force: true });
cpSync(origen, destino, { recursive: true });
console.log(
  `✅ Cuaderno copiado a apps/sitio/dist/agro/app/ (${readdirSync(destino).length} entradas)`,
);
