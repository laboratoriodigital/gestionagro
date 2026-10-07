/**
 * Las bitácoras no se duplican (bitácora parqueadero 25): un `String.replace` con `$\`` en el texto
 * metió una copia entera de la del parqueadero dentro de una entrada, y pasó el lint, las pruebas y
 * la revisión. Aquí: cada sección de segundo nivel y cada número de entrada, una sola vez.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listarArchivos, RAIZ } from '../../scripts/lib/repo.ts';

const BITACORAS = listarArchivos((r) => /^docs\/.*BITACORA[^/]*\.md$/i.test(r));

/** Lo que aparece más de una vez. */
function repetidos(valores: readonly string[]): string[] {
  const vistos = new Set<string>();
  return [...new Set(valores.filter((v) => vistos.has(v) || !vistos.add(v)))];
}

function problemas(md: string): string[] {
  const secciones = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1] ?? '');
  // Las entradas se escriben `**12 · …**` al principio de la línea.
  const entradas = [...md.matchAll(/^\*\*(\d+) · /gm)].map((m) => m[1] ?? '');
  return [
    ...repetidos(secciones).map((s) => `la sección «${s}» está más de una vez`),
    ...repetidos(entradas).map((n) => `la entrada ${n} está más de una vez`),
  ];
}

describe('las bitácoras', () => {
  it('se encuentran', () => {
    expect(BITACORAS).toContain('docs/parking/BITACORA-PARKING.md');
  });

  it.each(BITACORAS)('%s no repite secciones ni entradas', (rel) => {
    expect(problemas(readFileSync(join(RAIZ, rel), 'utf8'))).toEqual([]);
  });

  it('control: la bitácora con su copia adentro se ve en rojo', () => {
    const una = '## Lo aprendido\n\n**1 · Algo.**\n\n**2 · Otra.**\n';
    expect(problemas(`${una}\ntexto\n${una}`)).toEqual([
      'la sección «Lo aprendido» está más de una vez',
      'la entrada 1 está más de una vez',
      'la entrada 2 está más de una vez',
    ]);
  });
});
