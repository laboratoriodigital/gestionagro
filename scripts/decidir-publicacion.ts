/**
 * `node scripts/decidir-publicacion.ts`: en el flujo de despliegue, decide qué se publica (HU-C0.3).
 * Lee la versión del agro (raíz), la del CORE y la del parqueadero (HU-Q0.3), pregunta al
 * repositorio remoto si sus etiquetas existen y escribe en `$GITHUB_OUTPUT`: `version_agro`,
 * `publicar_agro`, `version_core`, `publicar_core`, `version_parqueadero`, `publicar_parqueadero`,
 * `version_tienda`, `publicar_tienda` (HU-T0.2) y `productos`. Sin poder preguntar, falla: no se publica a ciegas (P1).
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  decidirPublicacion,
  etiquetaDe,
  type ProductoPublicable,
  SIN_PUBLICAR_AUN,
} from './lib/publicacion.ts';
import { RAIZ } from './lib/repo.ts';

const version = (ruta: string) =>
  (JSON.parse(readFileSync(join(RAIZ, ruta), 'utf8')) as { version: string }).version;

function publicada(producto: ProductoPublicable, v: string): boolean {
  const etiqueta = etiquetaDe(producto, v);
  const r = spawnSync(
    'git',
    ['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${etiqueta}`],
    {
      cwd: RAIZ,
      encoding: 'utf8',
    },
  );
  // 0: existe; 2: no existe (--exit-code). Cualquier otra cosa: no se pudo preguntar.
  if (r.status === 0) return true;
  if (r.status === 2) return false;
  throw new Error(`no se pudo preguntar por ${etiqueta}: ${r.stderr}`);
}

const agro = version('package.json');
const core = version('apps/core/package.json');
const parqueadero = version('apps/parqueadero-sitio/package.json');
const tienda = version('apps/tienda-api/package.json');
const decision = decidirPublicacion(
  { version: agro, publicada: publicada('agro', agro) },
  { version: core, publicada: publicada('core', core) },
  {
    version: parqueadero,
    publicada: parqueadero !== SIN_PUBLICAR_AUN && publicada('parqueadero', parqueadero),
  },
  { version: tienda, publicada: tienda !== SIN_PUBLICAR_AUN && publicada('tienda', tienda) },
);

const lineas = [
  `version_agro=${agro}`,
  `publicar_agro=${decision.publicarAgro}`,
  `version_core=${core}`,
  `publicar_core=${decision.publicarCore}`,
  `version_parqueadero=${parqueadero}`,
  `publicar_parqueadero=${decision.publicarParqueadero}`,
  `version_tienda=${tienda}`,
  `publicar_tienda=${decision.publicarTienda}`,
  `productos=${decision.productos}`,
];
console.log(lineas.join('\n'));
console.log(
  decision.productos
    ? `Se publica y se despliega a producción: ${decision.productos}.`
    : 'Ninguna versión nueva: solo staging.',
);
const salida = process.env['GITHUB_OUTPUT'];
if (salida) appendFileSync(salida, `${lineas.join('\n')}\n`);
