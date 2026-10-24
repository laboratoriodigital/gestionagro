/**
 * «Hoy» (HU-E0.11): lo que dice cada nave y el resumen del día, con lo desconocido dicho como
 * desconocido (P1).
 */
import type { FilaDelCalendario } from '@ed1/agro-schema';
import { describe, expect, it } from 'vitest';
import { estadoDeHoy, resumenDelDia } from './Hoy.tsx';

const fila = (hoy: 'verde' | 'rojo' | 'gris', dias: ('verde' | 'rojo')[] = []): FilaDelCalendario =>
  ({
    area: { id: 'a', nombre: 'Nave 1', padre_id: null },
    nombre: 'Nave 1',
    hoy: { color: hoy, carencia: null, reentrada: null },
    dias: dias.map((color, i) => ({
      fecha: `2026-10-${String(24 + i).padStart(2, '0')}`,
      color,
      enCarencia: color === 'rojo',
      entrarDesde: null,
    })),
  }) as unknown as FilaDelCalendario;

describe('estadoDeHoy', () => {
  it('verde se puede cosechar', () => {
    expect(estadoDeHoy(fila('verde'))).toEqual({ clase: 'lista', texto: 'Se puede cosechar' });
  });

  it('en carencia dice desde qué día de la semana, contado en el calendario', () => {
    // El 24 de octubre de 2026 es sábado.
    expect(estadoDeHoy(fila('rojo', ['rojo', 'verde']))).toEqual({
      clase: 'carencia',
      texto: 'Desde el domingo 25',
    });
  });

  it('❌ gris nunca dice que se puede: falta la carencia', () => {
    expect(estadoDeHoy(fila('gris'))).toEqual({ clase: 'sin-dato', texto: 'Falta la carencia' });
  });
});

describe('resumenDelDia', () => {
  const lista = { clase: 'lista', texto: '' } as const;
  const carencia = { clase: 'carencia', texto: '' } as const;
  it('cuenta las naves listas', () => {
    expect(resumenDelDia([lista, carencia])).toBe('Hoy puedes cosechar en 1 nave.');
    expect(resumenDelDia([lista, lista, carencia])).toBe('Hoy puedes cosechar en 2 naves.');
    expect(resumenDelDia([lista, lista])).toBe('Hoy puedes cosechar en todas tus naves.');
    expect(resumenDelDia([carencia])).toBe('Hoy no hay naves para cosechar.');
    expect(resumenDelDia([])).toBe('Agrega tus naves para ver qué puedes cosechar.');
  });
});
