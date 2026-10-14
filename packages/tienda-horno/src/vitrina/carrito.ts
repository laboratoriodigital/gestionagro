/**
 * El carrito de la vitrina (HU-T5.4, TIENDA-3.0 §8.3 y §11.3): vive en el `localStorage` de cada
 * tienda (cada tienda es un origen) y no llega a nadie hasta que se envía. Puro: el azar llega como
 * parámetro, así se prueba sin navegador.
 *
 * - **El código del pedido** (anexo C): 6 caracteres de la base 32 de Crockford, generado una vez
 *   por carrito. Reenviar el mismo pedido no lo duplica, porque el código es el mismo. Nunca lleva
 *   I, L, O ni U: no se confunden al dictarlo.
 * - **Topes** (TIENDA §5.4 y §6): 30 líneas y 200 unidades por línea, dichos en la pantalla. Son los
 *   de `LIMITES` de `@ed1/dinero`; la isla no puede importarlo (solo módulos de su carpeta), y una
 *   prueba exige que sean los mismos (P2).
 * - **Sanear** (corregir lo que ya no se vende) nunca ocurre mientras hay un cobro en pantalla: el
 *   carrito que se paga es el que se vio (bitácora ecommerce 47).
 * - **Lo publicado (P10):** un carrito con un formato anterior se lee o se descarta diciéndolo;
 *   nunca rompe la página.
 */

export const TOPES = { lineas: 30, unidadesPorLinea: 200 } as const;
export const ALFABETO_CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CLAVE_DEL_CARRITO = 'tienda:carrito';
/** El formato de T3 (HU-T3.4): solo una lista de líneas, sin código. */
export const CLAVE_ANTERIOR = 'tienda:pedido';

export interface LineaDelCarrito {
  variante: string;
  cantidad: number;
  /** La confirmación de la edad (Ley 1480 art. 52), que queda en el pedido. */
  mayorDeEdad?: true;
}

export interface Carrito {
  v: 1;
  codigo: string;
  lineas: LineaDelCarrito[];
  /** ISO 8601: hay un cobro en pantalla desde entonces. Mientras exista, no se sanea. */
  cobro?: string;
}

export type Azar = (n: number) => Uint8Array;

/** 6 caracteres de Crockford. 256 es múltiplo de 32: cada byte da un carácter sin sesgo. */
export function codigoNuevo(azar: Azar): string {
  return [...azar(6)].map((b) => ALFABETO_CROCKFORD[b % 32]).join('');
}

export const esCodigo = (c: unknown): c is string =>
  typeof c === 'string' && /^[0-9A-HJKMNP-TV-Z]{6}$/.test(c);

export const carritoVacio = (azar: Azar): Carrito => ({
  v: 1,
  codigo: codigoNuevo(azar),
  lineas: [],
});

const lineaValida = (l: unknown): l is LineaDelCarrito => {
  if (!l || typeof l !== 'object') return false;
  const x = l as Record<string, unknown>;
  return (
    typeof x['variante'] === 'string' &&
    x['variante'] !== '' &&
    Number.isSafeInteger(x['cantidad']) &&
    (x['cantidad'] as number) >= 1 &&
    (x['mayorDeEdad'] === undefined || x['mayorDeEdad'] === true)
  );
};

/** Las líneas dentro de los topes: se recortan, nunca se pierden en silencio (lo dice `aviso`). */
function dentroDeLosTopes(lineas: LineaDelCarrito[]): {
  lineas: LineaDelCarrito[];
  recortado: boolean;
} {
  let recortado = lineas.length > TOPES.lineas;
  const dentro = lineas.slice(0, TOPES.lineas).map((l) => {
    if (l.cantidad <= TOPES.unidadesPorLinea) return l;
    recortado = true;
    return { ...l, cantidad: TOPES.unidadesPorLinea };
  });
  return { lineas: dentro, recortado };
}

export type AvisoAlLeer = 'formato-anterior' | 'ilegible' | 'recortado';

/**
 * Lee lo guardado. Sin nada: un carrito nuevo. Con el formato de T3: sus líneas, con código nuevo.
 * Ilegible: uno nuevo, y el aviso para decirlo.
 */
export function leerCarrito(
  guardado: string | null,
  anterior: string | null,
  azar: Azar,
): { carrito: Carrito; aviso?: AvisoAlLeer } {
  if (guardado === null && anterior === null) return { carrito: carritoVacio(azar) };
  let datos: unknown;
  try {
    datos = JSON.parse(guardado ?? anterior ?? 'null');
  } catch {
    return { carrito: carritoVacio(azar), aviso: 'ilegible' };
  }
  if (guardado === null) {
    // El formato de T3: un arreglo de líneas.
    if (!Array.isArray(datos) || !datos.every(lineaValida)) {
      return { carrito: carritoVacio(azar), aviso: 'ilegible' };
    }
    const { lineas } = dentroDeLosTopes(datos);
    return { carrito: { ...carritoVacio(azar), lineas }, aviso: 'formato-anterior' };
  }
  const x = datos as Partial<Carrito> | null;
  if (
    !x ||
    x.v !== 1 ||
    !esCodigo(x.codigo) ||
    !Array.isArray(x.lineas) ||
    !x.lineas.every(lineaValida)
  ) {
    return { carrito: carritoVacio(azar), aviso: 'ilegible' };
  }
  const { lineas, recortado } = dentroDeLosTopes(x.lineas);
  const carrito: Carrito = {
    v: 1,
    codigo: x.codigo,
    lineas,
    ...(typeof x.cobro === 'string' ? { cobro: x.cobro } : {}),
  };
  return recortado ? { carrito, aviso: 'recortado' } : { carrito };
}

export type Tope = 'lineas' | 'unidades';

/** Suma unidades de una variante. Pasar un tope no agrega nada de más y lo dice. */
export function agregar(
  c: Carrito,
  variante: string,
  cantidad = 1,
  opciones: { mayorDeEdad?: boolean } = {},
): { carrito: Carrito; tope?: Tope } {
  const i = c.lineas.findIndex((l) => l.variante === variante);
  if (i < 0) {
    if (c.lineas.length >= TOPES.lineas) return { carrito: c, tope: 'lineas' };
    const linea: LineaDelCarrito = {
      variante,
      cantidad: Math.min(cantidad, TOPES.unidadesPorLinea),
      ...(opciones.mayorDeEdad ? { mayorDeEdad: true as const } : {}),
    };
    const carrito = { ...c, lineas: [...c.lineas, linea] };
    return cantidad > TOPES.unidadesPorLinea ? { carrito, tope: 'unidades' } : { carrito };
  }
  const actual = c.lineas[i] as LineaDelCarrito;
  const suma = actual.cantidad + cantidad;
  const linea: LineaDelCarrito = {
    ...actual,
    cantidad: Math.min(suma, TOPES.unidadesPorLinea),
    ...(opciones.mayorDeEdad ? { mayorDeEdad: true as const } : {}),
  };
  const lineas = c.lineas.map((l, j) => (j === i ? linea : l));
  return suma > TOPES.unidadesPorLinea
    ? { carrito: { ...c, lineas }, tope: 'unidades' }
    : { carrito: { ...c, lineas } };
}

/** Pone la cantidad de una línea; 0 la quita. */
export function cambiarCantidad(c: Carrito, variante: string, cantidad: number): Carrito {
  if (cantidad <= 0) return { ...c, lineas: c.lineas.filter((l) => l.variante !== variante) };
  return {
    ...c,
    lineas: c.lineas.map((l) =>
      l.variante === variante ? { ...l, cantidad: Math.min(cantidad, TOPES.unidadesPorLinea) } : l,
    ),
  };
}

/** Después de enviar el pedido: un carrito nuevo, con otro código. */
export const vaciar = (azar: Azar): Carrito => carritoVacio(azar);

export const unidades = (c: Carrito): number => c.lineas.reduce((s, l) => s + l.cantidad, 0);

/**
 * Corrige el carrito con lo que dice la tienda: quita lo que ya no existe y baja lo que no alcanza.
 * Con un cobro en pantalla, no toca nada (CA3): devuelve el mismo carrito y `bloqueado`.
 */
export function sanear(
  c: Carrito,
  existencias: ReadonlyMap<string, number | null>,
): { carrito: Carrito; cambios: string[]; bloqueado?: true } {
  if (c.cobro) return { carrito: c, cambios: [], bloqueado: true };
  const cambios: string[] = [];
  const lineas = c.lineas.flatMap((l) => {
    if (!existencias.has(l.variante)) {
      cambios.push(l.variante);
      return [];
    }
    const hay = existencias.get(l.variante);
    if (hay === null || hay === undefined || l.cantidad <= hay) return [l];
    cambios.push(l.variante);
    return hay > 0 ? [{ ...l, cantidad: hay }] : [];
  });
  return { carrito: { ...c, lineas }, cambios };
}
