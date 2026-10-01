import { describe, expect, it } from 'vitest';
import { ErrorDeRegistro, validarRegistro } from './registro.ts';

const ID = '0192f3a0-0000-7000-8000-000000000901';
const FINCA = '0192f3a0-0000-7000-8000-000000000001';

const clima = (datos: Record<string, unknown>) => ({
  id: ID,
  org_id: null,
  finca_id: FINCA,
  area_ids: [],
  ciclo_id: null,
  tipo: 'clima',
  v: 1,
  fecha_agronomica: '2026-10-15',
  instante_evento: '2026-10-15T14:00:00.000Z',
  autor_usuario_id: null,
  persona_ids: [],
  dispositivo_id: 'telefono-prueba',
  origen: 'manual',
  anula_id: null,
  datos: {
    temperaturaC: 24,
    humedadRelativaPct: 70,
    temperaturaHojaC: null,
    dpvKPa: 0.895,
    ...datos,
  },
});

const camposDelError = (entrada: unknown): string[] => {
  try {
    validarRegistro(entrada);
  } catch (e) {
    if (e instanceof ErrorDeRegistro) return e.campos.map((c) => c.campo);
    throw e;
  }
  return [];
};

describe('registro clima v1', () => {
  it('acepta un registro completo, con la hoja sin medir como null', () => {
    expect(validarRegistro(clima({})).datos).toEqual({
      temperaturaC: 24,
      humedadRelativaPct: 70,
      temperaturaHojaC: null,
      dpvKPa: 0.895,
    });
  });

  // P1: vacío o ilegible es error con el campo, nunca 0.
  it.each([
    ['vacío', ''],
    ['texto con coma', '24,5'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['null', null],
    ['ausente', undefined],
    ['fuera de rango', 75],
  ])('temperaturaC %s → error en «datos.temperaturaC»', (_caso, valor) => {
    expect(camposDelError(clima({ temperaturaC: valor }))).toEqual(['datos.temperaturaC']);
  });

  it('nombra todos los campos con problema a la vez', () => {
    expect(camposDelError(clima({ temperaturaC: '', humedadRelativaPct: 120 }))).toEqual([
      'datos.temperaturaC',
      'datos.humedadRelativaPct',
    ]);
  });

  it('un tipo o versión sin esquema no se acepta en silencio', () => {
    expect(camposDelError({ ...clima({}), v: 99 })).toEqual(['tipo']);
    expect(camposDelError({ ...clima({}), tipo: 'inventado' })).toEqual(['tipo']);
  });

  it('una fecha agronómica que no existe es error', () => {
    expect(camposDelError({ ...clima({}), fecha_agronomica: '2026-02-29' })).toEqual([
      'fecha_agronomica',
    ]);
  });

  it('un campo que el esquema no conoce es error, no se guarda a escondidas', () => {
    expect(camposDelError({ ...clima({}), nota: 'x' })).toEqual(['(registro)']);
  });
});

const riego = (v: number, datos: Record<string, unknown>) => ({
  ...clima({}),
  tipo: 'riego',
  v,
  datos: {
    unidad: 'mL_gotero',
    volumenAplicado: 500,
    volumenDrenado: 150,
    drenajePct: 30,
    ceEntradaDsM: null,
    phEntrada: null,
    ceDrenajeDsM: null,
    phDrenaje: null,
    ...datos,
  },
});

describe('registro riego', () => {
  it('v1 sigue aceptándose sin duración: lo que ya se guardó no se rechaza (ADR-13)', () => {
    expect(camposDelError(riego(1, {}))).toEqual([]);
    expect(camposDelError(riego(1, { duracionMin: 12 }))).toEqual(['datos']);
  });

  it('v2 lleva la duración en minutos; sin anotar es null, nunca 0', () => {
    expect(camposDelError(riego(2, { duracionMin: 12.5 }))).toEqual([]);
    expect(camposDelError(riego(2, { duracionMin: null }))).toEqual([]);
    expect(camposDelError(riego(2, { duracionMin: 0 }))).toEqual(['datos.duracionMin']);
    expect(camposDelError(riego(2, {}))).toEqual(['datos.duracionMin']);
  });
});
