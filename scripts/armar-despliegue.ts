/**
 * `node scripts/armar-despliegue.ts`: une el build del cuaderno al del sitio en
 * `apps/sitio/dist/agro/app/`, que es lo que sube el Worker del sitio (ADR-19, HU-E1.5).
 *
 * También escribe `_headers` con la CSP del cuaderno (`scripts/lib/cabeceras.ts`).
 *
 * Se niega a pisar algo: si el sitio ya generó una página dentro de `/agro/app/`, dos productos
 * se estarían disputando la misma ruta, y eso se decide a mano.
 */
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { RUTAS_APP } from '../apps/cuaderno/src/rutas.ts';
import { textoDeCabeceras } from './lib/cabeceras.ts';
import { cargarCeldas } from './lib/celdas.ts';
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

const esRutaDeLaApp = (nombre: string) => RUTAS_APP.some((r) => r.segmento === nombre);
if (
  existsSync(destino) &&
  readdirSync(destino).some((a) => !existsSync(join(origen, a)) && !esRutaDeLaApp(a))
) {
  console.error(
    '❌ El sitio generó archivos dentro de /agro/app/, que es del cuaderno. Revisa las rutas.',
  );
  process.exit(1);
}

rmSync(destino, { recursive: true, force: true });
cpSync(origen, destino, { recursive: true });
// Un index.html en cada ruta de la app: un enlace directo abre sin depender del service worker.
for (const { segmento } of RUTAS_APP) {
  if (!segmento) continue;
  mkdirSync(join(destino, segmento), { recursive: true });
  copyFileSync(join(destino, 'index.html'), join(destino, segmento, 'index.html'));
}
// Cabeceras de seguridad del cuaderno (CSP), desde celdas.json (ARQUITECTURA §9, HU-E0.5).
writeFileSync(join(sitio, '_headers'), textoDeCabeceras(cargarCeldas()));
console.log(
  `✅ Cuaderno copiado a apps/sitio/dist/agro/app/ (${readdirSync(destino).length} entradas)`,
);
