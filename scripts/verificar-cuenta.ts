/**
 * `node scripts/verificar-cuenta.ts`: después de `astro build` de la cuenta (HU-C7.2), revisa lo
 * que salió en `apps/cuenta/dist`. Si algo trae JavaScript, estilos en línea o se deja indexar, el
 * build falla: así no llega a desplegarse (P1).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fallasDeLasCabeceras, fallasDeUnaPagina } from './lib/cuenta.ts';
import { RAIZ } from './lib/repo.ts';

const dist = join(RAIZ, 'apps', 'cuenta', 'dist');

const html = (carpeta: string): string[] =>
  readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? html(join(carpeta, e.name))
      : e.name.endsWith('.html')
        ? [join(carpeta, e.name)]
        : [],
  );

const paginas = html(dist);
const fallas = [
  ...(paginas.length === 0 ? ['apps/cuenta/dist no tiene páginas: ¿corrió astro build?'] : []),
  ...paginas.flatMap((p) => fallasDeUnaPagina(relative(dist, p), readFileSync(p, 'utf8'))),
  ...fallasDeLasCabeceras(readFileSync(join(dist, '_headers'), 'utf8')),
  ...(/Disallow:\s*\/\s*$/m.test(readFileSync(join(dist, 'robots.txt'), 'utf8'))
    ? []
    : ['robots.txt no dice «Disallow: /»']),
  ...(['index.html', '404.html'].every((p) => paginas.includes(join(dist, p)))
    ? []
    : ['faltan index.html o 404.html en la raíz de dist']),
];

if (fallas.length > 0) {
  console.error(`❌ La cuenta no cumple lo que promete:\n- ${fallas.join('\n- ')}`);
  process.exit(1);
}
console.log(`✅ Cuenta: ${paginas.length} páginas estáticas, sin JavaScript ni estilos en línea.`);
