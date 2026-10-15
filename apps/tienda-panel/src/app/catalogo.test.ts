/**
 * HU-T8.2: el formulario de un producto se convierte en lo que la API espera, sin inventar ceros
 * (CA4), y los problemas de la API vuelven a su campo en la pantalla.
 */
import { describe, expect, it } from 'vitest';
import {
  campoDelProblema,
  combinacionesDe,
  cuerpoDe,
  formularioDe,
  type ProductoDelPanel,
  pesos,
} from './catalogo.ts';

const camisa: ProductoDelPanel = {
  id: 'p-camisa',
  version: 3,
  slug: 'camisa-de-lino',
  nombre: 'Camisa de lino',
  descripcionMd: '',
  estado: 'activo',
  enPapelera: false,
  opciones: [
    { nombre: 'Talla', valores: ['S', 'M'] },
    { nombre: 'Color', valores: ['Arena', 'Azul'] },
  ],
  retracto: { aplica: true },
  soloMayores: false,
  ivaPct: null,
  variantes: [
    {
      id: 'v1',
      valores: ['S', 'Arena'],
      sku: null,
      precioCop: 129000,
      precioAntesCop: null,
      stock: 1,
      reservado: 0,
    },
    {
      id: 'v2',
      valores: ['M', 'Azul'],
      sku: 'CAM-MA',
      precioCop: 119000,
      precioAntesCop: 139000,
      stock: null,
      reservado: 0,
    },
  ],
  medios: [],
};

describe('el formulario de un producto', () => {
  it('pesos como se escriben en Colombia; vacío o ilegible es `null`, nunca 0 (CA4)', () => {
    expect(pesos('129.000')).toBe(129000);
    expect(pesos('$ 129 000')).toBe(129000);
    expect(pesos('129000')).toBe(129000);
    expect(pesos('1.500,50')).toBe(1500.5);
    expect(pesos('')).toBeNull();
    expect(pesos('ciento veinte')).toBeNull();
    expect(pesos('12.34')).toBeNull();
  });

  it('las combinaciones salen de las opciones, en orden; sin opciones hay una sola', () => {
    expect(
      combinacionesDe([
        { nombre: 'Talla', valores: 'S, M,' },
        { nombre: 'Color', valores: 'Arena' },
      ]),
    ).toEqual([
      ['S', 'Arena'],
      ['M', 'Arena'],
    ]);
    expect(combinacionesDe([])).toEqual([[]]);
  });

  it('lo que se leyó vuelve igual: precio, «antes», SKU y «no se cuenta»', () => {
    const f = formularioDe(camisa);
    const { cuerpo, enviadas } = cuerpoDe(
      {
        ...f,
        combinaciones: {
          ...f.combinaciones,
          'S|Azul': { vende: false, precio: '', antes: '', stock: '', noSeCuenta: false, sku: '' },
          'M|Arena': { vende: false, precio: '', antes: '', stock: '', noSeCuenta: false, sku: '' },
        },
      },
      { op: 'op-prueba-01', id: camisa.id, version: camisa.version },
    );
    expect(enviadas).toEqual(['S|Arena', 'M|Azul']);
    expect(cuerpo).toMatchObject({
      op: 'op-prueba-01',
      id: 'p-camisa',
      version: 3,
      slug: 'camisa-de-lino',
      opciones: camisa.opciones,
      variantes: [
        { valores: ['S', 'Arena'], sku: null, precioCop: 129000, precioAntesCop: null, stock: 1 },
        {
          valores: ['M', 'Azul'],
          sku: 'CAM-MA',
          precioCop: 119000,
          precioAntesCop: 139000,
          stock: null,
        },
      ],
    });
  });

  it('❌ CA4: una combinación nueva sin precio ni existencias no se manda como 0', () => {
    const f = formularioDe(camisa);
    const { cuerpo } = cuerpoDe(f, { op: 'op-prueba-02' });
    const nueva = (cuerpo['variantes'] as Record<string, unknown>[]).find(
      (v) => (v['valores'] as string[]).join('|') === 'S|Azul',
    );
    expect(nueva?.['precioCop']).toBeNull();
    expect(nueva && 'stock' in nueva).toBe(false);
  });

  it('un problema de la API vuelve al campo de su combinación en la pantalla', () => {
    const enPantalla = ['S|Arena', 'S|Azul', 'M|Arena', 'M|Azul'];
    const enviadas = ['S|Arena', 'M|Azul'];
    expect(campoDelProblema('variantes.1.stock', enviadas, enPantalla)).toBe('c3-stock');
    expect(campoDelProblema('variantes.0.precioCop', enviadas, enPantalla)).toBe('c0-precio');
    expect(campoDelProblema('variantes.0', enviadas, enPantalla)).toBe('c0-precio');
    expect(campoDelProblema('slug', enviadas, enPantalla)).toBe('slug');
    expect(campoDelProblema('opciones.1.valores', enviadas, enPantalla)).toBe('opciones');
  });
});
