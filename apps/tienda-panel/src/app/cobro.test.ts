import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMISIONES, comisionEnTexto, enLista, llavesEnPalabras } from './cobro.ts';

describe('la pantalla Cobro (HU-T11.2)', () => {
  it('las comisiones son las de TIENDA-3.0 §9.7, fila por fila (P2)', () => {
    const tienda = readFileSync('docs/tienda/TIENDA-3.0.md', 'utf8');
    const desde = tienda.indexOf('| Medio, en línea | Comisión |');
    expect(desde).toBeGreaterThan(0);
    const lineas = tienda.slice(desde).split('\n');
    const filas = lineas
      .slice(
        2,
        lineas.findIndex((l) => !l.startsWith('|')),
      )
      .map((l) =>
        l
          .split('|')
          .slice(1, 3)
          .map((c) => c.trim()),
      );
    expect(COMISIONES.map((c) => [c.medio, comisionEnTexto(c)])).toEqual(filas);
  });

  it('las llaves de un ambiente, en palabras, sin su valor', () => {
    const dia = (iso: string) => iso.slice(0, 10);
    expect(llavesEnPalabras({ identidad: null, secreta: null }, dia)).toBe('Sin llaves.');
    expect(
      llavesEnPalabras(
        {
          identidad: {
            fin: 'wxyz',
            guardada: '2026-10-19T16:00:00.000Z',
            verificada: '2026-10-19T16:00:00.000Z',
          },
          secreta: { fin: 'abcd', guardada: '2026-10-19T16:00:00.000Z', verificada: null },
        },
        dia,
      ),
    ).toBe(
      'La de identidad termina en wxyz y Bold la reconoció el 2026-10-19. La secreta termina en abcd.',
    );
    expect(
      llavesEnPalabras(
        {
          identidad: { fin: 'wxyz', guardada: '2026-10-19T16:00:00.000Z', verificada: null },
          secreta: null,
        },
        dia,
      ),
    ).toBe('La de identidad termina en wxyz, sin comprobar con Bold. Falta la secreta.');
  });

  it('lo que falta, en una frase', () => {
    expect(enLista(['la llave secreta de pruebas'])).toBe('la llave secreta de pruebas');
    expect(enLista(['a', 'b', 'c'])).toBe('a, b y c');
  });
});
