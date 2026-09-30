import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  nombreDePaqueteValido,
  revisarDependencias,
  revisarPackageJson,
  revisarScripts,
} from '../../scripts/lib/package-json.ts';
import { listarArchivos, RAIZ } from '../../scripts/lib/repo.ts';

describe('scripts de package.json sin shell (P3)', () => {
  it('acepta scripts que corren igual en Windows y en Linux', () => {
    const buenos = {
      lint: 'biome check .',
      typecheck: 'tsc --noEmit -p tsconfig.json',
      verificar: 'node scripts/verificar.ts',
      build: 'pnpm -r --if-present run build',
    };
    expect(revisarScripts('package.json', buenos)).toEqual([]);
  });

  // Control negativo: cada defecto tiene que verse en rojo.
  it.each([
    ['bash scripts/x', 'invoca bash o sh'],
    ['sh -c "echo hola"', 'invoca bash o sh'],
    ['./desplegar.sh', 'ejecuta un archivo .sh'],
    ['node /usr/local/lib/x.js', 'usa una ruta absoluta con / fija'],
    ['rm -rf dist', 'usa un comando POSIX'],
    ['export NODE_ENV=test && vitest', 'usa un comando POSIX'],
    ['vitest --dir $HOME', 'expande una variable con sintaxis POSIX'],
  ])('rechaza «%s»', (comando, motivo) => {
    const hallazgos = revisarScripts('package.json', { malo: comando });
    expect(hallazgos.map((h) => h.motivo).join(' | ')).toContain(motivo);
  });
});

describe('claves de dependencias (bitácora ecommerce, «nota en devDependencies»)', () => {
  it.each(['vitest', '@biomejs/biome', '@types/node', 'fake-indexeddb'])('acepta %s', (nombre) => {
    expect(nombreDePaqueteValido(nombre)).toBe(true);
  });

  it.each(['_comentario_sharp', '.oculto', 'ConMayusculas', '', 'con espacio'])(
    'rechaza «%s»',
    (nombre) => {
      expect(nombreDePaqueteValido(nombre)).toBe(false);
    },
  );

  it('nombra la clave inválida dentro de devDependencies', () => {
    const hallazgos = revisarDependencias('apps/x/package.json', {
      devDependencies: { vitest: '^5', _nota: 'explicación' },
    });
    expect(hallazgos).toEqual([
      expect.objectContaining({ archivo: 'apps/x/package.json', clave: 'devDependencies._nota' }),
    ]);
  });
});

describe('los package.json del repositorio', () => {
  const archivos = listarArchivos((rel) => rel === 'package.json' || rel.endsWith('/package.json'));

  it('incluye al menos el de la raíz', () => {
    expect(archivos).toContain('package.json');
  });

  it('cumplen las reglas de scripts y dependencias', () => {
    const hallazgos = archivos.flatMap((archivo) =>
      revisarPackageJson(archivo, JSON.parse(readFileSync(join(RAIZ, archivo), 'utf8'))),
    );
    expect(hallazgos).toEqual([]);
  });
});
