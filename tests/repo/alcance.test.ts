/**
 * HU-C11.6: el CI gasta según lo que cambió. Solo se ahorra cuando se SABE que todo es
 * documentación; ante la duda, corre todo (P1).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  archivosDeDiff,
  decidirAlcance,
  esDeLaBase,
  esDelParqueadero,
  esDocumento,
  instrumentoParaElCambio,
  leeDocumentos,
} from '../../scripts/lib/alcance.ts';
import { listarArchivos, RAIZ } from '../../scripts/lib/repo.ts';
import { resumir } from '../../scripts/lib/resumen.ts';

describe('qué es un documento', () => {
  it.each([
    'docs/BACKLOG.md',
    'docs/plataforma/sql/core/0006_dimension_de_producto.sql',
    'CHANGELOG.md',
    'README.md',
    'docs\\plataforma\\BITACORA_CORE.md',
  ])('«%s» es documento', (ruta) => {
    expect(esDocumento(ruta)).toBe(true);
  });

  it.each([
    // content/ es Markdown, pero alimenta el sitio y el build (CA2).
    'content/agro/calculadora-dpv/01-que-es.md',
    'apps/core/README.md',
    'apps/core/src/worker.ts',
    '.github/workflows/ci.yml',
    'package.json',
    'infrastructure/celdas.json',
    'documentos.ts',
  ])('«%s» no es documento', (ruta) => {
    expect(esDocumento(ruta)).toBe(false);
  });
});

describe('decidir el alcance', () => {
  it('solo documentos: ahorra, y dice por qué', () => {
    const a = decidirAlcance(['docs/BACKLOG.md', 'CHANGELOG.md']);
    expect(a).toEqual({
      soloDocumentos: true,
      soloParqueadero: false,
      motivo: 'los 2 archivos cambiados son documentos',
    });
  });

  it('un archivo de content/ entre documentos hace correr todo (control negativo de CA2)', () => {
    const a = decidirAlcance(['docs/BACKLOG.md', 'content/agro/calculadora-dpv/01-que-es.md']);
    expect(a.soloDocumentos).toBe(false);
    expect(a.motivo).toContain('content/agro/calculadora-dpv/01-que-es.md');
  });

  it('sin poder calcular el cambio, corre todo y lo dice (CA3)', () => {
    expect(decidirAlcance(null)).toEqual({
      soloDocumentos: false,
      soloParqueadero: false,
      motivo: 'no se pudo calcular qué cambió: corre todo',
    });
  });

  it('sin archivos cambiados, corre todo: «nada» no es «solo documentos»', () => {
    expect(decidirAlcance([]).soloDocumentos).toBe(false);
  });

  it('nombra como mucho tres archivos que no son documentos', () => {
    const a = decidirAlcance(['a.ts', 'b.ts', 'c.ts', 'd.ts']);
    expect(a.motivo).toBe('cambia código o contenido (a.ts, b.ts, c.ts, …): corre todo');
  });

  it('lee la salida de git diff con finales de línea de Windows', () => {
    expect(archivosDeDiff('docs/a.md\r\nCHANGELOG.md\r\n\r\n')).toEqual([
      'docs/a.md',
      'CHANGELOG.md',
    ]);
  });
});

describe('el e2e de lo afectado: el parqueadero (HU-C11.3)', () => {
  it.each([
    'apps/parqueadero-sitio/src/caja/App.tsx',
    'apps/parqueadero-api/src/push.ts',
    'packages/parqueadero-schema/src/sync.ts',
    'content/parqueadero/aviso-tarifas.json',
    'infrastructure/migraciones/parqueadero/0001_parqueadero_v1.sql',
    'tests/e2e/parqueadero-caja.spec.ts',
    'tests/integracion/parqueadero-arnes.ts',
    'apps\\parqueadero-sitio\\src\\caja\\App.tsx',
  ])('«%s» es del parqueadero', (ruta) => {
    expect(esDelParqueadero(ruta)).toBe(true);
  });

  it.each([
    // Compartidos: los usan el cuaderno, la cuenta o el sitio (CA3).
    'packages/sync/src/index.ts',
    'packages/impresion/src/escpos.ts',
    'packages/ui/src/estilos.css',
    'scripts/lib/cabeceras-parqueadero.ts',
    'infrastructure/celdas.json',
    'package.json',
    'pnpm-lock.yaml',
    'tests/repo/parqueadero-sitio.test.ts',
    'apps/parqueadero.ts',
  ])('«%s» no es solo del parqueadero', (ruta) => {
    expect(esDelParqueadero(ruta)).toBe(false);
  });

  it('código del parqueadero y documentos: solo sus e2e, y lo dice', () => {
    expect(
      decidirAlcance([
        'apps/parqueadero-sitio/src/caja/App.tsx',
        'docs/parking/BACKLOG-PARKING.md',
        'apps/parqueadero-sitio/CHANGELOG.md',
      ]),
    ).toEqual({
      soloDocumentos: false,
      soloParqueadero: true,
      motivo: 'los 2 archivos de código cambiados son del parqueadero: solo sus e2e',
    });
  });

  it('un paquete compartido junto al parqueadero corre todo (control negativo de CA3)', () => {
    const a = decidirAlcance([
      'apps/parqueadero-sitio/src/caja/App.tsx',
      'packages/impresion/src/escpos.ts',
    ]);
    expect(a.soloParqueadero).toBe(false);
    expect(a.motivo).toContain('packages/impresion/src/escpos.ts');
  });

  it('solo documentos no es «solo parqueadero»: salta el e2e entero', () => {
    expect(decidirAlcance(['docs/parking/BITACORA-PARKING.md']).soloParqueadero).toBe(false);
  });

  it('nada fuera del parqueadero importa sus paquetes ni sus apps', () => {
    const ajenos = listarArchivos(
      (r) =>
        /^(apps|packages|scripts)\//.test(r) &&
        /\.(tsx?|astro|m?js)$/.test(r) &&
        !esDelParqueadero(r) &&
        !r.startsWith('scripts/'),
    ).filter((r) =>
      /from ['"](@ed1\/parqueadero-|[./]+\/(apps\/)?parqueadero-)/.test(
        readFileSync(join(RAIZ, r), 'utf8'),
      ),
    );
    expect(ajenos).toEqual([]);
  });
});

describe('el D1 de workerd solo cuando el cambio toca la base (HU-C11.8)', () => {
  it.each([
    'apps/core/src/entrar.ts',
    'apps/api-celda/src/push.ts',
    'apps/parqueadero-api/src/dispositivos.ts',
    'packages/d1/src/sqlite.ts',
    'infrastructure/migraciones/parqueadero/0001_parqueadero_v1.sql',
    'tests/integracion/arnes.ts',
    'pnpm-lock.yaml',
  ])('«%s» toca la base: workerd', (ruta) => {
    expect(instrumentoParaElCambio(['docs/x.md', ruta])).toBe('workerd');
  });

  it('la caja, el sitio o un paquete sin SQL no tocan la base: la base en proceso', () => {
    expect(
      instrumentoParaElCambio([
        'apps/parqueadero-sitio/src/caja/drive.ts',
        'packages/drive/src/index.ts',
        'apps/cuaderno/src/main.ts',
        'docs/BACKLOG.md',
      ]),
    ).toBe('sqlite');
  });

  it('sin poder calcular el cambio, el fiel (control negativo, P1)', () => {
    expect(instrumentoParaElCambio(null)).toBe('workerd');
    expect(instrumentoParaElCambio([])).toBe('workerd');
  });

  it('todo código con SQL vive en una ruta que la regla reconoce', () => {
    const conSql = listarArchivos(
      (r) => /^(apps|packages|scripts)\//.test(r) && /\.tsx?$/.test(r) && !/\.test\.tsx?$/.test(r),
    ).filter((r) => /\.prepare\(|\.batch\(|D1Database/.test(readFileSync(join(RAIZ, r), 'utf8')));
    expect(conSql.length).toBeGreaterThan(10);
    expect(conSql.filter((r) => !esDeLaBase(r))).toEqual([]);
  });
});

describe('las pruebas que leen documentos', () => {
  const queLeen = listarArchivos((r) => r.endsWith('.test.ts')).filter((r) =>
    leeDocumentos(readFileSync(join(RAIZ, r), 'utf8')),
  );

  it('incluyen las que leen ARQUITECTURA, el CHANGELOG y la bitácora', () => {
    for (const prueba of [
      'tests/repo/version.test.ts',
      'tests/repo/flujos.test.ts',
      'apps/core/src/core.test.ts',
    ]) {
      expect(queLeen).toContain(prueba);
    }
  });

  it('no incluyen una prueba de lógica pura (la selección no es «todas»)', () => {
    expect(queLeen).not.toContain('packages/agro-calc/src/dpv.test.ts');
    expect(queLeen.length).toBeLessThan(listarArchivos((r) => r.endsWith('.test.ts')).length / 2);
  });

  it('reconoce las formas de nombrar un documento', () => {
    expect(leeDocumentos("join(RAIZ, 'docs', 'ARQUITECTURA.md')")).toBe(true);
    expect(leeDocumentos("readFileSync('CHANGELOG.md')")).toBe(true);
    expect(leeDocumentos('const x = 1;')).toBe(false);
  });
});

describe('el resumen dice lo saltado', () => {
  it('lo saltado cuenta en verde y dice el motivo', () => {
    const texto = resumir([
      { paso: 'lint', ok: true, segundos: 2 },
      { paso: 'build', ok: true, saltado: 'solo cambiaron documentos', segundos: 0 },
    ]);
    expect(texto).toContain('| ➖ | build | saltado: solo cambiaron documentos |');
    expect(texto).toContain('Todo en verde.');
  });
});
