import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COMISIONES,
  comisionEnTexto,
  diaEnBogota,
  enLista,
  llavesEnPalabras,
  pruebaEnPalabras,
} from './cobro.ts';

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

  it('HU-T11.3: en qué va el cobro de prueba; aprobado sin aviso dice que revise la dirección en Bold', () => {
    const ultimo = (estado: string) => ({
      id: 'PRB001-1',
      estado,
      creado: '2026-10-19T16:00:00.000Z',
    });
    expect(pruebaEnPalabras({ aprobada: null, ultimo: null })).toEqual({
      tono: 'info',
      texto: 'Todavía no has hecho el cobro de prueba.',
    });
    expect(pruebaEnPalabras({ aprobada: null, ultimo: ultimo('aprobado') }).texto).toMatch(
      /el aviso de Bold no llegó/,
    );
    expect(pruebaEnPalabras({ aprobada: null, ultimo: ultimo('rechazado') }).texto).toMatch(
      /rechazado/,
    );
    expect(pruebaEnPalabras({ aprobada: null, ultimo: ultimo('esperando') }).tono).toBe('info');
    expect(
      pruebaEnPalabras({ aprobada: '2026-10-20T03:00:00.000Z', ultimo: ultimo('aprobado') }),
    ).toEqual({
      tono: 'exito',
      texto:
        'Bold aprobó tu cobro de prueba y avisó el 19 de octubre de 2026: tu llave secreta y los avisos funcionan.',
    });
  });

  it('❌ el día es el de Bogotá, no el de UTC', () => {
    expect(diaEnBogota('2026-10-20T04:59:00.000Z')).toBe('19 de octubre de 2026');
    expect(diaEnBogota('2026-10-20T05:00:00.000Z')).toBe('20 de octubre de 2026');
  });
});
