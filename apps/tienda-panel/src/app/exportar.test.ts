import { describe, expect, it } from 'vitest';
import {
  aCsv,
  aXlsx,
  columna,
  crc32,
  type Exportacion,
  hojasDe,
  nombreDelArchivo,
  zip,
} from './exportar.ts';

const cod = new TextEncoder();
const dec = new TextDecoder();

/** Lee un ZIP sin comprimir desde su directorio central, como lo haría Excel. */
function leerZip(b: Uint8Array): Map<string, Uint8Array> {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const fin = b.length - 22;
  expect(v.getUint32(fin, true)).toBe(0x06054b50);
  const cuantos = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const archivos = new Map<string, Uint8Array>();
  for (let i = 0; i < cuantos; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    expect(v.getUint16(p + 10, true), 'sin comprimir').toBe(0);
    const crc = v.getUint32(p + 16, true);
    const tamano = v.getUint32(p + 20, true);
    const largo = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const nombre = dec.decode(b.subarray(p + 46, p + 46 + largo));
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const datos = b.subarray(inicio, inicio + tamano);
    expect(crc32(datos), nombre).toBe(crc);
    archivos.set(nombre, datos);
    p += 46 + largo;
  }
  return archivos;
}

const exportacion: Exportacion = {
  formato: 'tienda-export/1',
  exportada: '2026-10-15T15:00:00.000Z',
  tienda: { slug: 'ensayo-uno', nombre: 'Comercio Ensayo Uno' },
  productos: [
    {
      refExterna: 'p-camisa',
      nombre: 'Camisa de lino, «arena» & <azul>',
      descripcionMd: 'Fresca.',
      estado: 'activo',
      opciones: [{ nombre: 'Talla' }, { nombre: 'Color' }],
      variantes: [
        { valores: ['M', 'Arena'], sku: 'CAM-M', precioCop: 129000, stock: 4 },
        { valores: [], precioCop: 99000, precioAntesCop: 119000, stock: null },
      ],
    },
  ],
  pedidos: [
    {
      codigo: 'EXP0BB',
      creado: '2026-10-15T06:00:00.000Z',
      estado: 'entregado',
      formaPago: 'transferencia',
      lineas: [],
      totales: { subtotal: 129000, descuento: 0, envio: 9000, total: 138000 },
    },
  ],
  excluidos: { pedidosEnCurso: 0, pedidosSinSuVariante: 0 },
};

describe('las hojas en el navegador (HU-T10.7 CA1)', () => {
  it('una fila por variante y una por pedido, con su encabezado', () => {
    const [productos, pedidos] = hojasDe(exportacion);
    expect(productos?.filas).toEqual([
      [
        'Referencia',
        'Producto',
        'Descripción',
        'Opciones',
        'Variante',
        'SKU',
        'Precio',
        'Precio antes',
        'Inventario',
        'Estado',
      ],
      [
        'p-camisa',
        'Camisa de lino, «arena» & <azul>',
        'Fresca.',
        'Talla / Color',
        'M / Arena',
        'CAM-M',
        129000,
        null,
        4,
        'activo',
      ],
      [
        'p-camisa',
        'Camisa de lino, «arena» & <azul>',
        null,
        'Talla / Color',
        '',
        null,
        99000,
        119000,
        null,
        'activo',
      ],
    ]);
    expect(pedidos?.filas[1]).toEqual([
      'EXP0BB',
      '2026-10-15T06:00:00.000Z',
      'entregado',
      'transferencia',
      129000,
      0,
      9000,
      138000,
    ]);
    expect(nombreDelArchivo(exportacion, 'csv', 'Productos')).toBe(
      'ensayo-uno-productos-2026-10-15.csv',
    );
    expect(nombreDelArchivo(exportacion, 'json')).toBe('ensayo-uno-2026-10-15.json');
  });

  it('CSV con BOM y comillas donde hacen falta', () => {
    expect(
      aCsv([
        ['a', 'b, c', 'd "e"'],
        [1, null, 'x\ny'],
      ]),
    ).toBe('﻿a,"b, c","d ""e"""\r\n1,,"x\ny"\r\n');
  });

  it('❌ una celda que empieza como fórmula no se ejecuta', () => {
    expect(aCsv([['=HYPERLINK("http://x")', '+1', '-2', '@SUM(A1)', 'normal']])).toBe(
      `﻿"'=HYPERLINK(""http://x"")",'+1,'-2,'@SUM(A1),normal\r\n`,
    );
    // Un número negativo sigue siendo número.
    expect(aCsv([[-5]])).toBe('﻿-5\r\n');
  });

  it('el CRC-32 es el del estándar', () => {
    expect(crc32(cod.encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('❌ el ZIP se lee desde su directorio central y cada archivo trae su CRC', () => {
    const z = zip([
      { nombre: 'a.txt', datos: cod.encode('hola') },
      { nombre: 'carpeta/ñandú.xml', datos: cod.encode('<x/>') },
    ]);
    const leidos = leerZip(z);
    expect([...leidos.keys()]).toEqual(['a.txt', 'carpeta/ñandú.xml']);
    expect(dec.decode(leidos.get('carpeta/ñandú.xml'))).toBe('<x/>');
  });

  it('XLSX: el libro, sus dos hojas y el texto escapado', () => {
    const archivos = leerZip(aXlsx(hojasDe(exportacion)));
    expect([...archivos.keys()]).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]);
    expect(dec.decode(archivos.get('xl/workbook.xml'))).toContain(
      '<sheet name="Pedidos" sheetId="2" r:id="rId2"/>',
    );
    const hoja = dec.decode(archivos.get('xl/worksheets/sheet1.xml'));
    expect(hoja).toContain(
      '<t xml:space="preserve">Camisa de lino, «arena» &amp; &lt;azul&gt;</t>',
    );
    expect(hoja).toContain('<c r="G2"><v>129000</v></c>');
    // ❌ Un carácter de control no cabe en XML: se quita, y el libro sigue abriendo.
    const raro = dec.decode(
      leerZip(aXlsx([{ nombre: 'Hoja', filas: [['a\u0001b\u001fc\td']] }])).get(
        'xl/worksheets/sheet1.xml',
      ),
    );
    expect(raro).toContain('<t xml:space="preserve">abc\td</t>');
    // Una celda vacía no se escribe.
    expect(hoja).not.toContain('r="F3"');
    expect(columna(0)).toBe('A');
    expect(columna(25)).toBe('Z');
    expect(columna(26)).toBe('AA');
  });
});
