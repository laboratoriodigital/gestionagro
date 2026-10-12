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
  cambiaElParqueadero,
  decidirPublicacion,
  etiquetaDe,
  productosADesplegar,
  seccionesReescritas,
} from '../../scripts/lib/publicacion.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';
import {
  CHANGELOG_DEL_CORE,
  CHANGELOG_DEL_PARQUEADERO,
  notasDe,
  versionDelCore,
  versionDelParqueadero,
} from '../../scripts/notas-de-version.ts';

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
    expect(decidirPublicacion(agro, core)).toEqual({
      publicarAgro,
      publicarCore,
      publicarParqueadero: false,
      productos,
    });
  });

  // HU-Q0.3: el parqueadero, el tercero con versión propia.
  it.each([
    ['en 0.0.0 no se publica: vive en staging', nueva('0.0.0'), false, ''],
    ['sube el parqueadero: solo el parqueadero', nueva('0.1.0'), true, 'parqueadero'],
    ['ya publicado: nada', vieja('0.1.0'), false, ''],
  ] as const)('%s', (_caso, parqueadero, publicarParqueadero, productos) => {
    expect(decidirPublicacion(vieja('0.3.0'), vieja('0.1.0'), parqueadero)).toEqual({
      publicarAgro: false,
      publicarCore: false,
      publicarParqueadero,
      productos,
    });
  });

  it('suben los tres: el CORE, el agro y el parqueadero', () => {
    expect(decidirPublicacion(nueva('0.5.0'), nueva('0.4.0'), nueva('0.1.0')).productos).toBe(
      'core,agro,parqueadero',
    );
  });

  it('una versión que no es x.y.z no se publica: se dice (P1)', () => {
    expect(() => decidirPublicacion(nueva('0.4'), vieja('0.1.0'))).toThrow(/no es x.y.z/);
  });

  it('las etiquetas del agro siguen siendo vX.Y.Z y las del CORE, core-vX.Y.Z', () => {
    expect(etiquetaDe('agro', '0.4.0')).toBe('v0.4.0');
    expect(etiquetaDe('core', '0.2.0')).toBe('core-v0.2.0');
    expect(etiquetaDe('parqueadero', '0.1.0')).toBe('parqueadero-v0.1.0');
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
    expect([...productosADesplegar('parqueadero')]).toEqual(['parqueadero']);
  });

  it('el flujo de producción le pasa los productos que decidió la publicación', () => {
    const flujo = parse(readFileSync(join(RAIZ, '.github/workflows/desplegar.yml'), 'utf8'));
    // biome-ignore lint/suspicious/noTemplateCurlyInString: es una expresión de GitHub Actions
    expect(flujo.jobs.produccion.with.productos).toBe('${{ needs.staging.outputs.productos }}');
    const destino = readFileSync(join(RAIZ, '.github/workflows/desplegar-destino.yml'), 'utf8');
    expect(destino).toContain('--productos "$PRODUCTOS"');
  });

  it('staging decide la publicación al terminar, sin un trabajo aparte que cobra un minuto (HU-C11.8)', () => {
    const flujo = parse(readFileSync(join(RAIZ, '.github/workflows/desplegar.yml'), 'utf8'));
    expect(flujo.jobs.version).toBeUndefined();
    expect(flujo.jobs.staging.with.decidir_publicacion).toBe(true);
    expect(flujo.jobs.publicar.needs).toBe('staging');
    expect(flujo.jobs.produccion.needs).toEqual(['staging', 'publicar']);
    const destino = parse(
      readFileSync(join(RAIZ, '.github/workflows/desplegar-destino.yml'), 'utf8'),
    );
    const pasos = destino.jobs.desplegar.steps as { id?: string; if?: string; run?: string }[];
    const leer = pasos.findIndex((p) => p.id === 'leer');
    // Después de desplegar: si staging falla, no se publica nada.
    expect(leer).toBeGreaterThan(pasos.findIndex((p) => p.run?.includes('scripts/desplegar.ts')));
    expect(pasos[leer]?.if).toBe('inputs.decidir_publicacion');
    expect(pasos[leer]?.run).toBe('node scripts/decidir-publicacion.ts');
    expect(destino.on.workflow_call.outputs.productos.value).toBe(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: es una expresión de GitHub Actions
      '${{ jobs.desplegar.outputs.productos }}',
    );
  });
});

describe('la guardia del PR: el código del CORE se anota en su CHANGELOG', () => {
  it('detecta un cambio en el código del CORE, no en sus pruebas', () => {
    expect(cambiaElCodigoDelCore(['apps/core/src/entrar.ts'])).toBe(true);
    expect(cambiaElCodigoDelCore(['apps/core/src/entrar.test.ts'])).toBe(false);
    expect(cambiaElCodigoDelCore(['apps/cuaderno/src/main.ts', 'docs/x.md'])).toBe(false);
  });

  it('y el del parqueadero en el suyo (HU-Q0.3 CA3 ❌)', () => {
    expect(cambiaElParqueadero(['apps/parqueadero-sitio/src/caja/Salida.tsx'])).toBe(true);
    expect(cambiaElParqueadero(['packages/parqueadero-tarifas/src/liquidar.ts'])).toBe(true);
    expect(cambiaElParqueadero(['apps/parqueadero-sitio/src/pages/r/index.astro'])).toBe(true);
    expect(cambiaElParqueadero(['packages/parqueadero-schema/src/registro.test.ts'])).toBe(false);
    expect(cambiaElParqueadero(['packages/impresion/src/cola.ts', 'docs/parking/x.md'])).toBe(
      false,
    );
  });

  it('el flujo crea la versión del parqueadero con su etiqueta y sus notas', () => {
    const flujo = readFileSync(join(RAIZ, '.github/workflows/desplegar.yml'), 'utf8');
    expect(flujo).toContain("needs.staging.outputs.publicar_parqueadero == 'true'");
    expect(flujo).toContain('node scripts/notas-de-version.ts --parqueadero "$VERSION"');
    expect(flujo).toContain('gh release create "parqueadero-v$VERSION"');
  });
});

describe('la versión del parqueadero y su CHANGELOG (HU-Q0.3)', () => {
  const changelog = readFileSync(join(RAIZ, CHANGELOG_DEL_PARQUEADERO), 'utf8');

  it('tiene «Sin publicar», y una versión que no es 0.0.0 tiene su sección fechada', () => {
    expect(changelog).toMatch(/^## \[Sin publicar\]$/m);
    const version = versionDelParqueadero();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    if (version !== '0.0.0') {
      expect(changelog).toMatch(
        new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm'),
      );
      expect(notasDe(changelog, version)?.length).toBeGreaterThan(20);
    }
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
