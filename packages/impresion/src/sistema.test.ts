import { describe, expect, it } from 'vitest';
import { RECIBO_ENSAYO_UNO } from './ensayo-uno.fixture.ts';
import {
  AJUSTES_POR_DEFECTO,
  CLASES_DE_LA_HOJA,
  crearImpresoraSistema,
  htmlDeBloques,
  lineasDeHoja,
  type VentanaParaImprimir,
} from './index.ts';

describe('la hoja HTML de 48 mm (HU-Q2.5 CA1)', () => {
  it('dice lo mismo que la térmica, línea por línea', async () => {
    const lineas = lineasDeHoja(await htmlDeBloques(RECIBO_ENSAYO_UNO));
    expect(lineas.slice(0, 5)).toEqual([
      'PARQUEADERO ENSAYO UNO',
      'NIT 900.000.000-0',
      'Tel 3000000000',
      'Calle 1 # 2-3, Bogotá',
      '-'.repeat(32),
    ]);
    expect(lineas).toContain(`RECIBO DE ENTRADA${' '.repeat(7)}A-000123`);
    expect(lineas).toContain('[QR]');
  });

  it('es determinista y escapa el texto: un nombre con «<» no se vuelve HTML', async () => {
    const bloques = [{ tipo: 'texto', texto: 'A <b>&</b> "c"' }] as const;
    const html = await htmlDeBloques(bloques);
    expect(html).toBe(await htmlDeBloques(bloques));
    expect(html).not.toContain('<b>');
    expect(lineasDeHoja(html)).toEqual(['A <b>&</b> "c"']);
  });

  it('sin estilos en línea, que la CSP de la caja no deja', async () => {
    expect(await htmlDeBloques(RECIBO_ENSAYO_UNO)).not.toMatch(/style=|<style/);
  });

  it('con «transliterar», sin tildes, como en el papel', async () => {
    const html = await htmlDeBloques([{ tipo: 'texto', texto: 'Bogotá, año' }], {
      ...AJUSTES_POR_DEFECTO,
      paginaDeCodigos: 'transliterar',
    });
    expect(lineasDeHoja(html)).toEqual(['Bogota, ano']);
  });
});

/** Una ventana mínima: lo que el adaptador toca del DOM. */
function ventanaFalsa(alImprimir: (v: ReturnType<typeof ventanaFalsa>) => void = () => undefined) {
  const hijos: { className: string; innerHTML: string; remove(): void }[] = [];
  const clases = new Set<string>();
  const oyentes: (() => void)[] = [];
  const v = {
    hijos,
    clases,
    impresas: [] as string[],
    despuesDeImprimir: () => {
      for (const o of oyentes.splice(0)) o();
    },
    document: {
      createElement: () => {
        const el = {
          className: '',
          innerHTML: '',
          remove: () => {
            hijos.splice(hijos.indexOf(el), 1);
          },
        };
        return el;
      },
      body: { append: (el: (typeof hijos)[number]) => void hijos.push(el) },
      documentElement: {
        classList: { add: (c: string) => clases.add(c), remove: (c: string) => clases.delete(c) },
      },
      querySelectorAll: (s: string) => hijos.filter((h) => `.${h.className}` === s),
    },
    print: () => {
      v.impresas.push(hijos.map((h) => h.innerHTML).join(''));
      alImprimir(v);
    },
    addEventListener: (_t: string, o: () => void) => void oyentes.push(o),
  };
  return v;
}
const comoVentana = (v: ReturnType<typeof ventanaFalsa>) => v as unknown as VentanaParaImprimir;

describe('el adaptador del diálogo del sistema (HU-Q2.5)', () => {
  it('pone la hoja, imprime y la quita al terminar', async () => {
    const v = ventanaFalsa((x) => {
      expect(x.clases.has(CLASES_DE_LA_HOJA.imprimiendo)).toBe(true);
      x.despuesDeImprimir();
    });
    const impresora = crearImpresoraSistema({ ventana: comoVentana(v), reloj: () => 0 });
    await impresora.vincular();
    expect(impresora.estado()).toBe('conectada');
    const html = await htmlDeBloques(RECIBO_ENSAYO_UNO);
    const r = await impresora.imprimir({ id: '1', formato: 'html', html });
    expect(r).toMatchObject({ ok: true, papel: 'desconocido' });
    expect(v.impresas).toEqual([html]);
    expect(v.hijos).toHaveLength(0);
    expect(v.clases.size).toBe(0);
  });

  it('si «afterprint» no llegó, la hoja vieja no sale en la siguiente', async () => {
    const v = ventanaFalsa();
    const impresora = crearImpresoraSistema({ ventana: comoVentana(v), reloj: () => 0 });
    await impresora.imprimir({ id: '1', formato: 'html', html: 'uno' });
    await impresora.imprimir({ id: '2', formato: 'html', html: 'dos' });
    expect(v.impresas).toEqual(['uno', 'dos']);
  });

  it('ESC/POS no es para el diálogo, y un diálogo que no abre se dice', async () => {
    const v = ventanaFalsa(() => {
      throw new Error('bloqueado');
    });
    const impresora = crearImpresoraSistema({ ventana: comoVentana(v), reloj: () => 0 });
    expect(
      await impresora.imprimir({ id: '1', formato: 'escpos', bytes: new Uint8Array([1]) }),
    ).toMatchObject({ ok: false, motivo: 'no_soportado' });
    expect(await impresora.imprimir({ id: '2', formato: 'html', html: 'x' })).toMatchObject({
      ok: false,
      detalle: expect.stringContaining('bloqueado'),
    });
    expect(v.hijos).toHaveLength(0);
    expect(v.clases.size).toBe(0);
  });
});
