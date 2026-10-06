/**
 * Las reglas del dinero de la Tienda (TIENDA-3.0 §6, HU-T1.1). Una sola fuente (P2): la usan el
 * navegador para mostrar, la API para cobrar y el horno para hornear.
 *
 * - Pesos enteros. Nunca un decimal, nunca `REAL`.
 * - Un monto que no se puede leer **lanza**: nunca vale 0. En la Tienda 2.0, `Number(celda) || 0`
 *   convertía «no se pudo leer» en «es gratis» (bitácora ecommerce, Críticos).
 * - Sin `Intl`: su resultado cambia entre el navegador, Node y workerd, y el horno tiene que dar
 *   los mismos bytes en todos (P17). Lo vigila `tests/repo/tienda-paquetes-puros.test.ts`.
 */

/** Topes de un pedido (TIENDA-3.0 §5.4 y §6): los del 2.0 y los de Bold. */
export const LIMITES = {
  lineas: 30,
  unidadesPorLinea: 200,
  minimoEnLineaCop: 1_000,
  maximoEnLineaCop: 5_000_000,
} as const;

/** Un monto o una cantidad que no se pudo leer. Dice cuál, para que el aviso nombre la causa (P15). */
export class MontoIlegible extends Error {
  readonly campo: string;
  constructor(campo: string, valor: unknown) {
    super(`«${campo}» no es un número entero de pesos válido: ${JSON.stringify(valor)}`);
    this.name = 'MontoIlegible';
    this.campo = campo;
  }
}

/** Devuelve el valor si es un entero de pesos ≥ 0; si no, lanza. Nunca devuelve 0 por defecto. */
export function pesos(valor: unknown, campo: string): number {
  if (typeof valor !== 'number' || !Number.isSafeInteger(valor) || valor < 0) {
    throw new MontoIlegible(campo, valor);
  }
  return valor;
}

/** `$80.000`, con punto de miles. Negativo: `-$5.000` (una devolución). */
export function formatearPesos(valor: number): string {
  if (!Number.isSafeInteger(valor)) throw new MontoIlegible('monto', valor);
  const digitos = String(Math.abs(valor));
  let conPuntos = '';
  for (let i = 0; i < digitos.length; i++) {
    if (i > 0 && (digitos.length - i) % 3 === 0) conPuntos += '.';
    conPuntos += digitos[i];
  }
  return `${valor < 0 ? '-' : ''}$${conPuntos}`;
}

export interface Linea {
  precioCop: number;
  cantidad: number;
}

export type Cupon =
  | { tipo: 'porcentaje'; porcentaje: number; minimoCop?: number }
  | { tipo: 'valor'; valorCop: number; minimoCop?: number }
  | { tipo: 'envio_gratis'; minimoCop?: number };

export interface Envio {
  precioCop: number;
  /** Desde este subtotal (ya con el descuento) el envío es gratis. `null`: nunca. */
  gratisDesdeCop: number | null;
}

export type Aviso = 'cupon_bajo_el_minimo';

export interface Total {
  subtotal: number;
  descuento: number;
  envio: number;
  total: number;
  avisos: Aviso[];
}

function cantidad(valor: unknown, campo: string): number {
  if (
    typeof valor !== 'number' ||
    !Number.isSafeInteger(valor) ||
    valor < 1 ||
    valor > LIMITES.unidadesPorLinea
  ) {
    throw new MontoIlegible(campo, valor);
  }
  return valor;
}

/**
 * El total de un carrito, en el orden de TIENDA-3.0 §6: subtotal, descuento del cupón, envío y
 * total. El redondeo del porcentaje favorece al comprador: `⌈subtotal × % / 100⌉`. TIENDA §6
 * escribía el piso con esa misma promesa, y el piso favorece al comercio (bitácora tienda3 5).
 */
export function calcularTotal(entrada: {
  lineas: readonly Linea[];
  cupon?: Cupon | null;
  envio?: Envio | null;
}): Total {
  const { lineas } = entrada;
  if (lineas.length === 0 || lineas.length > LIMITES.lineas) {
    throw new RangeError(
      `Un pedido lleva de 1 a ${LIMITES.lineas} líneas; llegaron ${lineas.length}`,
    );
  }
  let subtotal = 0;
  lineas.forEach((l, i) => {
    subtotal +=
      pesos(l.precioCop, `lineas[${i}].precioCop`) * cantidad(l.cantidad, `lineas[${i}].cantidad`);
  });

  const avisos: Aviso[] = [];
  const cupon = entrada.cupon ?? null;
  let descuento = 0;
  let envioGratisPorCupon = false;
  if (cupon) {
    const minimo = cupon.minimoCop === undefined ? 0 : pesos(cupon.minimoCop, 'cupon.minimoCop');
    if (subtotal < minimo) {
      avisos.push('cupon_bajo_el_minimo');
    } else if (cupon.tipo === 'porcentaje') {
      const p = cupon.porcentaje;
      if (!Number.isSafeInteger(p) || p < 1 || p > 100)
        throw new MontoIlegible('cupon.porcentaje', p);
      descuento = Math.ceil((subtotal * p) / 100);
    } else if (cupon.tipo === 'valor') {
      descuento = Math.min(pesos(cupon.valorCop, 'cupon.valorCop'), subtotal);
    } else {
      envioGratisPorCupon = true;
    }
  }

  let envio = 0;
  if (entrada.envio && !envioGratisPorCupon) {
    const precio = pesos(entrada.envio.precioCop, 'envio.precioCop');
    const desde = entrada.envio.gratisDesdeCop;
    const gratis = desde !== null && subtotal - descuento >= pesos(desde, 'envio.gratisDesdeCop');
    envio = gratis ? 0 : precio;
  }

  return { subtotal, descuento, envio, total: subtotal - descuento + envio, avisos };
}

/** Si un total se puede cobrar en línea, y si no, por qué (TIENDA-3.0 §6, punto 6). */
export function cobrableEnLinea(
  total: number,
  topeDelComercioCop: number = LIMITES.maximoEnLineaCop,
): { cobrable: true } | { cobrable: false; motivo: 'bajo_el_minimo' | 'sobre_el_tope' } {
  pesos(total, 'total');
  const tope = Math.min(pesos(topeDelComercioCop, 'tope'), LIMITES.maximoEnLineaCop);
  if (total < LIMITES.minimoEnLineaCop) return { cobrable: false, motivo: 'bajo_el_minimo' };
  if (total > tope) return { cobrable: false, motivo: 'sobre_el_tope' };
  return { cobrable: true };
}

/**
 * Reparte un descuento entre las líneas, proporcional al total de cada una, con el método del
 * mayor residuo: la suma da exacto el descuento (TIENDA-3.0 §6, punto 4). Se usa para una
 * devolución parcial. A igual residuo gana la línea que va primero, así el resultado no depende
 * de cómo ordene el motor (determinismo, P17).
 */
export function repartirDescuento(totalesDeLinea: readonly number[], descuento: number): number[] {
  pesos(descuento, 'descuento');
  const totales = totalesDeLinea.map((t, i) => pesos(t, `totalesDeLinea[${i}]`));
  const suma = totales.reduce((a, b) => a + b, 0);
  if (descuento > suma)
    throw new RangeError(`El descuento (${descuento}) pasa del total (${suma})`);
  if (suma === 0) return totales.map(() => 0);
  const base = totales.map((t) => Math.floor((t * descuento) / suma));
  const residuos = totales.map((t, i) => ({ i, r: (t * descuento) % suma }));
  let falta = descuento - base.reduce((a, b) => a + b, 0);
  residuos.sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of residuos) {
    if (falta === 0) break;
    base[i] = (base[i] ?? 0) + 1;
    falta--;
  }
  return base;
}
