import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  type Flujo,
  revisarConcurrencia,
  revisarInyeccion,
  revisarPipefail,
  revisarSecretos,
  revisarTiempos,
  secretosDocumentados,
} from '../../scripts/lib/flujos.ts';
import { listarArchivos, RAIZ } from '../../scripts/lib/repo.ts';

const flujo = (yaml: string): Flujo => parse(yaml) as Flujo;

describe('guardia de pipefail (P14)', () => {
  it('rechaza «| tee» sin set -o pipefail', () => {
    const f = flujo(`
jobs:
  a:
    steps:
      - name: pruebas
        run: pnpm test | tee salida.txt
`);
    expect(revisarPipefail('x.yml', f)).toEqual([
      expect.objectContaining({ motivo: expect.stringContaining('paso «pruebas»') }),
    ]);
  });

  it('acepta «| tee» con set -o pipefail', () => {
    const f = flujo(`
jobs:
  a:
    steps:
      - run: |
          set -o pipefail
          pnpm test | tee salida.txt
`);
    expect(revisarPipefail('x.yml', f)).toEqual([]);
  });
});

describe('guardia de tiempos y concurrencia', () => {
  it('exige timeout-minutes entre 1 y 15 en cada trabajo', () => {
    const f = flujo(`
jobs:
  sin: { steps: [] }
  largo: { timeout-minutes: 30, steps: [] }
  bien: { timeout-minutes: 15, steps: [] }
`);
    expect(revisarTiempos('x.yml', f).map((h) => h.motivo)).toEqual([
      expect.stringContaining('jobs.sin'),
      expect.stringContaining('jobs.largo'),
    ]);
  });

  it('exige cancelar la corrida vieja de la misma rama', () => {
    expect(revisarConcurrencia('x.yml', flujo('jobs: {}'))).toHaveLength(1);
    expect(
      revisarConcurrencia('x.yml', flujo('concurrency: { group: ci, cancel-in-progress: true }')),
    ).toHaveLength(1);
    expect(
      revisarConcurrencia(
        'x.yml',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: es una expresión de GitHub Actions, no de JS
        flujo('concurrency: { group: "ci-${{ github.ref }}", cancel-in-progress: true }'),
      ),
    ).toEqual([]);
  });
});

describe('despliegue e inyección (HU-E1.5)', () => {
  it('un flujo de despliegue no cancela a medias', () => {
    const conCancelar = flujo(
      'name: desplegar\nconcurrency: { group: d, cancel-in-progress: true }',
    );
    const sinCancelar = flujo(
      'name: desplegar\nconcurrency: { group: d, cancel-in-progress: false }',
    );
    expect(revisarConcurrencia('d.yml', conCancelar)).toHaveLength(1);
    expect(revisarConcurrencia('d.yml', sinCancelar)).toEqual([]);
  });

  it('un registro del dueño tampoco se corta a medio escribir (HU-C5.8)', () => {
    const conCancelar = flujo(
      'name: registrar-pago\nconcurrency: { group: r, cancel-in-progress: true }',
    );
    const sinCancelar = flujo(
      'name: registrar-pago\nconcurrency: { group: r, cancel-in-progress: false }',
    );
    expect(revisarConcurrencia('r.yml', conCancelar)).toHaveLength(1);
    expect(revisarConcurrencia('r.yml', sinCancelar)).toEqual([]);
  });

  it('rechaza interpolar una entrada dentro de un run; por env está bien', () => {
    const expresion = ['$', '{{ inputs.solo_celda }}'].join('');
    const f = flujo(
      [
        'jobs:',
        '  a:',
        '    steps:',
        '      - name: malo',
        `        run: node x.ts --solo "${expresion}"`,
        '      - name: bien',
        '        env:',
        `          SOLO: ${expresion}`,
        '        run: node x.ts --solo "$SOLO"',
      ].join('\n'),
    );
    expect(revisarInyeccion('x.yml', f)).toEqual([
      expect.objectContaining({ motivo: expect.stringContaining('paso «malo»') }),
    ]);
  });
});

describe('guardia de secretos documentados (P18)', () => {
  const doc = '### 7.5 Secretos\n\nLista actual: `CF_API_TOKEN`, `CF_ACCOUNT_ID`.\n\n## 8. Otra';

  it('lee la lista de ARQUITECTURA §7.5', () => {
    expect(secretosDocumentados(doc)).toEqual(['CF_ACCOUNT_ID', 'CF_API_TOKEN']);
  });

  it('rechaza un secreto que el documento no nombra, y acepta GITHUB_TOKEN', () => {
    const texto =
      // biome-ignore lint/suspicious/noTemplateCurlyInString: es una expresión de GitHub Actions, no de JS
      'a: ${{ secrets.CF_API_TOKEN }}\nb: ${{ secrets.OTRO }}\nc: ${{ secrets.GITHUB_TOKEN }}';
    expect(revisarSecretos('x.yml', texto, secretosDocumentados(doc))).toEqual([
      expect.objectContaining({ motivo: expect.stringContaining('«OTRO»') }),
    ]);
  });

  it('la sección real existe y trae los secretos de la arquitectura', () => {
    const arquitectura = readFileSync(join(RAIZ, 'docs', 'ARQUITECTURA.md'), 'utf8');
    expect(secretosDocumentados(arquitectura)).toEqual(
      expect.arrayContaining(['CF_API_TOKEN', 'CF_ACCOUNT_ID', 'CORE_JWT_PRIVATE_KEY']),
    );
  });
});

describe('los flujos del repositorio', () => {
  const archivos = listarArchivos((rel) => /^\.github\/workflows\/.+\.ya?ml$/.test(rel));
  const arquitectura = readFileSync(join(RAIZ, 'docs', 'ARQUITECTURA.md'), 'utf8');
  const documentados = secretosDocumentados(arquitectura);

  it('existen ci.yml, scripts-windows.yml y desplegar.yml', () => {
    expect(archivos).toEqual(
      expect.arrayContaining([
        '.github/workflows/ci.yml',
        '.github/workflows/scripts-windows.yml',
        '.github/workflows/desplegar.yml',
      ]),
    );
  });

  it('cumplen pipefail, tiempos, concurrencia, inyección y secretos', () => {
    const hallazgos = archivos.flatMap((archivo) => {
      const texto = readFileSync(join(RAIZ, archivo), 'utf8');
      const f = parse(texto) as Flujo;
      return [
        ...revisarPipefail(archivo, f),
        ...revisarTiempos(archivo, f),
        ...revisarConcurrencia(archivo, f),
        ...revisarInyeccion(archivo, f),
        ...revisarSecretos(archivo, texto, documentados),
      ];
    });
    expect(hallazgos).toEqual([]);
  });

  it('el despliegue a mano deja elegir productos, y una versión publicada a mano lleva el suyo (bitácora parqueadero 41)', () => {
    const f = parse(readFileSync(join(RAIZ, '.github/workflows/desplegar.yml'), 'utf8')) as {
      on: { workflow_dispatch: { inputs: Record<string, unknown> } };
      jobs: Record<string, { with?: Record<string, string> }>;
    };
    expect(Object.keys(f.on.workflow_dispatch.inputs)).toContain('productos');
    const productos = f.jobs['a-mano']?.with?.['productos'] ?? '';
    expect(productos).toContain('inputs.productos');
    expect(productos).toContain("startsWith(github.event.release.tag_name, 'parqueadero-v')");
    expect(productos).toContain("startsWith(github.event.release.tag_name, 'tienda-v')");
  });

  it('el flujo de Windows corre en windows-latest (o en el runner propio) cuando scripts/ llega a main y los lunes', () => {
    const f = parse(readFileSync(join(RAIZ, '.github/workflows/scripts-windows.yml'), 'utf8'));
    // biome-ignore lint/suspicious/noTemplateCurlyInString: es una expresión de GitHub Actions, no de JavaScript
    expect(f.jobs.windows['runs-on']).toBe("${{ vars.RUNNER_CI || 'windows-latest' }}");
    expect(f.on.push.branches).toEqual(['main']);
    expect(f.on.push.paths).toContain('scripts/**');
    // Cada push de un PR costaba el doble en Windows: no corre en los PR (8 oct 2026).
    expect(f.on.pull_request).toBeUndefined();
    expect(f.on.schedule[0].cron).toMatch(/ 1$/);
    // Cada versión del agro cambia package.json solo en el número: no paga Windows (HU-C11.8).
    expect(f.on.push.paths).not.toContain('package.json');
    expect(f.on.push.paths).toContain('pnpm-lock.yaml');
  });

  it('el CI no corre en borradores, corre al marcarlos listos y una vez por semana con todo (HU-C11.8)', () => {
    const f = parse(readFileSync(join(RAIZ, '.github/workflows/ci.yml'), 'utf8'));
    expect(f.on.pull_request.types).toEqual(
      expect.arrayContaining(['opened', 'synchronize', 'reopened', 'ready_for_review']),
    );
    expect(f.jobs.verificar.if).toBe(
      "github.event_name != 'pull_request' || !github.event.pull_request.draft",
    );
    expect(f.on.schedule[0].cron).toMatch(/ 1$/);
    const verificar = (
      f.jobs.verificar.steps as { run?: string; env?: Record<string, string> }[]
    ).find((p) => p.run === 'node scripts/verificar.ts --ci');
    // Los PR deciden el instrumento de D1 por lo que cambió; main sin verificar y la semanal, workerd.
    expect(verificar?.env?.['D1_INSTRUMENTO']).toBe(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: es una expresión de GitHub Actions
      "${{ github.event_name == 'pull_request' && 'auto' || 'workerd' }}",
    );
  });
});

describe('el runner propio es temporal (docs/runbooks/runner-propio.md)', () => {
  const flujos = readdirSync(join(RAIZ, '.github/workflows')).filter((f) => f.endsWith('.yml'));
  const texto = (f: string) => readFileSync(join(RAIZ, '.github/workflows', f), 'utf8');

  it('ningún flujo fija «self-hosted»: solo se llega a él por la variable RUNNER_CI, y sin ella vuelve a GitHub', () => {
    for (const f of flujos) {
      for (const linea of texto(f)
        .split('\n')
        .filter((l) => /^\s*runs-on:/.test(l))) {
        expect(linea, `${f}: ${linea.trim()}`).not.toMatch(/runs-on:\s*\[?\s*['"]?self-hosted/);
        if (linea.includes('vars.RUNNER_CI')) {
          expect(linea, f).toMatch(/\|\| '(ubuntu|windows)-latest'/);
        }
      }
    }
  });

  it('los despliegues siguen en los equipos de GitHub: los secretos de producción no pasan por un equipo personal', () => {
    for (const f of flujos.filter((x) => x.startsWith('desplegar'))) {
      expect(texto(f), f).not.toContain('RUNNER_CI');
    }
  });
});

describe('plantilla de pull request (P5, P18)', () => {
  it('pide control negativo y si cambió algo que un documento afirma', () => {
    const plantilla = readFileSync(join(RAIZ, '.github', 'pull_request_template.md'), 'utf8');
    expect(plantilla).toContain('## Control negativo');
    expect(plantilla).toContain('## ¿Cambió algo que un documento afirma?');
  });
});

describe('esperas por tiempo en las pruebas (P19)', () => {
  // Se esperan estados, no tiempos. El nombre se arma para que este archivo no se acuse solo.
  const prohibido = ['waitFor', 'Timeout('].join('');
  it(`ninguna prueba usa ${prohibido}`, () => {
    const conEspera = listarArchivos((rel) => /\.(ts|tsx|js|mjs)$/.test(rel)).filter((rel) =>
      readFileSync(join(RAIZ, rel), 'utf8').includes(prohibido),
    );
    expect(conEspera).toEqual([]);
  });
});
