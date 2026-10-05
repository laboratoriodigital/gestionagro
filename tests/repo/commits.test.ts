/**
 * HU-C0.2: la convención `tipo(alcance): descripción`, sin la marca de Claude Code. Cada caso
 * malo es el control negativo de la guardia (P5).
 */
import { describe, expect, it } from 'vitest';
import {
  fallasDelAsunto,
  fallasDeMarca,
  LARGO_MAXIMO,
  leerLog,
  revisar,
} from '../../scripts/lib/commits.ts';

describe('el asunto', () => {
  it.each([
    'feat(core): la sesión nace con su producto',
    'docs(core): decisiones D-C1 a D-C5 como ADR-28 a ADR-30',
    'fix: el aviso queda junto al botón',
    'ci(verificar): con solo documentos no compila ni abre navegadores',
    'refactor(tokens)!: el emisor pasa a ed1-core',
    'test(migraciones): receta W1–W4 en D1 local',
    'chore(ui.v2): tokens',
  ])('acepta «%s»', (asunto) => {
    expect(fallasDelAsunto(asunto)).toEqual([]);
  });

  it.each([
    'Merge pull request #91 from laboratoriodigital/docs/core-plan-y-backlog',
    "Merge branch 'main' into feat/c1-sprint",
    "Merge remote-tracking branch 'origin/main' into feat/c1-sprint",
    'Merge 1234567890abcdef1234567890abcdef12345678 into abcdef1234567890abcdef1234567890abcdef12',
  ])('deja pasar la fusión «%s»', (asunto) => {
    expect(fallasDelAsunto(asunto)).toEqual([]);
  });

  it.each([
    ['sin tipo', 'agrega la cuenta'],
    ['tipo que no existe', 'feature(core): agrega la cuenta'],
    ['alcance en mayúsculas', 'feat(HU-E1.1): monorepo pnpm'],
    ['sin espacio tras los dos puntos', 'feat(core):agrega'],
    ['descripción vacía', 'feat(core): '],
    ['dos puntos sin alcance cerrado', 'feat(core: agrega'],
  ])('rechaza %s', (_caso, asunto) => {
    expect(fallasDelAsunto(asunto)[0]).toMatch(/no sigue «tipo\(alcance\): descripción»/);
  });

  it('rechaza la descripción con punto final', () => {
    expect(fallasDelAsunto('feat(core): agrega la cuenta.')).toEqual([
      'la descripción termina en punto',
    ]);
  });

  it(`rechaza más de ${LARGO_MAXIMO} caracteres, contados como letras y no como bytes`, () => {
    const justo = `docs(core): ${'á'.repeat(LARGO_MAXIMO - 'docs(core): '.length)}`;
    expect([...justo]).toHaveLength(LARGO_MAXIMO);
    expect(fallasDelAsunto(justo)).toEqual([]);
    expect(fallasDelAsunto(`${justo}x`)).toEqual([
      `tiene ${LARGO_MAXIMO + 1} caracteres; el tope es ${LARGO_MAXIMO}`,
    ]);
  });
});

describe('la marca de Claude Code', () => {
  it.each([
    ['Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>', 'Co-Authored-By: Claude'],
    ['co-authored-by:   claude <noreply@anthropic.com>', 'Co-Authored-By: Claude'],
    ['Claude-Session: https://claude.ai/code/session_x', 'Claude-Session'],
    [
      '🤖 Generated with [Claude Code](https://claude.com/claude-code)',
      '«Generated with Claude Code»',
    ],
  ])('atrapa «%s»', (texto, nombre) => {
    expect(fallasDeMarca(`feat(core): x\n\ncuerpo\n\n${texto}`)).toEqual([
      `lleva la marca de Claude Code (${nombre})`,
    ]);
  });

  it('no confunde la palabra «Claude» en un texto normal con la marca', () => {
    expect(fallasDeMarca('docs: el asistente (Claude) hace los commits')).toEqual([]);
    expect(fallasDeMarca('Co-Authored-By: Persona Ensayo <ensayo@example.com>')).toEqual([]);
  });

  it('no confunde un texto que DESCRIBE la regla con la marca (bitácora core 3)', () => {
    // El cuerpo real del commit 4ee3d35, que la primera versión de la guardia marcó dos veces.
    const cuerpo = [
      'caracteres contados como letras, sin punto final y sin',
      'Co-Authored-By: Claude, Claude-Session ni «Generated with Claude Code».',
    ].join('\n');
    expect(fallasDeMarca(cuerpo)).toEqual([]);
    expect(fallasDeMarca('Claude-Session: en el cuerpo, nunca')).toEqual([]);
  });
});

describe('revisar un PR', () => {
  it('nombra cada commit malo con su sha corto y su asunto, y también el título y la descripción', () => {
    const hallazgos = revisar(
      [
        { sha: 'aaaaaaa1111', mensaje: 'feat(core): bien' },
        {
          sha: 'bbbbbbb2222',
          mensaje: 'agrega cosas\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
        },
      ],
      { titulo: 'Sprint C1', cuerpo: '🤖 Generated with [Claude Code](https://claude.com)' },
    );
    expect(hallazgos.map((h) => h.donde)).toEqual([
      'commit bbbbbbb «agrega cosas»',
      'commit bbbbbbb «agrega cosas»',
      'título del PR «Sprint C1»',
      'descripción del PR',
    ]);
  });

  it('sin PR (push a main) revisa solo los commits', () => {
    expect(revisar([{ sha: 'a', mensaje: 'feat(core): bien' }])).toEqual([]);
  });
});

describe('leer git log', () => {
  it('separa sha y mensaje con los separadores de unidad y de registro', () => {
    const salida = 'aaa\x1ffeat(core): uno\n\ncuerpo\n\x1e\nbbb\x1fdocs(core): dos\n\x1e\n';
    expect(leerLog(salida)).toEqual([
      { sha: 'aaa', mensaje: 'feat(core): uno\n\ncuerpo' },
      { sha: 'bbb', mensaje: 'docs(core): dos' },
    ]);
  });
});
