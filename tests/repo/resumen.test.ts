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

describe('resumen para CI', () => {
  it('con detalle, cita la salida de cada falla sin colores', () => {
    const texto = resumir(
      [
        { paso: 'lint', ok: false, segundos: 1, salida: '\u001b[31merror en a.ts\u001b[0m\n' },
        { paso: 'test', ok: true, segundos: 1, salida: 'bien' },
      ],
      { detalle: true },
    );
    expect(texto).toContain('<summary>❌ lint</summary>');
    expect(texto).toContain('error en a.ts');
    expect(texto).not.toContain('\u001b[');
    expect(texto).not.toContain('bien');
  });

  it('distingue lo omitido de lo fallido', () => {
    const texto = resumir([
      { paso: 'instalar', ok: false, segundos: 3 },
      { paso: 'lint', ok: false, omitido: true, segundos: 0 },
    ]);
    expect(texto).toContain('| ⏭️ | lint | omitido |');
    expect(texto).toContain('Fallaron 1 de 2: instalar. Sin correr por esa falla: lint.');
  });
});
