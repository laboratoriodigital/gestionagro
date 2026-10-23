/**
 * «Descargar todo» en el navegador (HU-T10.7 CA1): la API entrega `tienda-export/1` y aquí se
 * arman las hojas, en CSV y en XLSX, sin mandar nada a ningún lado. Puras, para probarlas sin
 * navegador.
 *
 * - CSV con BOM, para que Excel lea las tildes; una celda que empieza con `=`, `+`, `-` o `@` va con
 *   un apóstrofo delante, para que ninguna hoja la ejecute como fórmula.
 * - XLSX mínimo: un ZIP sin comprimir con el libro y una hoja por tabla, en texto en línea. No
 *   necesita ninguna librería.
 */

export interface Exportacion {
  formato: 'tienda-export/1';
  exportada: string;
  tienda: { slug: string; nombre: string };
  productos: {
    refExterna: string;
    nombre: string;
    descripcionMd?: string;
    estado: string;
    opciones?: { nombre: string }[];
    variantes: {
      valores: string[];
      sku?: string;
      precioCop: number;
      precioAntesCop?: number;
      stock: number | null;
    }[];
  }[];
  pedidos: {
    codigo: string;
    creado: string;
    estado: string;
    formaPago: string;
    lineas: unknown[];
    totales: { subtotal: number; descuento: number; envio: number; total: number };
  }[];
  excluidos: { pedidosEnCurso: number; pedidosSinSuVariante: number };
  datosPersonales?: unknown;
}

export type Celda = string | number | null;
export interface Hoja {
  nombre: string;
  filas: Celda[][];
}

/**
 * Las hojas: una fila por variante y una por pedido. La de productos tiene las columnas de la carga
 * por lotes (HU-T18.11), para que se pueda cambiar en Excel y volver a subir: la descripción va en
 * la primera fila de cada producto y «Opciones» dice el nombre de cada grupo.
 */
export function hojasDe(e: Exportacion): Hoja[] {
  return [
    {
      nombre: 'Productos',
      filas: [
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
        ...e.productos.flatMap((p) =>
          p.variantes.map((v, j): Celda[] => [
            p.refExterna,
            p.nombre,
            j === 0 && p.descripcionMd ? p.descripcionMd : null,
            (p.opciones ?? []).map((o) => o.nombre).join(' / ') || null,
            v.valores.join(' / '),
            v.sku ?? null,
            v.precioCop,
            v.precioAntesCop ?? null,
            v.stock,
            p.estado,
          ]),
        ),
      ],
    },
    {
      nombre: 'Pedidos',
      filas: [
        ['Código', 'Fecha', 'Estado', 'Forma de pago', 'Subtotal', 'Descuento', 'Envío', 'Total'],
        ...e.pedidos.map((p): Celda[] => [
          p.codigo,
          p.creado,
          p.estado,
          p.formaPago,
          p.totales.subtotal,
          p.totales.descuento,
          p.totales.envio,
          p.totales.total,
        ]),
      ],
    },
  ];
}

/** El nombre del archivo: la tienda y el día, sin nada que un sistema de archivos rechace. */
export const nombreDelArchivo = (
  e: Pick<Exportacion, 'tienda' | 'exportada'>,
  extension: string,
  hoja?: string,
) =>
  `${e.tienda.slug || 'tienda'}-${hoja ? `${hoja.toLowerCase()}-` : ''}${e.exportada.slice(0, 10)}.${extension}`;

/** Lo que una hoja de cálculo lee como fórmula: `=`, `+`, `-`, `@`, o un tabulador o retorno. */
const PELIGRO_DE_FORMULA = new Set(['=', '+', '-', '@', '\t', '\r']);
const textoSeguro = (t: string) => (PELIGRO_DE_FORMULA.has(t.charAt(0)) ? `'${t}` : t);

export function aCsv(filas: readonly Celda[][]): string {
  const celda = (c: Celda) => {
    if (c === null) return '';
    if (typeof c === 'number') return String(c);
    const t = textoSeguro(c);
    return /[",\r\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
  };
  return `﻿${filas.map((f) => f.map(celda).join(',')).join('\r\n')}\r\n`;
}

// ── XLSX ────────────────────────────────────────────────────────────────────────────────────

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (TABLA_CRC[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Un ZIP sin comprimir (método 0), con los nombres en UTF-8. */
export function zip(
  archivos: readonly { nombre: string; datos: Uint8Array }[],
): Uint8Array<ArrayBuffer> {
  const cod = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;
  const cabecera = (largo: number, escribir: (v: DataView) => void) => {
    const b = new Uint8Array(largo);
    escribir(new DataView(b.buffer));
    return b;
  };
  // 1 de enero de 1980, la primera fecha que cabe en un ZIP: el archivo no dice cuándo se armó.
  const FECHA = 0x0021;
  for (const a of archivos) {
    const nombre = cod.encode(a.nombre);
    const crc = crc32(a.datos);
    const local = cabecera(30, (v) => {
      v.setUint32(0, 0x04034b50, true);
      v.setUint16(4, 20, true);
      v.setUint16(6, 0x0800, true);
      v.setUint16(8, 0, true);
      v.setUint16(10, 0, true);
      v.setUint16(12, FECHA, true);
      v.setUint32(14, crc, true);
      v.setUint32(18, a.datos.length, true);
      v.setUint32(22, a.datos.length, true);
      v.setUint16(26, nombre.length, true);
      v.setUint16(28, 0, true);
    });
    central.push(
      cabecera(46, (v) => {
        v.setUint32(0, 0x02014b50, true);
        v.setUint16(4, 20, true);
        v.setUint16(6, 20, true);
        v.setUint16(8, 0x0800, true);
        v.setUint16(10, 0, true);
        v.setUint16(12, 0, true);
        v.setUint16(14, FECHA, true);
        v.setUint32(16, crc, true);
        v.setUint32(20, a.datos.length, true);
        v.setUint32(24, a.datos.length, true);
        v.setUint16(28, nombre.length, true);
        v.setUint32(42, desplazamiento, true);
      }),
      nombre,
    );
    partes.push(local, nombre, a.datos);
    desplazamiento += local.length + nombre.length + a.datos.length;
  }
  const tamanoCentral = central.reduce((s, b) => s + b.length, 0);
  const fin = cabecera(22, (v) => {
    v.setUint32(0, 0x06054b50, true);
    v.setUint16(8, archivos.length, true);
    v.setUint16(10, archivos.length, true);
    v.setUint32(12, tamanoCentral, true);
    v.setUint32(16, desplazamiento, true);
  });
  const todo = [...partes, ...central, fin];
  const salida = new Uint8Array(todo.reduce((s, b) => s + b.length, 0));
  let i = 0;
  for (const b of todo) {
    salida.set(b, i);
    i += b.length;
  }
  return salida;
}

/** Lo que XML 1.0 no admite se quita: un carácter de control no es un dato. */
const admitidoEnXml = (c: string) => {
  const n = c.charCodeAt(0);
  return n === 0x9 || n === 0xa || n === 0xd || (n >= 0x20 && n !== 0xfffe && n !== 0xffff);
};
const xml = (t: string) =>
  [...t]
    .filter(admitidoEnXml)
    .join('')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** «A», «B», … «Z», «AA»: la columna de una celda. */
export function columna(i: number): string {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const CABECERA_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org';

function hojaXml(h: Hoja): string {
  const filas = h.filas
    .map((f, i) => {
      const celdas = f
        .map((c, j) => {
          const ref = `${columna(j)}${i + 1}`;
          if (c === null) return '';
          if (typeof c === 'number' && Number.isFinite(c)) return `<c r="${ref}"><v>${c}</v></c>`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(String(c))}</t></is></c>`;
        })
        .join('');
      return `<row r="${i + 1}">${celdas}</row>`;
    })
    .join('');
  return `${CABECERA_XML}<worksheet xmlns="${NS}/spreadsheetml/2006/main"><sheetData>${filas}</sheetData></worksheet>`;
}

export function aXlsx(hojas: readonly Hoja[]): Uint8Array<ArrayBuffer> {
  const cod = new TextEncoder();
  const n = hojas.map((_, i) => i + 1);
  const archivos: Record<string, string> = {
    '[Content_Types].xml': `${CABECERA_XML}<Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${n.map((i) => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': `${CABECERA_XML}<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${CABECERA_XML}<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets>${hojas.map((h, i) => `<sheet name="${xml(h.nombre.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${CABECERA_XML}<Relationships xmlns="${NS}/package/2006/relationships">${n.map((i) => `<Relationship Id="rId${i}" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`).join('')}</Relationships>`,
  };
  hojas.forEach((h, i) => {
    archivos[`xl/worksheets/sheet${i + 1}.xml`] = hojaXml(h);
  });
  return zip(Object.entries(archivos).map(([nombre, t]) => ({ nombre, datos: cod.encode(t) })));
}
