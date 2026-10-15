/**
 * HU-C11.8: un PR corre solo las e2e de lo que su cambio puede tocar. Quién usa a quién se lee del
 * código; ante la duda, todas (P1).
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  E2E_DE_LA_APP,
  e2eDelCambio,
  grupoDelSpec,
  leerUsos,
  specsDe,
} from '../../scripts/lib/e2e-afectado.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const usos = leerUsos();
const grupos = (archivos: string[]) => {
  const s = e2eDelCambio(archivos, usos);
  return s.todas ? 'todas' : s.grupos;
};

describe('las e2e de lo afectado, con el repositorio de verdad', () => {
  it('cada app tiene su grupo de e2e, o dice que no tiene', () => {
    const apps = readdirSync(join(RAIZ, 'apps'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    expect(apps.filter((a) => !(a in E2E_DE_LA_APP))).toEqual([]);
  });

  it('la caja o su contenido: solo las del parqueadero', () => {
    expect(grupos(['apps/parqueadero-sitio/src/caja/App.tsx'])).toEqual(['parqueadero']);
    expect(grupos(['content/parqueadero/privacidad/terminos.json'])).toEqual(['parqueadero']);
    expect(grupos(['tests/e2e/parqueadero-caja.spec.ts', 'docs/x.md'])).toEqual(['parqueadero']);
    expect(grupos(['tests/e2e/parqueadero-ayudas.ts'])).toEqual(['parqueadero']);
  });

  it('un paquete que solo usa la caja no corre las del cuaderno', () => {
    expect(grupos(['packages/impresion/src/cola.ts'])).toEqual(['parqueadero']);
    expect(grupos(['packages/parqueadero-tarifas/src/liquidar.ts'])).toEqual(['parqueadero']);
  });

  it('un paquete que usan el cuaderno y la caja corre las dos', () => {
    expect(grupos(['packages/drive/src/index.ts'])).toEqual(['agro', 'parqueadero']);
  });

  it('un paquete de todos corre todas (control negativo de HU-C11.3 CA3)', () => {
    // Los tokens de diseño viven en @ed1/ui, que usan el sitio, el cuaderno, la cuenta y la caja.
    expect(grupos(['packages/ui/src/v2/tokens.css'])).toBe('todas');
  });

  it('el CORE, la celda o una prueba unitaria no cambian lo que sirven las e2e', () => {
    expect(grupos(['apps/core/src/entrar.ts'])).toEqual([]);
    expect(grupos(['apps/api-celda/src/push.ts'])).toEqual([]);
    // @ed1/d1 y los tokens de sesión los usa la API del parqueadero, que sus e2e levantan.
    expect(grupos(['packages/d1/src/sqlite.ts', 'packages/tokens/src/index.ts'])).toEqual([
      'parqueadero',
    ]);
    expect(grupos(['apps/parqueadero-sitio/src/caja/drive.test.ts'])).toEqual([]);
    expect(grupos(['tests/repo/flujos.test.ts', 'tests/integracion/arnes.ts'])).toEqual([]);
  });

  it('el horno o la vitrina corren solo las de la Tienda (HU-T5.4)', () => {
    expect(grupos(['packages/tienda-horno/src/horno.ts'])).toEqual(['tienda']);
    expect(grupos(['apps/tienda-sitio/vitrina/vitrina.css'])).toEqual(['tienda']);
    expect(grupos(['content/tienda/legal/terminos.md'])).toEqual(['tienda']);
    expect(grupoDelSpec('tienda-vitrina')).toBe('tienda');
    expect(specsDe(['tienda'])).toEqual([
      'tests/e2e/tienda-presupuestos.spec.ts',
      'tests/e2e/tienda-vitrina.spec.ts',
    ]);
  });

  it('la galería y la cuenta son del mismo origen', () => {
    expect(grupoDelSpec('galeria')).toBe('cuenta');
    expect(grupos(['apps/cuenta/src/pages/index.astro'])).toEqual(['cuenta']);
  });

  it('❌ lo que no sabe clasificar corre todas, y dice qué', () => {
    expect(e2eDelCambio(null, usos)).toMatchObject({ todas: true });
    expect(e2eDelCambio([], usos)).toMatchObject({ todas: true });
    expect(e2eDelCambio(['apps/tienda/src/main.ts'], usos)).toMatchObject({
      todas: true,
      motivo: expect.stringContaining('tienda'),
    });
    for (const r of [
      'package.json',
      'infrastructure/celdas.json',
      '.github/workflows/ci.yml',
      'infrastructure/migraciones/core/0001_core.sql',
      'content/marca.json',
      'playwright.config.ts',
      // El servidor de las e2e lo nombra playwright.config.ts: todas.
      'scripts/servir-estatico.ts',
    ]) {
      expect(grupos([r]), r).toBe('todas');
    }
  });

  it('un guion corre las e2e de quien lo usa: ninguna si solo lo usan el CI o el despliegue', () => {
    expect(grupos(['scripts/verificar.ts', 'scripts/lib/alcance.ts'])).toEqual([]);
    expect(grupos(['scripts/decidir-publicacion.ts'])).toEqual([]);
  });

  it('los datos de prueba corren las e2e que los importan; el lint y otros flujos, ninguna', () => {
    expect(grupos(['tests/fixtures/fincas.ts'])).toEqual(['agro']);
    expect(grupos(['tests/fixtures/drive-falso.ts'])).toEqual([]);
    expect(grupos(['biome.json', '.github/workflows/desplegar.yml'])).toEqual([]);
    expect(grupos(['infrastructure/migraciones/parqueadero/0001_parqueadero_v1.sql'])).toEqual([
      'parqueadero',
    ]);
  });

  it('una ayuda de las e2e corre las de quien la importa', () => {
    const s = e2eDelCambio(['tests/e2e/ayudas.ts'], usos);
    expect(s.todas || s.grupos.includes('agro')).toBe(true);
    expect(grupos(['tests/e2e/parqueadero-ayudas.ts'])).toEqual(['parqueadero']);
  });

  it('a Playwright le llegan solo los archivos de esos grupos', () => {
    const delParqueadero = specsDe(['parqueadero']);
    expect(delParqueadero.length).toBeGreaterThan(5);
    expect(delParqueadero.every((r) => r.startsWith('tests/e2e/parqueadero-'))).toBe(true);
    expect(specsDe(['cuenta'])).toContain('tests/e2e/galeria.spec.ts');
  });
});

describe('quién usa a quién, con un grafo de ejemplo', () => {
  const ejemplo = new Map<string, Set<string>>([
    ['apps/parqueadero-sitio', new Set(['packages/b', 'content/parqueadero'])],
    ['apps/cuaderno', new Set(['packages/c'])],
    ['packages/b', new Set(['packages/a'])],
    ['packages/c', new Set(['packages/a'])],
  ]);

  it('sigue los usos indirectos: a la usan b y c, y las usan dos apps', () => {
    const s = e2eDelCambio(['packages/a/src/x.ts'], ejemplo);
    expect(s).toEqual({
      todas: false,
      grupos: ['agro', 'parqueadero'],
      motivo: expect.any(String),
    });
  });

  it('un paquete que ninguna app usa no corre e2e', () => {
    expect(e2eDelCambio(['packages/z/src/x.ts'], ejemplo)).toMatchObject({ grupos: [] });
  });
});
