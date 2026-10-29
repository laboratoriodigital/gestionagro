/**
 * HU-P4.1 (sprint PF3): cada tema listo pasa por la misma compuerta que un color elegido a mano
 * (HU-T3.6 y HU-T3.2): su acento es uno de los ocho del panel, se lee en claro, en oscuro y con el
 * modo del teléfono, y el de la tienda solo oscura es el que el horno sugeriría.
 */

import { CAMPOS_DEL_TEMA, TEMAS_LISTOS, temaDe, valoresDelTema } from '@ed1/tienda-schema/temas';
import { SEMANTICOS } from '@ed1/ui/v2/tokens';
import { describe, expect, it } from 'vitest';
import { ACENTOS_DE_LA_VITRINA, type Apariencia, acentoLegible, coloresDelTema } from './tema.ts';

const apariencia = (modo: Apariencia['modo'], v: Record<string, string>): Apariencia =>
  ({ ...v, modo }) as Apariencia;

describe('HU-P4.1 · los temas listos', () => {
  it('son de seis a ocho, con nombre y acentos del panel', () => {
    expect(TEMAS_LISTOS.length).toBeGreaterThanOrEqual(6);
    expect(TEMAS_LISTOS.length).toBeLessThanOrEqual(8);
    expect(new Set(TEMAS_LISTOS.map((t) => t.id)).size).toBe(TEMAS_LISTOS.length);
    const acentos: string[] = Object.values(ACENTOS_DE_LA_VITRINA);
    for (const t of TEMAS_LISTOS) expect(acentos).toContain(t.acento);
  });

  it.each(TEMAS_LISTOS.map((t) => [t.nombre, t] as const))(
    '%s se lee en claro, en oscuro y como esté el teléfono',
    (_n, t) => {
      for (const modo of ['claro', 'oscuro', 'telefono'] as const)
        expect(() => coloresDelTema(apariencia(modo, valoresDelTema(t, modo)))).not.toThrow();
      expect(t.acentoOscuro).toBe(acentoLegible(t.acento, SEMANTICOS.oscuro.superficie));
    },
  );

  it('solo llena acento, tinta, estilo, portada y forma de las fotos', () => {
    for (const t of TEMAS_LISTOS)
      expect(Object.keys(valoresDelTema(t, 'claro')).sort()).toEqual([...CAMPOS_DEL_TEMA].sort());
  });

  it('reconoce el tema de lo guardado; la apariencia de fábrica es «Minimal»', () => {
    const moda = TEMAS_LISTOS.find((t) => t.id === 'moda');
    if (!moda) throw new Error('falta Moda');
    expect(temaDe({ modo: 'oscuro', ...valoresDelTema(moda, 'oscuro') })?.id).toBe('moda');
    expect(temaDe({ modo: 'claro', ...valoresDelTema(moda, 'claro'), estilo: 'precision' })).toBe(
      undefined,
    );
    expect(
      temaDe({
        acento: '#1f1f1d',
        tinta: 'negra',
        estilo: 'precision',
        portada: 'catalogo',
        proporcion: '1:1',
      })?.id,
    ).toBe('minimal');
  });
});
