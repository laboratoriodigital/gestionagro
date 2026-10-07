import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ } from '../../scripts/lib/repo.ts';

/**
 * Los paquetes puros de la Tienda corren igual en el navegador, en Node y en workerd, y el horno
 * tiene que dar los mismos bytes en todos (TIENDA-3.0 §10.4; P17). En vez de levantar workerd
 * para cada función pura, se prohíbe lo que cambia entre runtimes o entre corridas: `Intl` y
 * `toLocale…` (el formato cambia), el reloj y el azar que no se reciben como parámetro (P8), y
 * los módulos de Node (no existen en workerd). Correrlos dentro de workerd llega con la API
 * (HU-T2.4), que los usa en cada prueba. BACKLOG_TIENDA3 HU-T1.1, CA2. Los paquetes neutrales del
 * parqueadero, `whatsapp` e `impresion`, siguen la misma regla (BACKLOG-PARKING_MVP HU-Q1.6, HU-Q2.2).
 */
const PAQUETES = ['dinero', 'calendario', 'cifrado', 'tienda-schema', 'whatsapp', 'impresion'];

const PROHIBIDO: ReadonlyArray<[RegExp, string]> = [
  [/\bIntl\b/, '`Intl` cambia entre runtimes (P17)'],
  [/\.toLocale\w*\(/, '`toLocale…` cambia entre runtimes (P17)'],
  [/\bDate\.now\(/, 'el reloj se recibe como parámetro (P8)'],
  [/new Date\(\s*\)/, 'el reloj se recibe como parámetro (P8)'],
  [/\bMath\.random\(/, 'el azar se recibe como parámetro, y nunca es `Math.random`'],
  [/from ['"]node:/, 'un módulo de Node no existe en workerd'],
];

function fuentes(paquete: string): string[] {
  const dir = join(RAIZ, 'packages', paquete, 'src');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join(dir, f));
}

describe('los paquetes puros de la Tienda no dependen del runtime', () => {
  it.each(PAQUETES)(
    'el paquete %s existe (una lista que nombra lo que no hay no protege nada, P1)',
    (p) => {
      expect(existsSync(join(RAIZ, 'packages', p, 'src'))).toBe(true);
    },
  );

  it.each(PAQUETES)('%s no usa nada prohibido', (p) => {
    const hallazgos: string[] = [];
    for (const archivo of fuentes(p)) {
      readFileSync(archivo, 'utf8')
        .split('\n')
        .forEach((linea, i) => {
          if (/^\s*(\*|\/\/)/.test(linea)) return; // los comentarios pueden nombrarlo
          for (const [re, motivo] of PROHIBIDO) {
            if (re.test(linea)) hallazgos.push(`${archivo}:${i + 1}: ${motivo}`);
          }
        });
    }
    expect(hallazgos).toEqual([]);
  });

  it('distingue: atrapa cada forma prohibida en una línea de código', () => {
    const malas = [
      'const f = new Intl.NumberFormat("es-CO");',
      'x.toLocaleString();',
      'const t = Date.now();',
      'const d = new Date();',
      'const r = Math.random();',
      "import { createHash } from 'node:crypto';",
    ];
    for (const m of malas) expect(PROHIBIDO.some(([re]) => re.test(m))).toBe(true);
    expect(PROHIBIDO.some(([re]) => re.test('const d = new Date(Date.UTC(2026, 0, 1));'))).toBe(
      false,
    );
  });
});
