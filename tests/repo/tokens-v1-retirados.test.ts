/**
 * HU-C4.5: los tokens v1 están retirados. `@ed1/tokens/prueba` firma uno solo para comprobar que se
 * rechaza; si una app lo importara, el CORE o una celda podrían volver a emitirlos. Solo lo pueden
 * usar las pruebas, sus arneses (`*.fixture.ts`) y `tests/`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listarArchivos, RAIZ } from '../../scripts/lib/repo.ts';

const esDePrueba = (ruta: string) =>
  /\.test\.tsx?$|\.fixture\.ts$/.test(ruta) || ruta.startsWith('tests/');

function usosFueraDePrueba(archivos: readonly { ruta: string; texto: string }[]): string[] {
  return (
    archivos
      .filter((a) => !esDePrueba(a.ruta) && a.ruta !== 'packages/tokens/src/prueba.ts')
      // Los imports, no las menciones: el comentario de `@ed1/tokens` nombra el ayudante.
      .filter((a) =>
        /from\s+['"](?:@ed1\/tokens\/prueba|[^'"]*tokens\/src\/prueba(?:\.ts)?)['"]/.test(a.texto),
      )
      .map((a) => a.ruta)
  );
}

describe('HU-C4.5 · nadie fuera de las pruebas firma un token v1', () => {
  it('ningún archivo de código importa @ed1/tokens/prueba', () => {
    const archivos = listarArchivos((r) => /^(apps|packages|scripts)\/.+\.tsx?$/.test(r)).map(
      (ruta) => ({ ruta, texto: readFileSync(join(RAIZ, ruta), 'utf8') }),
    );
    expect(usosFueraDePrueba(archivos)).toEqual([]);
  });

  it('❌ lo vería en una app, y no en una prueba ni en un arnés', () => {
    const importa = "import { firmarTokenV1DePrueba } from '@ed1/tokens/prueba';";
    expect(
      usosFueraDePrueba([
        { ruta: 'apps/core/src/entrar.ts', texto: importa },
        { ruta: 'apps/core/src/entrar.test.ts', texto: importa },
        { ruta: 'apps/parqueadero-api/src/prueba.fixture.ts', texto: importa },
        { ruta: 'packages/tokens/src/index.ts', texto: '// `@ed1/tokens/prueba` firma un v1' },
      ]),
    ).toEqual(['apps/core/src/entrar.ts']);
  });
});
