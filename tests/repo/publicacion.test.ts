/**
 * HU-C0.3: el agro y el CORE se publican cada uno con su versión, y a producción va solo lo que
 * subió. Cada caso es una fila de la tabla de BACKLOG_CORE §2.3.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  cambiaElCodigoDelCore,
  decidirPublicacion,
  etiquetaDe,
  productosADesplegar,
  seccionesReescritas,
} from '../../scripts/lib/publicacion.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';
import { CHANGELOG_DEL_CORE, notasDe, versionDelCore } from '../../scripts/notas-de-version.ts';

const nueva = (version: string) => ({ version, publicada: false });
const vieja = (version: string) => ({ version, publicada: true });

describe('qué se publica al fusionar', () => {
  it.each([
    ['nada nuevo: solo staging', vieja('0.3.0'), vieja('0.1.0'), false, false, ''],
    [
      'sube el agro: solo el agro va a producción',
      nueva('0.4.0'),
      vieja('0.1.0'),
      true,
      false,
      'agro',
    ],
    ['sube el CORE: solo el CORE', vieja('0.3.0'), nueva('0.2.0'), false, true, 'core'],
    [
      'suben los dos: los dos, el CORE primero',
      nueva('0.4.0'),
      nueva('0.2.0'),
      true,
      true,
      'core,agro',
    ],
  ] as const)('%s', (_caso, agro, core, publicarAgro, publicarCore, productos) => {
    expect(decidirPublicacion(agro, core)).toEqual({ publicarAgro, publicarCore, productos });
  });

  it('una versión que no es x.y.z no se publica: se dice (P1)', () => {
    expect(() => decidirPublicacion(nueva('0.4'), vieja('0.1.0'))).toThrow(/no es x.y.z/);
  });

  it('las etiquetas del agro siguen siendo vX.Y.Z y las del CORE, core-vX.Y.Z', () => {
    expect(etiquetaDe('agro', '0.4.0')).toBe('v0.4.0');
    expect(etiquetaDe('core', '0.2.0')).toBe('core-v0.2.0');
  });
});

describe('qué despliega desplegar.ts', () => {
  it('sin la opción, todo (staging y el «Run workflow» a mano)', () => {
    expect([...productosADesplegar(undefined)]).toEqual(['core', 'agro']);
    expect([...productosADesplegar('')]).toEqual(['core', 'agro']);
  });

  it('solo lo que se le pide, y rechaza un producto que no existe', () => {
    expect([...productosADesplegar('core')]).toEqual(['core']);
    expect(() => productosADesplegar('core,tienda')).toThrow(/tienda/);
  });

  it('el flujo de producción le pasa los productos que decidió la publicación', () => {
    const flujo = parse(readFileSync(join(RAIZ, '.github/workflows/desplegar.yml'), 'utf8'));
    // biome-ignore lint/suspicious/noTemplateCurlyInString: es una expresión de GitHub Actions
    expect(flujo.jobs.produccion.with.productos).toBe('${{ needs.version.outputs.productos }}');
    const destino = readFileSync(join(RAIZ, '.github/workflows/desplegar-destino.yml'), 'utf8');
    expect(destino).toContain('--productos "$PRODUCTOS"');
  });
});

describe('la guardia del PR: el código del CORE se anota en su CHANGELOG', () => {
  it('detecta un cambio en el código del CORE, no en sus pruebas', () => {
    expect(cambiaElCodigoDelCore(['apps/core/src/entrar.ts'])).toBe(true);
    expect(cambiaElCodigoDelCore(['apps/core/src/entrar.test.ts'])).toBe(false);
    expect(cambiaElCodigoDelCore(['apps/cuaderno/src/main.ts', 'docs/x.md'])).toBe(false);
  });
});

describe('la versión del CORE y su CHANGELOG', () => {
  const changelog = readFileSync(join(RAIZ, CHANGELOG_DEL_CORE), 'utf8');

  it('la versión de apps/core/package.json tiene su sección fechada en apps/core/CHANGELOG.md', () => {
    const version = versionDelCore();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(changelog).toMatch(
      new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm'),
    );
    expect(notasDe(changelog, version)?.length).toBeGreaterThan(20);
  });

  it('tiene su sección «Sin publicar», donde la guardia pide anotar', () => {
    expect(changelog).toMatch(/^## \[Sin publicar\]$/m);
  });
});

describe('una versión publicada no se reescribe (bitácora core 6)', () => {
  const publicada =
    '# X\n\n## [Sin publicar]\n\n## [0.4.0] - 2026-10-06\n\n### Agregado\n- Lo de la 0.4.0.\n\n## [0.3.0]\n\n- Viejo.\n';

  it('lo nuevo en «Sin publicar» no toca la versión publicada', () => {
    const despues = publicada.replace(
      '## [Sin publicar]\n',
      '## [Sin publicar]\n\n### Agregado\n- Lo nuevo.\n',
    );
    expect(
      seccionesReescritas(despues, [{ version: '0.4.0', changelog: publicada }], notasDe),
    ).toEqual([]);
  });

  it('control negativo: lo que pasó el 6 oct 2026, una entrada nueva dentro de la versión publicada', () => {
    const despues = publicada.replace(
      '- Lo de la 0.4.0.\n',
      '- Lo nuevo del sprint siguiente.\n- Lo de la 0.4.0.\n',
    );
    expect(
      seccionesReescritas(despues, [{ version: '0.4.0', changelog: publicada }], notasDe),
    ).toEqual(['0.4.0']);
  });
});
