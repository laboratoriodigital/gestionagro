/**
 * La consola del dueño (EC13): cada desempeño se lee sobre el tinte de su propia fila y sobre el
 * papel, y el texto de la franja sobre la tinta azul. El contraste se calcula, no se afirma (P18):
 * el 23 oct 2026 el verde Superior daba 4,38:1 sobre su tinte y axe lo detuvo.
 */
import { describe, expect, it } from 'vitest';
import { BOLETIN, contraste, GRISES, TINTE_DEL_BOLETIN } from '../../packages/ui/src/v2/tokens.ts';

/** Lo que hace `color-mix(in srgb, <tono> N%, papel)`: la mezcla canal por canal. */
function tinte(tono: string, papel: string, proporcion: number): string {
  const canal = (hex: string, i: number) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const mezcla = [0, 1, 2].map((i) =>
    Math.round(canal(tono, i) * proporcion + canal(papel, i) * (1 - proporcion)),
  );
  return `#${mezcla.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

describe('el boletín de la consola se lee (WCAG 2.1 AA)', () => {
  const papel = GRISES[0];
  const estados = ['superior', 'alto', 'basico', 'bajo'] as const;

  it.each(estados)('el desempeño %s pasa 4,5:1 sobre su fila y sobre el papel', (estado) => {
    const tono = BOLETIN[`boletin-${estado}`];
    expect(contraste(tono, tinte(tono, papel, TINTE_DEL_BOLETIN))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(tono, papel)).toBeGreaterThanOrEqual(4.5);
  });

  it('el texto de la franja sobre la tinta azul, y el renglón guía de atención', () => {
    expect(contraste(papel, BOLETIN['boletin-tinta'])).toBeGreaterThanOrEqual(4.5);
    expect(
      contraste(BOLETIN['boletin-tinta-palido'], BOLETIN['boletin-tinta']),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contraste(BOLETIN['boletin-atencion-texto'], BOLETIN['boletin-atencion-fondo']),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contraste(BOLETIN['boletin-tinta'], BOLETIN['boletin-tinta-palido']),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('❌ el verde de antes (#15803d) no pasa sobre su tinte: la prueba lo vería', () => {
    expect(contraste('#15803d', tinte('#15803d', papel, TINTE_DEL_BOLETIN))).toBeLessThan(4.5);
  });
});
