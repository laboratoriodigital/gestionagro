import { CULTIVOS_DPV, clasificarDpv, dpvAireKPa } from '@ed1/agro-calc';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { armarTabla, ENTRADAS_POR_DEFECTO, type EntradasTabla } from './tabla-dpv.ts';
import { pdfDeTabla, TAMANO } from './tabla-dpv-pdf.ts';

const con = (e: Partial<EntradasTabla>): EntradasTabla => ({ ...ENTRADAS_POR_DEFECTO, ...e });

/** Azar repetible (mulberry32): la prueba elige celdas «al azar» y siempre las mismas. */
function azar(semilla: number) {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('tabla de DPV (HU-E2.3)', () => {
  it('por defecto: 12 a 34 °C cada 2 y 40 a 95 % cada 5, para tomate en producción', () => {
    const { tabla, errores } = armarTabla(ENTRADAS_POR_DEFECTO);
    expect(errores).toEqual({});
    expect(tabla?.temperaturas).toEqual([12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34]);
    expect(tabla?.humedades).toEqual([40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95]);
    expect(tabla?.etapa?.nombre).toBeTruthy();
  });

  it('CA2: 10 celdas al azar coinciden con agro-calc, en valor y en nivel', () => {
    const { tabla } = armarTabla(ENTRADAS_POR_DEFECTO);
    if (!tabla?.etapa) throw new Error('sin tabla');
    const siguiente = azar(2026);
    for (let n = 0; n < 10; n++) {
      const i = Math.floor(siguiente() * tabla.temperaturas.length);
      const j = Math.floor(siguiente() * tabla.humedades.length);
      const t = tabla.temperaturas[i] ?? Number.NaN;
      const hr = tabla.humedades[j] ?? Number.NaN;
      const esperado = dpvAireKPa(t, hr);
      const c = tabla.celdas[i]?.[j];
      expect(c?.kPa).toBe(esperado);
      expect(c?.texto).toBe(esperado.toFixed(2).replace('.', ','));
      expect(c?.nivel).toBe(clasificarDpv(esperado, tabla.etapa).nivel);
    }
  });

  it('24 °C y 70 % dan 0,90, como la calculadora', () => {
    const { tabla } = armarTabla(con({ tMin: '24', tMax: '26', hrMin: '70', hrMax: '75' }));
    expect(tabla?.celdas[0]?.[0]?.texto).toBe('0,90');
  });

  it('sin cultivo, solo los valores: ningún nivel inventado', () => {
    const { tabla } = armarTabla(con({ cultivoEtapa: '' }));
    expect(tabla?.etapa).toBeNull();
    expect(tabla?.celdas.flat().every((c) => c.nivel === null)).toBe(true);
  });

  it.each([
    [{ tMin: 'doce' }, 'tMin'],
    [{ tMin: '30', tMax: '20' }, 'tMax'],
    [{ hrMin: '40', hrMax: '40' }, 'hrMax'],
    [{ tMin: '0', tMax: '50' }, 'tMax'], // 26 filas: no cabe
    [{ hrMin: '5', hrMax: '100' }, 'hrMax'], // 20 columnas: no cabe
    [{ hrMax: '101' }, 'hrMax'],
  ] as const)('%o se marca en %s y no arma tabla', (cambio, campo) => {
    const r = armarTabla(con(cambio));
    expect(r.errores[campo]).toBeTruthy();
    expect(r.tabla).toBeNull();
  });
});

describe('PDF de la tabla (CA1, CA3)', () => {
  it.each(['carta', 'a4'] as const)('una sola hoja horizontal en %s', async (papel) => {
    const { tabla } = armarTabla(ENTRADAS_POR_DEFECTO);
    if (!tabla) throw new Error('sin tabla');
    const doc = await PDFDocument.load(await pdfDeTabla(tabla, papel, 'Tomate — producción'));
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual(TAMANO[papel]);
  });

  it('se arma con cada cultivo y etapa del catálogo, y sin cultivo', async () => {
    // Con el nombre que ve la persona (tildes, raya): es lo que la fuente del PDF debe poder escribir.
    const opciones = [
      { valor: '', texto: null },
      ...CULTIVOS_DPV.flatMap((c) =>
        c.etapas.map((e) => ({ valor: `${c.id}:${e.id}`, texto: `${c.nombre} — ${e.nombre}` })),
      ),
    ];
    for (const o of opciones) {
      const { tabla } = armarTabla(con({ cultivoEtapa: o.valor }));
      if (!tabla) throw new Error('sin tabla');
      const bytes = await pdfDeTabla(tabla, 'carta', o.texto);
      expect(bytes.byteLength).toBeGreaterThan(1000);
    }
  });
});
