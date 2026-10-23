import { revisarCarga } from '@ed1/tienda-schema';
import { describe, expect, it } from 'vitest';
import {
  cargaDesdeLaHoja,
  decodificar,
  FILAS_MAXIMAS,
  leerCsv,
  pesosDe,
  plantillaCsv,
  problemaDeLaApi,
  respaldoDesde,
} from './carga-por-lotes.ts';
import { aCsv, type Exportacion, hojasDe } from './exportar.ts';

const TIENDA = { slug: 'lino-taller', nombre: 'Lino Taller' };
const leer = (csv: string) => cargaDesdeLaHoja(leerCsv(csv), TIENDA);

describe('la hoja de productos por lotes (HU-T18.11)', () => {
  it('la plantilla se lee sin problemas y es un archivo de carga válido', () => {
    const r = leer(decodificar(new TextEncoder().encode(plantillaCsv())));
    expect(r.problemas).toEqual([]);
    expect(r.carga?.productos.map((p) => [p.refExterna, p.variantes.length])).toEqual([
      ['CAM-01', 3],
      ['PAN-01', 1],
      ['VEL-01', 1],
    ]);
    const camisa = r.carga?.productos[0];
    expect(camisa?.opciones).toEqual([
      { nombre: 'Talla', valores: ['S', 'M'] },
      { nombre: 'Color', valores: ['Blanco', 'Azul'] },
    ]);
    expect(camisa?.variantes[2]).toEqual({
      valores: ['M', 'Azul'],
      sku: 'CAM-01-MA',
      precioCop: 89000,
      precioAntesCop: 99000,
      stock: 0,
    });
    expect(r.carga?.colecciones).toEqual([
      { refExterna: 'col-camisas', nombre: 'Camisas', slug: 'camisas' },
      { refExterna: 'col-panaderia', nombre: 'Panadería', slug: 'panaderia' },
    ]);
    expect(r.filas).toEqual([[2, 3, 4], [5], [6]]);
    expect(revisarCarga(r.carga)).toMatchObject({ ok: true });
  });

  it('lee el CSV de Excel en español: punto y coma, comillas y el texto de Windows', () => {
    const bytes = Uint8Array.from([
      ...new TextEncoder().encode('Producto;Precio;Descripci'),
      0xf3, // «ó» en windows-1252
      ...new TextEncoder().encode('n\r\n"Jab'),
      0xf3,
      ...new TextEncoder().encode('n; de avena";"$ 12.500";"Suave; sin olor"\r\n;;\r\n'),
    ]);
    const filas = leerCsv(decodificar(bytes));
    expect(filas).toEqual([
      ['Producto', 'Precio', 'Descripción'],
      ['Jabón; de avena', '$ 12.500', 'Suave; sin olor'],
    ]);
    const r = cargaDesdeLaHoja(filas, TIENDA);
    // Sin las columnas Estado, SKU, Precio antes ni Inventario, nada de eso se toca al cargar.
    expect(r.carga?.productos[0]).toEqual({
      refExterna: 'jabon-de-avena',
      nombre: 'Jabón; de avena',
      descripcionMd: 'Suave; sin olor',
      opciones: [],
      variantes: [{ valores: [], precioCop: 12500 }],
      colecciones: [],
    });
  });

  it('los precios en pesos: con o sin puntos y signo; con centavos no', () => {
    expect(pesosDe('24900')).toBe(24900);
    expect(pesosDe('$ 24.900')).toBe(24900);
    expect(pesosDe('1,250,000')).toBe(1250000);
    expect(pesosDe('')).toBeNull();
    expect(pesosDe('24900,50')).toBeNaN();
    expect(pesosDe('veinte')).toBeNaN();
  });

  it('❌ todos los problemas a la vez, cada uno con su fila', () => {
    const r = leer(
      [
        'Referencia,Producto,Opciones,Variante,Precio,Precio antes,Inventario,Estado',
        'A,,,,1000,,,',
        'B,Bolso,,,mil,,,',
        'C,Gorra,,,20000,15000,-2,vendido',
        'D,Vestido,Talla,S,80000,,,',
        'D,Vestido,Talla,S,80000,,,',
        'D,Vestido,,,80000,,,',
      ].join('\n'),
    );
    expect(r.carga).toBeNull();
    expect(r.problemas).toEqual([
      { fila: 2, mensaje: 'Fila 2: falta el nombre del producto.' },
      { fila: 3, mensaje: 'Fila 3: escribe el precio en pesos, sin centavos (por ejemplo 24900).' },
      { fila: 4, mensaje: 'Fila 4: el precio de antes tiene que ser mayor que el precio.' },
      { fila: 4, mensaje: 'Fila 4: el inventario es un número entero, o vacío si no lo cuentas.' },
      { fila: 4, mensaje: 'Fila 4: el estado es «activo», «borrador» o «archivado».' },
      { fila: 6, mensaje: 'Fila 6: la combinación «S» de D está repetida.' },
      {
        fila: 7,
        mensaje: 'Fila 7: la referencia D tiene 1 opciones y esta fila trae 0 en «Variante».',
      },
    ]);
  });

  it('❌ sin las columnas Producto y Precio, o vacía, o con demasiadas filas, no se lee', () => {
    expect(leer('Nombre del producto,Valor\nA,1').problemas).toEqual([
      { fila: 1, mensaje: 'Falta la columna «Producto» en el encabezado.' },
      { fila: 1, mensaje: 'Falta la columna «Precio» en el encabezado.' },
    ]);
    expect(leer('Producto,Precio\n').problemas[0]?.mensaje).toMatch(/está vacía/);
    const muchas = [
      'Producto,Precio',
      ...Array.from({ length: FILAS_MAXIMAS + 1 }, (_, i) => `P${i},1000`),
    ];
    expect(leer(muchas.join('\n')).problemas[0]?.mensaje).toMatch(/carga hasta 500/);
  });

  it('la hoja de «Descargar todo» vuelve a entrar tal cual, con sus variantes', () => {
    const e: Exportacion = {
      formato: 'tienda-export/1',
      exportada: '2026-10-23T00:00:00.000Z',
      tienda: TIENDA,
      productos: [
        {
          refExterna: 'p-0199',
          nombre: 'Camisa',
          descripcionMd: 'De lino, fresca.',
          estado: 'activo',
          opciones: [{ nombre: 'Talla' }],
          variantes: [
            { valores: ['S'], sku: '=RARO', precioCop: 50000, stock: 2 },
            { valores: ['M'], precioCop: 50000, precioAntesCop: 60000, stock: null },
          ],
        },
      ],
      pedidos: [],
      excluidos: { pedidosEnCurso: 0, pedidosSinSuVariante: 0 },
    };
    const [productos] = hojasDe(e);
    const r = leer(decodificar(new TextEncoder().encode(aCsv(productos?.filas ?? []))));
    expect(r.problemas).toEqual([]);
    expect(r.carga?.productos).toEqual([
      {
        refExterna: 'p-0199',
        nombre: 'Camisa',
        descripcionMd: 'De lino, fresca.',
        estado: 'activo',
        opciones: [{ nombre: 'Talla', valores: ['S', 'M'] }],
        variantes: [
          { valores: ['S'], sku: '=RARO', precioCop: 50000, precioAntesCop: null, stock: 2 },
          { valores: ['M'], sku: null, precioCop: 50000, precioAntesCop: 60000, stock: null },
        ],
        colecciones: [],
      },
    ]);
  });

  it('un problema de la API vuelve a la fila de la hoja', () => {
    const filas = [[2, 3], [4]];
    expect(
      problemaDeLaApi({ campo: 'productos.0.variantes.1.precioCop', mensaje: 'muy alto' }, filas),
    ).toEqual({
      fila: 3,
      mensaje: 'Fila 3: muy alto.',
    });
    expect(
      problemaDeLaApi({ campo: 'productos.1 (B)', mensaje: 'la combinación está repetida' }, filas),
    ).toEqual({
      fila: 4,
      mensaje: 'Fila 4: la combinación está repetida.',
    });
    expect(problemaDeLaApi({ campo: 'colecciones', mensaje: 'algo' }, filas)).toEqual({
      fila: null,
      mensaje: 'colecciones: algo.',
    });
  });
});

describe('subir un respaldo (HU-T18.11)', () => {
  it('el archivo de «Descargar todo» sube sin los datos personales', () => {
    const r = respaldoDesde(
      JSON.stringify({
        formato: 'tienda-export/1',
        tienda: TIENDA,
        datosPersonales: { pedidos: [] },
      }),
    );
    expect(r).toEqual({ ok: true, carga: { formato: 'tienda-export/1', tienda: TIENDA } });
  });

  it('❌ otro archivo no es un respaldo', () => {
    expect(respaldoDesde('no es json')).toMatchObject({ ok: false });
    expect(respaldoDesde(JSON.stringify({ formato: 'otro' }))).toMatchObject({ ok: false });
  });
});
