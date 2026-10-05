/**
 * HU-C6.1: los tokens v2 (ADR-29). El contraste se calcula, no se afirma (P18), y el CSS es lo
 * que genera `tokens.ts` (P2).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contraste, type Modo, PAREJAS, SEMANTICOS, semanticosDe, TEMAS } from '@ed1/ui/v2/tokens';
import { describe, expect, it } from 'vitest';
import { listarArchivos, RAIZ } from '../../scripts/lib/repo.ts';
import { ARCHIVOS_UI, coloresSueltos, cssDeTokens } from '../../scripts/lib/ui-css.ts';

const MODOS: Modo[] = ['claro', 'oscuro'];
const TEMAS_A_PROBAR: (string | null)[] = [null, ...Object.keys(TEMAS)];

describe('contraste AA en cada tema y cada modo', () => {
  const casos = TEMAS_A_PROBAR.flatMap((tema) =>
    MODOS.flatMap((modo) =>
      PAREJAS.map((p) => ({ tema: tema ?? 'ecosistema', modo, ...p, s: semanticosDe(tema, modo) })),
    ),
  );
  it.each(casos)('$tema · $modo · $texto sobre $fondo ≥ $minimo', ({ s, texto, fondo, minimo }) => {
    expect(contraste(s[texto], s[fondo])).toBeGreaterThanOrEqual(minimo);
  });

  it('la cuenta calcula bien: negro sobre blanco es 21, y un gris claro sobre blanco no llega', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
    // Control negativo de la prueba de arriba: este gris, como texto suave, fallaría.
    expect(contraste('#9a9a96', SEMANTICOS.claro.superficie)).toBeLessThan(4.5);
  });

  it('rechaza un color que no es #rrggbb en vez de calcular cualquier cosa (P1)', () => {
    expect(() => contraste('azul', '#ffffff')).toThrow(/no es un color/);
  });
});

describe('el CSS es el que genera tokens.ts (P2)', () => {
  it.each(Object.entries(ARCHIVOS_UI))(
    '%s está al día: si falla, corre node scripts/generar-ui.ts',
    (ruta, generar) => {
      expect(readFileSync(join(RAIZ, ruta), 'utf8')).toBe(generar());
    },
  );

  it('la hoja pesa menos de 4 KB, como dice su comentario (P18)', () => {
    expect(Buffer.byteLength(cssDeTokens())).toBeLessThan(4096);
  });

  it('el modo oscuro respeta la preferencia salvo que se fije el claro, y se puede fijar', () => {
    const css = cssDeTokens();
    expect(css).toContain(":root:not([data-tema='claro'])");
    expect(css).toContain(":root[data-tema='oscuro']");
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('la v1 sigue intacta para el sitio y el cuaderno (P10)', () => {
    expect(readFileSync(join(RAIZ, 'packages/ui/src/tokens.css'), 'utf8')).toContain(
      '--color-marca: #1f6b3a;',
    );
  });
});

describe('ningún color suelto fuera de los tokens (CA3)', () => {
  it('el detector encuentra hexadecimales y funciones de color, y no los comentarios', () => {
    expect(coloresSueltos('.b { color: #2340d0; background: rgb(0 0 0); }')).toEqual([
      '#2340d0',
      'rgb(',
    ]);
    expect(coloresSueltos('/* el acento es #2340d0 */ .b { color: var(--acento); }')).toEqual([]);
  });

  it('los estilos de los componentes v2 y de la cuenta usan solo tokens', () => {
    const estilos = listarArchivos(
      (r) =>
        (r.startsWith('packages/ui/src/v2/') && r.endsWith('.css') && !r.endsWith('tokens.css')) ||
        (r.startsWith('apps/cuenta/src/') && /\.(css|astro)$/.test(r)),
    );
    const sueltos = estilos.flatMap((r) =>
      coloresSueltos(readFileSync(join(RAIZ, r), 'utf8')).map((c) => `${r}: ${c}`),
    );
    expect(sueltos).toEqual([]);
  });
});
