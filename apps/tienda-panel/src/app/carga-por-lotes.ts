/**
 * Cargar productos por lotes desde una hoja y subir un respaldo (HU-T18.11), en los planes Pro e
 * IA Pro. Aquí, en el teléfono, se lee la hoja y se arma el archivo `tienda-import/1` que la API
 * revisa y aplica por partes (HU-T12.2). Puras, para probarlas sin navegador.
 *
 * - La hoja es un CSV: el que baja «Descargar todo › Productos en CSV» o la plantilla de aquí. Sirve
 *   con coma, punto y coma (el Excel en español) o tabulador, en UTF-8 o en el de Windows.
 * - Una fila por combinación. Las filas con la misma referencia son un solo producto.
 * - Todo problema se dice con su fila, y todos a la vez (P15).
 */
import { aCsv, type Celda } from './exportar.ts';

export interface Problema {
  /** La fila de la hoja, contando el encabezado como la 1; `null`, del archivo entero. */
  fila: number | null;
  mensaje: string;
}

/** Las columnas de la plantilla, en orden. Las de «Descargar todo» son un subconjunto. */
export const COLUMNAS = [
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
  'Colección',
] as const;
type Columna = (typeof COLUMNAS)[number];

/**
 * Cuántas filas se leen de una vez. Cada parte de la carga vuelve a revisar el archivo entero en la
 * API, y en el plan gratuito de Cloudflare cada solicitud tiene poco tiempo de cómputo: una hoja más
 * grande va en varias.
 */
export const FILAS_MAXIMAS = 500;

/** La plantilla, con tres productos de ejemplo: uno con tallas y colores, y dos sencillos. */
export function plantillaCsv(): string {
  const filas: Celda[][] = [
    [...COLUMNAS],
    [
      'CAM-01',
      'Camisa de lino',
      'Fresca y de manga larga.',
      'Talla / Color',
      'S / Blanco',
      'CAM-01-SB',
      89000,
      null,
      5,
      'activo',
      'Camisas',
    ],
    [
      'CAM-01',
      'Camisa de lino',
      null,
      'Talla / Color',
      'M / Blanco',
      'CAM-01-MB',
      89000,
      null,
      3,
      'activo',
      'Camisas',
    ],
    [
      'CAM-01',
      'Camisa de lino',
      null,
      'Talla / Color',
      'M / Azul',
      'CAM-01-MA',
      89000,
      99000,
      0,
      'activo',
      'Camisas',
    ],
    [
      'PAN-01',
      'Pan de bono',
      'Recién horneado cada mañana.',
      null,
      null,
      null,
      1500,
      null,
      null,
      'activo',
      'Panadería',
    ],
    ['VEL-01', 'Vela de soya', null, null, null, null, 32000, null, 12, 'borrador', null],
  ];
  return aCsv(filas);
}

/** Los bytes del archivo como texto: UTF-8 si lo es, si no el de Windows (Excel sin «UTF-8»). */
export function decodificar(bytes: Uint8Array): string {
  let texto: string;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder('windows-1252').decode(bytes);
  }
  return texto.replace(/^﻿/, '');
}

/** El separador de la hoja: el que más aparece en el encabezado, fuera de comillas. */
function separadorDe(texto: string): string {
  const primera = texto.split(/\r?\n/, 1)[0] ?? '';
  const fuera = primera.replace(/"[^"]*"/g, '');
  const cuenta = (s: string) => fuera.split(s).length - 1;
  return [',', ';', '\t'].reduce((a, b) => (cuenta(b) > cuenta(a) ? b : a), ',');
}

/** Lee un CSV con comillas como lo escribe Excel. Las filas vacías no cuentan. */
export function leerCsv(texto: string): string[][] {
  const sep = separadorDe(texto);
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else celda += c;
  }
  if (celda !== '' || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((x) => x.trim() !== ''));
}

/** Para comparar encabezados y valores: sin tildes, sin mayúsculas y sin espacios de más. */
const plano = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Otros nombres con que llega cada columna. */
const SINONIMOS: Record<string, Columna> = {
  referencia: 'Referencia',
  ref: 'Referencia',
  producto: 'Producto',
  nombre: 'Producto',
  descripcion: 'Descripción',
  opciones: 'Opciones',
  variante: 'Variante',
  combinacion: 'Variante',
  sku: 'SKU',
  precio: 'Precio',
  'precio antes': 'Precio antes',
  'precio de antes': 'Precio antes',
  inventario: 'Inventario',
  existencias: 'Inventario',
  stock: 'Inventario',
  estado: 'Estado',
  coleccion: 'Colección',
  categoria: 'Colección',
};

/** Una dirección: minúsculas, números y guiones, sin «--». */
export function direccionDe(texto: string, largo = 40): string {
  return plano(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, largo)
    .replace(/-$/, '');
}

/** Una referencia válida: letras, números, punto, guion o guion bajo, de 1 a 60. */
const referenciaDe = (texto: string) =>
  texto
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

/** El apóstrofo que «Descargar todo» pone delante de lo que una hoja leería como fórmula. */
const sinApostrofo = (t: string) => (/^'[=+\-@]/.test(t) ? t.slice(1) : t);

/** Pesos enteros: «24900», «24.900» o «$ 24.900». `null` si está vacío; `NaN` si no se entiende. */
export function pesosDe(texto: string): number | null {
  const t = texto.replace(/\s|\$|cop/gi, '');
  if (t === '') return null;
  if (/^\d+$/.test(t)) return Number(t);
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replaceAll('.', ''));
  if (/^\d{1,3}(,\d{3})+$/.test(t)) return Number(t.replaceAll(',', ''));
  return Number.NaN;
}

const ESTADOS: Record<string, 'activo' | 'borrador' | 'archivado'> = {
  activo: 'activo',
  activa: 'activo',
  publicado: 'activo',
  visible: 'activo',
  si: 'activo',
  borrador: 'borrador',
  oculto: 'borrador',
  no: 'borrador',
  archivado: 'archivado',
};

interface Variante {
  valores: string[];
  sku?: string | null;
  precioCop: number;
  precioAntesCop?: number | null;
  stock?: number | null;
}
interface ProductoDeLaHoja {
  refExterna: string;
  nombre: string;
  descripcionMd?: string;
  estado?: 'activo' | 'borrador' | 'archivado';
  opciones: { nombre: string; valores: string[] }[];
  variantes: Variante[];
  colecciones: string[];
}
export interface CargaDeLaHoja {
  formato: 'tienda-import/1';
  tienda: { slug: string; nombre: string };
  ajustes: Record<string, never>;
  colecciones: { refExterna: string; nombre: string; slug: string }[];
  productos: ProductoDeLaHoja[];
}

export interface Lectura {
  carga: CargaDeLaHoja | null;
  problemas: Problema[];
  /** La fila de cada combinación: `filas[producto][variante]`, para decir dónde está un problema. */
  filas: number[][];
}

/**
 * La hoja leída, como archivo de carga. Si hay problemas, `carga` es `null` y van todos juntos.
 * Los productos que se crearon en el panel no se tocan: la carga crea o actualiza los de la hoja,
 * por su referencia. Una columna que la hoja no trae no cambia nada en lo que ya existe: una hoja
 * con solo «Producto» y «Precio» actualiza los precios y deja lo demás como está.
 */
export function cargaDesdeLaHoja(
  hoja: readonly string[][],
  tienda: { slug: string; nombre: string },
): Lectura {
  const problemas: Problema[] = [];
  const [encabezado, ...cuerpo] = hoja;
  if (!encabezado || cuerpo.length === 0) {
    return {
      carga: null,
      problemas: [
        {
          fila: null,
          mensaje: 'La hoja está vacía: tiene que traer el encabezado y al menos un producto.',
        },
      ],
      filas: [],
    };
  }
  if (cuerpo.length > FILAS_MAXIMAS) {
    return {
      carga: null,
      problemas: [
        {
          fila: null,
          mensaje: `La hoja trae ${cuerpo.length} filas: carga hasta ${FILAS_MAXIMAS} de una vez y sube el resto en otra hoja.`,
        },
      ],
      filas: [],
    };
  }
  const indice = new Map<Columna, number>();
  encabezado.forEach((nombre, i) => {
    const columna = SINONIMOS[plano(sinApostrofo(nombre))];
    if (columna && !indice.has(columna)) indice.set(columna, i);
  });
  for (const falta of ['Producto', 'Precio'] as const) {
    if (!indice.has(falta)) {
      problemas.push({ fila: 1, mensaje: `Falta la columna «${falta}» en el encabezado.` });
    }
  }
  if (problemas.length > 0) return { carga: null, problemas, filas: [] };

  const trae = (c: Columna) => indice.has(c);
  const valor = (fila: readonly string[], c: Columna) => {
    const i = indice.get(c);
    return i === undefined ? '' : sinApostrofo((fila[i] ?? '').trim());
  };
  const productos: ProductoDeLaHoja[] = [];
  const filas: number[][] = [];
  const porReferencia = new Map<string, number>();
  const colecciones = new Map<string, { refExterna: string; nombre: string; slug: string }>();

  for (const [i, f] of cuerpo.entries()) {
    const n = i + 2;
    const nombre = valor(f, 'Producto');
    const dijo = (mensaje: string) => problemas.push({ fila: n, mensaje });
    if (!nombre) {
      dijo(`Fila ${n}: falta el nombre del producto.`);
      continue;
    }
    const ref = referenciaDe(valor(f, 'Referencia')) || referenciaDe(direccionDe(nombre, 60));
    if (!ref) {
      dijo(`Fila ${n}: el nombre «${nombre}» necesita letras o números.`);
      continue;
    }

    const precio = pesosDe(valor(f, 'Precio'));
    if (precio === null) dijo(`Fila ${n}: falta el precio.`);
    else if (Number.isNaN(precio) || precio < 1)
      dijo(`Fila ${n}: escribe el precio en pesos, sin centavos (por ejemplo 24900).`);
    const antes = pesosDe(valor(f, 'Precio antes'));
    if (antes !== null && Number.isNaN(antes))
      dijo(`Fila ${n}: escribe el precio de antes en pesos, sin centavos, o déjalo vacío.`);
    else if (antes !== null && precio !== null && antes <= precio)
      dijo(`Fila ${n}: el precio de antes tiene que ser mayor que el precio.`);
    const inventarioTexto = valor(f, 'Inventario').replace(/\./g, '');
    const stock = inventarioTexto === '' ? null : Number(inventarioTexto);
    if (stock !== null && (!Number.isInteger(stock) || stock < 0))
      dijo(`Fila ${n}: el inventario es un número entero, o vacío si no lo cuentas.`);
    const estadoTexto = plano(valor(f, 'Estado'));
    const estado = estadoTexto === '' ? undefined : ESTADOS[estadoTexto];
    if (estadoTexto !== '' && !estado)
      dijo(`Fila ${n}: el estado es «activo», «borrador» o «archivado».`);

    const valores = valor(f, 'Variante')
      .split('/')
      .map((v) => v.trim())
      .filter(Boolean);
    const nombresDeOpciones = valor(f, 'Opciones')
      .split('/')
      .map((v) => v.trim())
      .filter(Boolean);
    if (nombresDeOpciones.length > 0 && nombresDeOpciones.length !== valores.length)
      dijo(
        `Fila ${n}: «Opciones» nombra ${nombresDeOpciones.length} y «Variante» trae ${valores.length}; separa cada una con «/».`,
      );
    const sku = valor(f, 'SKU');
    const descripcion = valor(f, 'Descripción');
    const nombreDeColeccion = valor(f, 'Colección');

    let p = porReferencia.get(ref);
    if (p === undefined) {
      p = productos.length;
      porReferencia.set(ref, p);
      productos.push({
        refExterna: ref,
        nombre,
        ...(descripcion ? { descripcionMd: descripcion } : {}),
        ...(estado ? { estado } : {}),
        opciones: valores.map((_, k) => ({
          nombre: nombresDeOpciones[k] ?? `Opción ${k + 1}`,
          valores: [],
        })),
        variantes: [],
        colecciones: [],
      });
      filas.push([]);
    }
    const producto = productos[p] as ProductoDeLaHoja;
    if (descripcion && producto.descripcionMd === undefined) producto.descripcionMd = descripcion;
    if (producto.opciones.length !== valores.length) {
      dijo(
        producto.opciones.length === 0
          ? `Fila ${n}: la referencia ${ref} ya tiene una fila sin variante; si tiene tallas o colores, escríbelos en «Variante» en todas sus filas.`
          : `Fila ${n}: la referencia ${ref} tiene ${producto.opciones.length} opciones y esta fila trae ${valores.length} en «Variante».`,
      );
      continue;
    }
    valores.forEach((v, k) => {
      const grupo = producto.opciones[k];
      if (grupo && !grupo.valores.includes(v)) grupo.valores.push(v);
    });
    if (producto.variantes.some((x) => x.valores.join('/') === valores.join('/'))) {
      dijo(
        valores.length === 0
          ? `Fila ${n}: la referencia ${ref} está repetida; si tiene variantes, escríbelas en «Variante».`
          : `Fila ${n}: la combinación «${valores.join(' / ')}» de ${ref} está repetida.`,
      );
      continue;
    }
    // Con la columna, una celda vacía quita el SKU o el precio de antes, y deja de contar el
    // inventario; sin la columna, no se toca.
    producto.variantes.push({
      valores,
      ...(trae('SKU') ? { sku: sku || null } : {}),
      precioCop: precio && !Number.isNaN(precio) ? precio : 1,
      ...(trae('Precio antes')
        ? { precioAntesCop: antes !== null && !Number.isNaN(antes) ? antes : null }
        : {}),
      ...(trae('Inventario')
        ? { stock: stock !== null && Number.isInteger(stock) && stock >= 0 ? stock : null }
        : {}),
    });
    (filas[p] as number[]).push(n);
    if (nombreDeColeccion) {
      const slug = direccionDe(nombreDeColeccion);
      if (slug.length < 3) {
        dijo(`Fila ${n}: el nombre de la colección «${nombreDeColeccion}» es muy corto.`);
      } else {
        const refCol = `col-${slug}`;
        if (!colecciones.has(refCol))
          colecciones.set(refCol, { refExterna: refCol, nombre: nombreDeColeccion, slug });
        if (!producto.colecciones.includes(refCol)) producto.colecciones.push(refCol);
      }
    }
  }

  if (problemas.length > 0) return { carga: null, problemas, filas };
  return {
    carga: {
      formato: 'tienda-import/1',
      tienda,
      ajustes: {},
      colecciones: [...colecciones.values()],
      productos,
    },
    problemas: [],
    filas,
  };
}

/**
 * Un problema de la API, con su fila: el lugar que dice la revisión (`productos.3.variantes.0…` o
 * `productos.3 (REF).variantes.0`) vuelve a la fila de la hoja.
 */
export function problemaDeLaApi(
  p: { campo: string; mensaje: string },
  filas: readonly (readonly number[])[],
): Problema {
  const m = /^productos\.(\d+)(?: \([^)]*\))?(?:\.variantes\.(\d+))?/.exec(p.campo);
  const delProducto = m ? filas[Number(m[1])] : undefined;
  const fila = delProducto ? (delProducto[m?.[2] ? Number(m[2]) : 0] ?? delProducto[0]) : undefined;
  return fila
    ? { fila, mensaje: `Fila ${fila}: ${p.mensaje}.` }
    : { fila: null, mensaje: p.campo ? `${p.campo}: ${p.mensaje}.` : `${p.mensaje}.` };
}

/** Un respaldo de «Descargar todo», listo para subir: sin los datos personales, que no se cargan. */
export function respaldoDesde(
  texto: string,
): { ok: true; carga: Record<string, unknown> } | { ok: false; motivo: string } {
  let datos: unknown;
  try {
    datos = JSON.parse(texto.replace(/^﻿/, ''));
  } catch {
    return {
      ok: false,
      motivo: 'El archivo no es un respaldo: sube el archivo que baja «Descargar todo».',
    };
  }
  if (
    !datos ||
    typeof datos !== 'object' ||
    !['tienda-export/1', 'tienda-import/1'].includes(
      String((datos as { formato?: unknown }).formato),
    )
  ) {
    return {
      ok: false,
      motivo: 'El archivo no es un respaldo: sube el archivo que baja «Descargar todo».',
    };
  }
  const { datosPersonales: _, ...sinPersonales } = datos as Record<string, unknown>;
  return { ok: true, carga: sinPersonales };
}
