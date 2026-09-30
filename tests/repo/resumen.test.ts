import { describe, expect, it } from 'vitest';
import { resumir } from '../../scripts/lib/resumen.ts';

describe('resumen de verificación (P15)', () => {
  it('nombra TODAS las fallas, no solo la primera', () => {
    const texto = resumir([
      { paso: 'lint', ok: false, segundos: 1 },
      { paso: 'typecheck', ok: true, segundos: 2 },
      { paso: 'test', ok: false, segundos: 3 },
    ]);
    expect(texto).toContain('| ❌ | lint |');
    expect(texto).toContain('| ✅ | typecheck |');
    expect(texto).toContain('Fallaron 2 de 3: lint, test.');
  });

  it('dice que todo está en verde solo si no hay fallas', () => {
    expect(resumir([{ paso: 'lint', ok: true, segundos: 0 }])).toContain('Todo en verde.');
    expect(resumir([{ paso: 'lint', ok: false, segundos: 0 }])).not.toContain('Todo en verde.');
  });
});
