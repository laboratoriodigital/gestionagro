/**
 * Publicación continua (4 oct 2026): al fusionar a main, si la versión de package.json no tiene
 * tag, se publica con su sección del CHANGELOG como notas. Esta prueba cuida que esa sección
 * exista siempre: un PR que sube la versión sin contarla no pasa el CI.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ } from '../../scripts/lib/repo.ts';
import { notasDe, versionDelProducto } from '../../scripts/notas-de-version.ts';

const changelog = readFileSync(join(RAIZ, 'CHANGELOG.md'), 'utf8');

describe('la versión del producto y su CHANGELOG', () => {
  it('la versión de package.json tiene su sección fechada en el CHANGELOG', () => {
    const version = versionDelProducto();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(changelog).toMatch(
      new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm'),
    );
    expect(notasDe(changelog, version)?.length).toBeGreaterThan(20);
  });

  it('las notas son solo las de esa versión, sin el título ni la siguiente', () => {
    const texto =
      '# X\n\n## [Sin publicar]\n\n## [1.1.0] - 2026-10-04\n\n### Agregado\n- Algo nuevo.\n\n## [1.0.0] - 2026-10-01\n\n- Viejo.\n';
    expect(notasDe(texto, '1.1.0')).toBe('### Agregado\n- Algo nuevo.');
    expect(notasDe(texto, '1.0.0')).toBe('- Viejo.');
    expect(notasDe(texto, '2.0.0')).toBeNull();
    // Un punto en la versión no es un comodín: 1.1.0 no encuentra «1x1y0».
    expect(notasDe('## [1x1y0] - 2026-10-04\n- No.\n', '1.1.0')).toBeNull();
  });
});
