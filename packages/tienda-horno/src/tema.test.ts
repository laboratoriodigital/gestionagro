/**
 * HU-T3.2: el tema de cada vitrina, calculado. Los ocho acentos del panel pasan en claro y en
 * oscuro; uno que no se lee se rechaza diciendo cuál pasaría, nunca se ajusta en silencio.
 */
import { contraste, SEMANTICOS } from '@ed1/ui/v2/tokens';
import { describe, expect, it } from 'vitest';
import {
  ACENTOS_DE_LA_VITRINA,
  AcentoIlegible,
  type Apariencia,
  acentoLegible,
  coloresDelTema,
  cssDelTema,
  MINIMO,
} from './tema.ts';

const base: Apariencia = {
  acento: ACENTOS_DE_LA_VITRINA.cobre,
  tinta: 'negra',
  estilo: 'precision',
  portada: 'catalogo',
  proporcion: '1:1',
  modo: 'telefono',
};
const CLARO = SEMANTICOS.claro.superficie;
const OSCURO = SEMANTICOS.oscuro.superficie;

describe('los ocho acentos del panel (WI-T3.2.1)', () => {
  it.each(Object.entries(ACENTOS_DE_LA_VITRINA))(
    '%s pasa 4,5:1 en claro y en oscuro',
    (_n, acento) => {
      const c = coloresDelTema({ ...base, acento });
      expect(contraste(c.claro.acento, CLARO)).toBeGreaterThanOrEqual(MINIMO);
      expect(contraste(c.oscuro.acento, OSCURO)).toBeGreaterThanOrEqual(MINIMO);
      expect(contraste(c.claro.acentoTexto, c.claro.acento)).toBeGreaterThanOrEqual(MINIMO);
      expect(contraste(c.oscuro.acentoTexto, c.oscuro.acento)).toBeGreaterThanOrEqual(MINIMO);
    },
  );

  it('son ocho, distintos', () => {
    expect(new Set(Object.values(ACENTOS_DE_LA_VITRINA)).size).toBe(8);
  });
});

describe('un color libre (HU-T3.2 CA2 y CA3)', () => {
  it('❌ un amarillo sobre blanco se rechaza, y dice cuál se parece y sí se lee', () => {
    let error: unknown;
    try {
      coloresDelTema({ ...base, acento: '#f0c040' });
    } catch (lanzado) {
      error = lanzado;
    }
    expect(error).toBeInstanceOf(AcentoIlegible);
    const e = error as AcentoIlegible;
    expect(e.message).toMatch(/necesita 4,5:1/);
    expect(contraste(e.sugerido, CLARO)).toBeGreaterThanOrEqual(MINIMO);
  });

  it('el sugerido es el más cercano: un paso antes no pasaba', () => {
    const sugerido = acentoLegible('#f0c040', CLARO);
    expect(contraste(sugerido, CLARO)).toBeGreaterThanOrEqual(MINIMO);
    expect(contraste('#f0c040', CLARO)).toBeLessThan(MINIMO);
  });

  it('una tienda solo oscura mide su acento contra el fondo oscuro', () => {
    expect(() => coloresDelTema({ ...base, modo: 'oscuro', acento: '#1f1f1d' })).toThrow(
      AcentoIlegible,
    );
    expect(coloresDelTema({ ...base, modo: 'oscuro', acento: '#f0a878' }).oscuro.acento).toBe(
      '#f0a878',
    );
  });
});

describe('el CSS del tema', () => {
  it('solo variables, y el modo del teléfono trae su versión oscura', () => {
    const css = cssDelTema({ ...base, proporcion: '4:5', tinta: 'azul' });
    expect(css).toContain('--acento: #9c4a1a;');
    expect(css).toContain('--tinta: #0a1e32;');
    expect(css).toContain('--proporcion-foto: 4 / 5;');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  it('una tienda solo clara no trae modo oscuro', () => {
    expect(cssDelTema({ ...base, modo: 'claro' })).not.toContain('prefers-color-scheme');
  });

  it('los mismos datos dan los mismos bytes', () => {
    expect(cssDelTema(base)).toBe(cssDelTema({ ...base }));
  });
});
