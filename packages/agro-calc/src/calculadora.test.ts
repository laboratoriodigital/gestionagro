import { describe, expect, it } from 'vitest';
import { dpvAireKPa } from './dpv.ts';
import { formatearKPa, leerNumero } from './numeros.ts';
import {
  buscarEtapa,
  CULTIVOS_DPV,
  clasificarDpv,
  cultivoDpvDe,
  type EtapaDpv,
} from './rangos-dpv.ts';

describe('leer números como los escribe el productor (CA3)', () => {
  it.each([
    ['24,5', 24.5],
    ['24.5', 24.5],
    [' 18 ', 18],
    ['-3,2', -3.2],
    ['0', 0],
  ])('«%s» → %d', (texto, valor) => {
    expect(leerNumero(texto)).toEqual({ ok: true, valor });
  });

  it.each(['24,,5', '24.5.1', '1.234,5', '24,', ',5', '', '   ', 'abc', '24 5', '2e3'])(
    'rechaza «%s» con un motivo, sin inventar un valor (P1)',
    (texto) => {
      const r = leerNumero(texto);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo.length).toBeGreaterThan(5);
    },
  );
});

describe('formato con coma decimal (CA1)', () => {
  it('24 °C y 70 % se muestra «0,90 kPa»', () => {
    expect(formatearKPa(dpvAireKPa(24, 70))).toBe('0,90 kPa');
  });

  it('no depende del idioma del navegador', () => {
    expect(formatearKPa(1.7)).toBe('1,70 kPa');
    expect(formatearKPa(0)).toBe('0,00 kPa');
  });
});

describe('indicación de rango desde el catálogo (CA2)', () => {
  const tomate = buscarEtapa('tomate', 'produccion') as EtapaDpv;

  it('el catálogo trae tomate en producción con 0,5–0,8 y aviso fuera de 0,4–1,2, con fuente', () => {
    expect(tomate.optimo_kPa).toEqual([0.5, 0.8]);
    expect(tomate.aceptable_kPa).toEqual([0.4, 1.2]);
    expect(tomate.fuente).toMatch(/Shamshiri/);
  });

  it.each([
    [18, 90, 'bajo'], // 0,21 kPa
    [24, 80, 'en-rango'], // 0,60 kPa
    [24, 70, 'algo-alto'], // 0,90 kPa
    [30, 40, 'alto'], // 2,55 kPa
  ] as const)('%d °C y %d %% → %s', (t, hr, nivel) => {
    expect(clasificarDpv(dpvAireKPa(t, hr), tomate).nivel).toBe(nivel);
  });

  it('los bordes del óptimo cuentan como en rango; los del aceptable, como «algo»', () => {
    expect(clasificarDpv(0.5, tomate).nivel).toBe('en-rango');
    expect(clasificarDpv(0.8, tomate).nivel).toBe('en-rango');
    expect(clasificarDpv(0.4, tomate).nivel).toBe('algo-bajo');
    expect(clasificarDpv(1.2, tomate).nivel).toBe('algo-alto');
    expect(clasificarDpv(0.39, tomate).nivel).toBe('bajo');
    expect(clasificarDpv(1.21, tomate).nivel).toBe('alto');
  });

  it('fuera de rango sugiere una acción en palabras', () => {
    expect(clasificarDpv(2.5, tomate).accion).toMatch(/Nebuliza/);
    expect(clasificarDpv(0.2, tomate).accion).toMatch(/Ventila/);
  });

  it('un cultivo sin fila en el catálogo no tiene rango inventado', () => {
    expect(buscarEtapa('lechuga', 'produccion')).toBeUndefined();
  });

  it('cada etapa del catálogo es coherente: óptimo dentro del aceptable, y con fuente', () => {
    for (const c of CULTIVOS_DPV) {
      for (const e of c.etapas) {
        expect(e.aceptable_kPa[0]).toBeLessThanOrEqual(e.optimo_kPa[0]);
        expect(e.optimo_kPa[0]).toBeLessThan(e.optimo_kPa[1]);
        expect(e.optimo_kPa[1]).toBeLessThanOrEqual(e.aceptable_kPa[1]);
        expect(e.fuente.length).toBeGreaterThan(10);
      }
    }
  });
});

describe('rosa, pimentón y pepino (3 oct 2026): cada rango con su fuente y su año', () => {
  it.each(['rosa', 'pimenton', 'pepino'])(
    '%s está en el catálogo, coherente y con fuente',
    (id) => {
      const etapa = buscarEtapa(id, 'produccion') as EtapaDpv;
      expect(etapa).toBeDefined();
      const [omin, omax] = etapa.optimo_kPa;
      const [amin, amax] = etapa.aceptable_kPa;
      // El rango óptimo cae dentro del aceptable: si no, una banda de aviso quedaría vacía.
      expect(amin).toBeLessThan(omin);
      expect(omin).toBeLessThan(omax);
      expect(omax).toBeLessThan(amax);
      expect(etapa.fuente).toMatch(/\((19|20)\d{2}\)/);
    },
  );

  it.each([
    ['Tomate Chonto orgánico', 'tomate'],
    ['tomate', 'tomate'],
    ['Pimiento rojo', 'pimenton'],
    ['PIMENTÓN', 'pimenton'],
    ['Ají dulce', 'pimenton'],
    ['Pepino cohombro', 'pepino'],
    ['Rosas Freedom', 'rosa'],
  ])('«%s» se reconoce como %s', (anotado, id) => {
    expect(cultivoDpvDe(anotado)?.id).toBe(id);
  });

  it.each(['Tomatera', 'Rosal', 'Lechuga', ''])(
    '«%s» no se confunde con otro cultivo: sin indicación (P1)',
    (anotado) => {
      expect(cultivoDpvDe(anotado)).toBeUndefined();
    },
  );
});
