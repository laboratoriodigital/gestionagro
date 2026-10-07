/**
 * Los runbooks del parqueadero no mienten (HU-Q6.2 CA3, P18): cada texto de la caja que nombran
 * en negrita y entre comillas (**«Guardar»**) existe en la caja, y cada archivo que citan existe.
 * Un botón renombrado sin tocar el runbook pone esto en rojo.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listarArchivos, RAIZ } from '../../scripts/lib/repo.ts';

/** Los cinco de HU-Q6.2 CA1. */
const RUNBOOKS = [
  'parqueadero-puesta-en-marcha.md',
  'parqueadero-impresora-no-imprime.md',
  'parqueadero-cambio-de-topes.md',
  'parqueadero-restaurar-caja.md',
  'parqueadero-arreglos-en-congelamiento.md',
] as const;

const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');

/** Todo el texto que la caja puede mostrar: su código, sin pruebas. */
const textoDeLaCaja = listarArchivos(
  (r) => /^apps\/parqueadero-sitio\/src\/.+\.tsx?$/.test(r) && !/\.test\.tsx?$/.test(r),
)
  .map(leer)
  .join('\n');

/** Lo que un runbook dice que se ve en la caja: `**«…»**`. */
function textosDePantalla(md: string): string[] {
  return [...md.matchAll(/\*\*«([^»]+)»\*\*/g)].map((m) => m[1] ?? '');
}

/** Los archivos del repositorio que cita entre acentos graves. */
function archivosCitados(md: string): string[] {
  return [
    ...md.matchAll(/`((?:apps|packages|content|docs|scripts|tests|infrastructure)\/[^`\s]+)`/g),
  ].map((m) => m[1] ?? '');
}

/** Las capturas (CA2): imágenes relativas a `docs/runbooks/`. */
function imagenesCitadas(md: string): string[] {
  return [...md.matchAll(/!\[[^\]]*\]\((img\/[^)\s]+)\)/g)].map((m) => `docs/runbooks/${m[1]}`);
}

const faltantes = (md: string) => ({
  textos: textosDePantalla(md).filter((t) => !textoDeLaCaja.includes(t)),
  archivos: [...archivosCitados(md), ...imagenesCitadas(md)].filter(
    (a) => !existsSync(join(RAIZ, a)),
  ),
});

describe('los runbooks del parqueadero (HU-Q6.2)', () => {
  it('están los cinco (CA1)', () => {
    for (const r of RUNBOOKS) expect(existsSync(join(RAIZ, 'docs', 'runbooks', r)), r).toBe(true);
  });

  it.each(RUNBOOKS)('%s nombra solo textos y archivos que existen (CA3)', (r) => {
    const md = leer(`docs/runbooks/${r}`);
    expect(textosDePantalla(md).length + archivosCitados(md).length).toBeGreaterThan(0);
    expect(faltantes(md)).toEqual({ textos: [], archivos: [] });
  });

  it('control: un botón que no existe y un archivo que no está se ven en rojo (CA3 ❌)', () => {
    const md =
      'Toque **«Botón que nunca existió»**, abra `docs/parking/no-existe.md` y mire ![x](img/no-existe.png).';
    expect(faltantes(md)).toEqual({
      textos: ['Botón que nunca existió'],
      archivos: ['docs/parking/no-existe.md', 'docs/runbooks/img/no-existe.png'],
    });
  });

  it('el de la impresora y el de la puesta en marcha llevan capturas (CA2)', () => {
    for (const r of RUNBOOKS.slice(0, 2)) {
      expect(imagenesCitadas(leer(`docs/runbooks/${r}`)).length, r).toBeGreaterThan(0);
    }
  });
});
