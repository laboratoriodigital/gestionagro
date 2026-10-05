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
  esDocumento,
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
