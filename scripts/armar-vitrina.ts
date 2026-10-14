/**
 * `node scripts/armar-vitrina.ts`: arma los archivos comunes de la vitrina (HU-T3.3 y HU-T3.4) en
 * `apps/tienda-sitio/dist/_t/<release>/`, que se sirven como assets, sin ejecutar el Worker:
 *
 * - `vitrina.css`: los tokens y las fuentes del ecosistema (`@ed1/ui` v2, P2) y la hoja de la
 *   vitrina, en un solo archivo;
 * - `fuentes/`: Geist y Geist Mono recortadas, con su licencia (D-T2: las del ecosistema, sin otra);
 * - `vitrina.js` y sus módulos: la isla de `@ed1/tienda-horno/src/vitrina/`, sin tipos.
 *
 * `<release>` es la huella del contenido: un cambio en cualquier archivo cambia la carpeta, así una
 * tienda horneada con una versión nunca recibe estilos de otra. El horno la recibe del despliegue
 * (`VITRINA_RELEASE`).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join } from 'node:path';
import { RAIZ } from './lib/repo.ts';

const UI = join(RAIZ, 'packages', 'ui', 'src', 'v2');
const ISLA = join(RAIZ, 'packages', 'tienda-horno', 'src', 'vitrina');
const HOJA = join(RAIZ, 'apps', 'tienda-sitio', 'vitrina', 'vitrina.css');
export const DIST_VITRINA = join(RAIZ, 'apps', 'tienda-sitio', 'dist');

/** Los archivos de la vitrina, por ruta relativa a su release, y la huella que la nombra. */
export function archivosDeLaVitrina(): { release: string; archivos: Map<string, Buffer> } {
  const archivos = new Map<string, Buffer>();
  const css = [
    readFileSync(join(UI, 'tokens.css'), 'utf8'),
    readFileSync(join(UI, 'fuentes.css'), 'utf8'),
    readFileSync(HOJA, 'utf8'),
  ].join('\n');
  archivos.set('vitrina.css', Buffer.from(css));
  for (const f of readdirSync(join(UI, 'fuentes')).sort()) {
    archivos.set(`fuentes/${f}`, readFileSync(join(UI, 'fuentes', f)));
  }
  for (const f of readdirSync(ISLA)
    .filter((x) => x.endsWith('.ts') && !x.endsWith('.test.ts'))
    .sort()) {
    const js = stripTypeScriptTypes(readFileSync(join(ISLA, f), 'utf8')).replace(
      /from '(\.\/[a-z-]+)\.ts'/g,
      "from '$1.js'",
    );
    archivos.set(f.replace(/\.ts$/, '.js'), Buffer.from(js));
  }
  const h = createHash('sha256');
  for (const [ruta, contenido] of [...archivos].sort(([a], [b]) => (a < b ? -1 : 1))) {
    h.update(ruta).update(contenido);
  }
  return { release: h.digest('hex').slice(0, 12), archivos };
}

/** Las cabeceras de los assets: lo de una release no cambia nunca. */
export const CABECERAS_DE_LA_VITRINA = [
  '/_t/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '  X-Content-Type-Options: nosniff',
  '',
].join('\n');

if (process.argv[1]?.endsWith('armar-vitrina.ts')) {
  const { release, archivos } = archivosDeLaVitrina();
  rmSync(DIST_VITRINA, { recursive: true, force: true });
  for (const [ruta, contenido] of archivos) {
    const destino = join(DIST_VITRINA, '_t', release, ruta);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, contenido);
  }
  writeFileSync(join(DIST_VITRINA, '_headers'), CABECERAS_DE_LA_VITRINA);
  console.log(`✅ Vitrina armada en apps/tienda-sitio/dist/_t/${release}`);
}
