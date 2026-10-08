/**
 * HU-C11.3: `main` no repite el build y el e2e de un PR que ya probó el mismo árbol. Ante la duda,
 * corre todo (P1).
 */
import { describe, expect, it } from 'vitest';
import { decidirYaVerificado } from '../../scripts/lib/ya-verificado.ts';

const PUNTA = '0a1b2c3d4e5f60718293a4b5c6d7e8f901234567';

describe('¿el PR ya verificó este árbol?', () => {
  it('un PR al día con su CI en verde: se saltan navegadores, build y e2e', () => {
    expect(decidirYaVerificado({ puntaDelPr: PUNTA, prAlDia: true, corridasEnVerde: 1 })).toEqual({
      verificado: true,
      motivo: 'el PR (0a1b2c3) ya verificó este mismo árbol: se saltan navegadores, build y e2e',
    });
  });

  it('una rama atrasada: la fusión es un árbol que nadie probó, corre todo (❌)', () => {
    const d = decidirYaVerificado({ puntaDelPr: PUNTA, prAlDia: false, corridasEnVerde: 1 });
    expect(d.verificado).toBe(false);
    expect(d.motivo).toContain('no tenía el main de antes');
  });

  it('sin CI en verde, sin poder preguntar o sin fusión, corre todo y lo dice', () => {
    expect(
      decidirYaVerificado({ puntaDelPr: PUNTA, prAlDia: true, corridasEnVerde: 0 }).motivo,
    ).toContain('no tiene el CI en verde');
    expect(
      decidirYaVerificado({ puntaDelPr: PUNTA, prAlDia: true, corridasEnVerde: null }).motivo,
    ).toContain('no se pudo preguntar');
    expect(
      decidirYaVerificado({ puntaDelPr: null, prAlDia: false, corridasEnVerde: null }),
    ).toEqual({ verificado: false, motivo: 'no es la fusión de un PR: corre todo' });
  });
});
