/**
 * HU-T8.2: el formulario de un producto, sin pantalla. Lo que la persona escribe se queda como lo
 * escribió (texto) y se convierte al enviarlo; así el borrador sobrevive a «vuelve a entrar».
 *
 * CA4: un precio vacío o ilegible se manda como `null` y la API dice qué falta: nunca se vuelve 0.
 * Unas existencias vacías no son «no se cuenta»: eso es una casilla aparte, a propósito.
 */

export interface ProductoDelPanel {
  id: string;
  version: number;
  slug: string;
  nombre: string;
  descripcionMd: string;
  estado: string;
  enPapelera: boolean;
  opciones: { nombre: string; valores: string[] }[];
  retracto: { aplica: true } | { aplica: false; motivo: string };
  soloMayores: boolean;
  ivaPct: number | null;
  variantes: {
    id: string;
    valores: string[];
    sku: string | null;
    precioCop: number;
    precioAntesCop: number | null;
    stock: number | null;
    reservado: number;
  }[];
}

export interface FilaDeProducto {
  id: string;
  slug: string;
  nombre: string;
  estado: string;
  version: number;
  combinaciones: number;
  desde: number | null;
  existencias: number | null;
  borrado: string | null;
}

export interface Combinacion {
  /** Se vende: si no, no se manda y la API la deja inactiva. */
  vende: boolean;
  precio: string;
  antes: string;
  stock: string;
  noSeCuenta: boolean;
  sku: string;
}

export interface FormularioDeProducto {
  nombre: string;
  estado: string;
  descripcion: string;
  slug: string;
  /** Los valores van separados por coma, como se escriben en el teléfono. */
  opciones: { nombre: string; valores: string }[];
  combinaciones: Record<string, Combinacion>;
  retractoAplica: boolean;
  retractoMotivo: string;
  soloMayores: boolean;
}

export const ESTADOS: readonly { id: string; texto: string }[] = [
  { id: 'borrador', texto: 'Borrador: no se ve en la tienda' },
  { id: 'activo', texto: 'Activo: se ve y se vende' },
  { id: 'archivado', texto: 'Archivado: ya no se vende' },
];

const formatoPesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
export const enPesos = (n: number) => `$${formatoPesos.format(n)}`;

/** Los valores de un grupo, sin vacíos: «S, M ,L,» es S, M y L. */
export const valoresDe = (texto: string) =>
  texto
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

/** Todas las combinaciones de las opciones, en orden; sin opciones, una sola (la única). */
export function combinacionesDe(opciones: FormularioDeProducto['opciones']): string[][] {
  return opciones
    .map((o) => valoresDe(o.valores))
    .filter((v) => v.length > 0)
    .reduce<string[][]>(
      (todas, valores) => todas.flatMap((c) => valores.map((v) => [...c, v])),
      [[]],
    );
}

export const claveDe = (valores: readonly string[]) => valores.join('|');

/**
 * Pesos escritos como en Colombia: «129.000», «$ 129 000», «129000». Con centavos («1.500,50»)
 * devuelve el número con decimales y la API lo rechaza con su mensaje. Vacío o ilegible: `null`.
 */
export function pesos(texto: string): number | null {
  const t = texto.replace(/[$\s ]/g, '');
  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(t)) return null;
  return Number(t.replace(/\./g, '').replace(',', '.'));
}

const sinCombinacion = (): Combinacion => ({
  vende: true,
  precio: '',
  antes: '',
  stock: '',
  noSeCuenta: false,
  sku: '',
});

export function formularioDe(p: ProductoDelPanel | null): FormularioDeProducto {
  const combinaciones: Record<string, Combinacion> = {};
  for (const v of p?.variantes ?? []) {
    combinaciones[claveDe(v.valores)] = {
      vende: true,
      precio: formatoPesos.format(v.precioCop),
      antes: v.precioAntesCop === null ? '' : formatoPesos.format(v.precioAntesCop),
      stock: v.stock === null ? '' : String(v.stock),
      noSeCuenta: v.stock === null,
      sku: v.sku ?? '',
    };
  }
  return {
    nombre: p?.nombre ?? '',
    estado: p?.estado ?? 'borrador',
    descripcion: p?.descripcionMd ?? '',
    slug: p?.slug ?? '',
    opciones: (p?.opciones ?? []).map((o) => ({ nombre: o.nombre, valores: o.valores.join(', ') })),
    combinaciones,
    retractoAplica: p ? p.retracto.aplica : true,
    retractoMotivo: p && !p.retracto.aplica ? p.retracto.motivo : '',
    soloMayores: p?.soloMayores ?? false,
  };
}

/** La combinación de una clave, o una nueva vacía si todavía no se escribió nada en ella. */
export const combinacion = (f: FormularioDeProducto, clave: string): Combinacion =>
  f.combinaciones[clave] ?? sinCombinacion();

/**
 * El cuerpo de `productos/guardar` y, en `enviadas`, la clave de cada variante en el orden en que
 * va: la API responde los problemas como `variantes.<n>.<campo>`.
 */
export function cuerpoDe(
  f: FormularioDeProducto,
  ids: { op: string; id?: string; version?: number },
): { cuerpo: Record<string, unknown>; enviadas: string[] } {
  const opciones = f.opciones
    .map((o) => ({ nombre: o.nombre.trim(), valores: valoresDe(o.valores) }))
    .filter((o) => o.nombre || o.valores.length > 0);
  const enviadas: string[] = [];
  const variantes = combinacionesDe(f.opciones).flatMap((valores) => {
    const clave = claveDe(valores);
    const c = combinacion(f, clave);
    if (!c.vende) return [];
    enviadas.push(clave);
    const stock = c.noSeCuenta ? null : c.stock.trim() === '' ? undefined : Number(c.stock);
    return [
      {
        valores,
        sku: c.sku.trim() || null,
        precioCop: pesos(c.precio),
        precioAntesCop: c.antes.trim() === '' ? null : pesos(c.antes),
        // Sin el campo, la API pide «di cuántas hay, o marca «no se cuenta»» (CA4).
        ...(stock === undefined ? {} : { stock: Number.isNaN(stock) ? c.stock : stock }),
      },
    ];
  });
  return {
    enviadas,
    cuerpo: {
      ...ids,
      nombre: f.nombre,
      estado: f.estado,
      descripcionMd: f.descripcion,
      ...(f.slug.trim() ? { slug: f.slug.trim() } : {}),
      opciones,
      variantes,
      retracto: f.retractoAplica ? { aplica: true } : { aplica: false, motivo: f.retractoMotivo },
      soloMayores: f.soloMayores,
    },
  };
}

/**
 * El id del campo de la pantalla para un problema de la API: `variantes.2.precioCop` es el precio
 * de la tercera combinación enviada, que en la pantalla puede estar en otro lugar.
 */
export function campoDelProblema(
  campo: string,
  enviadas: readonly string[],
  enPantalla: readonly string[],
): string {
  const m = campo.match(/^variantes\.(\d+)(?:\.(\w+))?/);
  if (!m) {
    if (campo.startsWith('opciones')) return 'opciones';
    if (campo.startsWith('retracto')) return 'retracto';
    return campo || 'nombre';
  }
  const clave = enviadas[Number(m[1])];
  const i = clave === undefined ? -1 : enPantalla.indexOf(clave);
  const sub = { precioCop: 'precio', precioAntesCop: 'antes', stock: 'stock', sku: 'sku' }[
    m[2] ?? ''
  ];
  return i < 0 ? 'combinaciones' : `c${i}-${sub ?? 'precio'}`;
}

/** Una clave de operación nueva: se repite tal cual si el envío se corta y se vuelve a intentar. */
export const opNueva = () => `p${crypto.randomUUID().replaceAll('-', '')}`;
