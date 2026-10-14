/**
 * La liquidación del parqueadero (PARQUEADERO §9, HU-Q1.1). Pura: recibe los instantes, sin reloj
 * ni red ni `Intl`, y da lo mismo en la caja, en la calculadora y en la API (P2, P17).
 *
 * Reglas que garantiza (§9.2):
 * 1. El total por tiempo nunca pasa `minutos × tope por minuto`. Una tarifa que lo rompería no se
 *    liquida: `liquidar` la valida primero y lanza `TarifaInvalida`, nunca la recorta en silencio.
 * 2. El redondeo solo baja.
 * 3. Pesos enteros con `@ed1/dinero`: un monto ilegible lanza `MontoIlegible`, nunca vale 0.
 *
 * El modelo:
 * - **Minuto iniciado:** la estadía dura `⌈(salida − entrada) / 1 min⌉` minutos. Los minutos son
 *   una cuadrícula que empieza en la entrada.
 * - **Noche:** una franja de hora local con valor fijo, que cuenta solo si la estadía la contiene
 *   entera. Sus minutos salen del cobro por tiempo.
 * - **Bloques:** lo que queda entre noches se cobra por bloques de 24 h desde su comienzo. Cada
 *   bloque cobra por tiempo (minuto, fracción u hora); pasados `plena.desde_min` minutos vale la
 *   plena, y nunca más que el tope diario.
 * - **Domingos y festivos** (HU-Q13.2): con `festivo`, cada unidad de tiempo (minuto, fracción u
 *   hora) que empieza un domingo o un festivo de Colombia vale `festivo.valor`, y la plena de un
 *   bloque de 24 h es la de festivo si el bloque empieza en uno. La línea dice que hubo festivo.
 * - **Abonado:** si su mensualidad cubre la salida, no paga; si vence en medio, se cobra desde que
 *   venció.
 * - **Tiquete perdido:** una línea aparte, que no es tiempo y no entra en la regla 1.
 */
import { esFestivo, RANGO } from '@ed1/calendario';
import { pesos } from '@ed1/dinero';
import type { LineaDeLiquidacion, Tarifa } from '@ed1/parqueadero-schema';

const MINUTO = 60_000;
const DIA_MIN = 1440;

/** Lo que la liquidación usa de una tarifa del catálogo. */
export type ReglasDeTarifa = Pick<
  Tarifa,
  | 'modo'
  | 'valor'
  | 'fraccion_min'
  | 'gracia_min'
  | 'tope_dia'
  | 'plena'
  | 'nocturna'
  | 'perdido'
  | 'redondeo'
  | 'festivo'
>;

export type Aviso =
  /** La estadía cupo en los minutos de gracia. */
  | 'gracia'
  /** La mensualidad cubre la estadía. */
  | 'abonado'
  /** La mensualidad venció en medio: se cobró desde que venció. */
  | 'abonado_vencio'
  | 'perdido'
  /** La sede no declaró tope por minuto: nada limita el total por la norma. */
  | 'sin_tope';

export interface Liquidacion {
  /** Minutos de la estadía entera, con el minuto iniciado. */
  readonly minutos: number;
  readonly lineas: readonly LineaDeLiquidacion[];
  readonly subtotal: number;
  /** Lo que se rebajó al redondear hacia abajo; 0 si no. */
  readonly redondeo: number;
  readonly total: number;
  readonly avisos: readonly Aviso[];
}

export interface Problema {
  readonly campo: string;
  readonly motivo: string;
}

/** Una tarifa que no se puede liquidar o que pasaría el tope. Nombra cada campo (P15). */
export class TarifaInvalida extends Error {
  readonly problemas: readonly Problema[];
  constructor(problemas: readonly Problema[]) {
    super(`Tarifa inválida: ${problemas.map((p) => `«${p.campo}» ${p.motivo}`).join('; ')}`);
    this.name = 'TarifaInvalida';
    this.problemas = problemas;
  }
}

/** Minutos desde la medianoche de `HH:MM`; `null` si no tiene esa forma. */
function minutosDelDia(hora: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Largo en minutos de una franja que puede cruzar la medianoche (20:00 a 05:30 son 570). */
function largoDeFranja(desde: number, hasta: number): number {
  return (hasta - desde + DIA_MIN) % DIA_MIN;
}

const enteroEntre = (x: unknown, min: number, max: number): x is number =>
  typeof x === 'number' && Number.isSafeInteger(x) && x >= min && x <= max;

/**
 * Lo que impide liquidar con esta tarifa y este tope por minuto (`null` = la ciudad no tiene).
 * Vacío = se puede guardar. Un monto ilegible lanza `MontoIlegible` con su campo (HU-Q1.1 CA3).
 *
 * Con tope, cada pieza cumple por sí sola la regla 1, y por eso la cumple la suma: el peor caso de
 * una fracción o de una hora es el primer minuto, que ya la cobra entera; la plena se cobra desde
 * el minuto `desde_min + 1`; la noche dura su franja.
 */
export function validarTarifa(t: ReglasDeTarifa, tope: number | null): Problema[] {
  const valor = pesos(t.valor, 'valor');
  if (t.tope_dia !== null) pesos(t.tope_dia, 'tope_dia');
  if (t.perdido !== null) pesos(t.perdido, 'perdido');
  if (t.plena !== null) pesos(t.plena.valor, 'plena.valor');
  if (t.nocturna !== null) pesos(t.nocturna.valor, 'nocturna.valor');
  if (t.festivo) pesos(t.festivo.valor, 'festivo.valor');
  if (t.festivo?.plena) pesos(t.festivo.plena.valor, 'festivo.plena.valor');
  if (tope !== null) pesos(tope, 'tope_minuto');

  const problemas: Problema[] = [];
  const mal = (campo: string, motivo: string) => problemas.push({ campo, motivo });

  if (!enteroEntre(t.gracia_min, 0, 60)) mal('gracia_min', 'debe ser de 0 a 60 minutos enteros');
  if (t.modo === 'fraccion' && !enteroEntre(t.fraccion_min, 2, 240)) {
    mal('fraccion_min', 'debe ser de 2 a 240 minutos enteros');
  }
  if (t.plena !== null && !enteroEntre(t.plena.desde_min, 1, DIA_MIN - 1)) {
    mal('plena.desde_min', 'debe ser de 1 a 1439 minutos enteros');
  }
  if (t.festivo?.plena && !enteroEntre(t.festivo.plena.desde_min, 1, DIA_MIN - 1)) {
    mal('festivo.plena.desde_min', 'debe ser de 1 a 1439 minutos enteros');
  }
  let franja: number | null = null;
  if (t.nocturna !== null) {
    const desde = minutosDelDia(t.nocturna.desde);
    const hasta = minutosDelDia(t.nocturna.hasta);
    if (desde === null) mal('nocturna.desde', 'debe ser una hora HH:MM');
    if (hasta === null) mal('nocturna.hasta', 'debe ser una hora HH:MM');
    if (desde !== null && hasta !== null) {
      franja = largoDeFranja(desde, hasta);
      if (franja === 0)
        mal('nocturna.hasta', 'la franja no puede empezar y terminar a la misma hora');
    }
  }

  if (tope === null) return problemas;
  const $ = (n: number) => `$${n}`;
  if (valor > tope) {
    mal(
      'valor',
      t.modo === 'minuto'
        ? `${$(valor)} por minuto pasa el tope de ${$(tope)} por minuto`
        : `con tope por minuto, una ${t.modo === 'hora' ? 'hora' : 'fracción'} no puede valer más que el tope (${$(tope)}): el primer minuto ya la cobra entera`,
    );
  }
  if (t.plena !== null && enteroEntre(t.plena.desde_min, 1, DIA_MIN - 1)) {
    const maximo = (t.plena.desde_min + 1) * tope;
    if (t.plena.valor > maximo) {
      mal(
        'plena.valor',
        `pasa el tope: en el minuto ${t.plena.desde_min + 1} lo máximo es ${$(maximo)}`,
      );
    }
  }
  // HU-Q13.2: el valor y la plena de domingos y festivos tampoco pasan el tope.
  if (t.festivo && t.festivo.valor > tope) {
    mal(
      'festivo.valor',
      t.modo === 'minuto'
        ? `${$(t.festivo.valor)} por minuto en domingos y festivos pasa el tope de ${$(tope)} por minuto`
        : `en domingos y festivos, una ${t.modo === 'hora' ? 'hora' : 'fracción'} no puede valer más que el tope (${$(tope)})`,
    );
  }
  const plenaFestivo = t.festivo?.plena;
  if (plenaFestivo && enteroEntre(plenaFestivo.desde_min, 1, DIA_MIN - 1)) {
    const maximo = (plenaFestivo.desde_min + 1) * tope;
    if (plenaFestivo.valor > maximo) {
      mal(
        'festivo.plena.valor',
        `pasa el tope: en el minuto ${plenaFestivo.desde_min + 1} lo máximo es ${$(maximo)}`,
      );
    }
  }
  if (t.nocturna !== null && franja !== null && franja > 0) {
    const maximo = franja * tope;
    if (t.nocturna.valor > maximo) {
      mal('nocturna.valor', `pasa el tope: ${franja} minutos de noche son máximo ${$(maximo)}`);
    }
  }
  return problemas;
}

/** Las noches que la estadía contiene enteras, como intervalos `[inicio, fin)` en milisegundos. */
function nochesCompletas(
  inicio: number,
  salida: number,
  nocturna: NonNullable<ReglasDeTarifa['nocturna']>,
  desfaseMin: number,
): [number, number][] {
  const desde = minutosDelDia(nocturna.desde) ?? 0;
  const largo = largoDeFranja(desde, minutosDelDia(nocturna.hasta) ?? 0);
  const desfase = desfaseMin * MINUTO;
  const diaLocal = (t: number) => Math.floor((t + desfase) / (DIA_MIN * MINUTO));
  const noches: [number, number][] = [];
  for (let d = diaLocal(inicio) - 1; d <= diaLocal(salida); d++) {
    const comienzo = d * DIA_MIN * MINUTO - desfase + desde * MINUTO;
    const fin = comienzo + largo * MINUTO;
    if (comienzo >= inicio && fin <= salida) noches.push([comienzo, fin]);
  }
  return noches;
}

/**
 * Si el día local de un instante es domingo o festivo de Colombia (HU-Q13.2). Fuera de los años
 * que el calendario conoce, solo el domingo: un festivo que no se sabe no se cobra (P1).
 */
function esDomingoOFestivo(instante: number, desfaseMin: number): boolean {
  const local = new Date(instante + desfaseMin * MINUTO);
  if (local.getUTCDay() === 0) return true;
  const anio = local.getUTCFullYear();
  return anio >= RANGO.desde && anio <= RANGO.hasta && esFestivo(local.toISOString().slice(0, 10));
}

/**
 * Lo que vale un bloque de hasta 24 h que empieza en `inicio`, por tiempo, con la plena y el tope
 * diario. Con tarifa de festivo, cada unidad vale según el día en que empieza, y la plena es la
 * del día en que empieza el bloque (HU-Q13.2).
 */
function bloque(
  t: ReglasDeTarifa,
  inicio: number,
  minutos: number,
  desfaseMin: number,
): LineaDeLiquidacion {
  const largo = t.modo === 'minuto' ? 1 : t.modo === 'hora' ? 60 : (t.fraccion_min ?? 1);
  const unidades = Math.ceil(minutos / largo);
  const festivo = t.festivo ?? null;
  let base = unidades * t.valor;
  let conFestivo = false;
  if (festivo !== null) {
    base = 0;
    // Un día por vez: dentro de un mismo día local, todas las unidades valen lo mismo.
    const dias = new Map<number, boolean>();
    for (let u = 0; u < unidades; u++) {
      const empieza = inicio + u * largo * MINUTO;
      const dia = Math.floor((empieza + desfaseMin * MINUTO) / (DIA_MIN * MINUTO));
      let es = dias.get(dia);
      if (es === undefined) {
        es = esDomingoOFestivo(empieza, desfaseMin);
        dias.set(dia, es);
      }
      base += es ? festivo.valor : t.valor;
      if (es) conFestivo = true;
    }
  }
  let linea: LineaDeLiquidacion = {
    concepto: conFestivo ? 'tiempo_festivo' : 'tiempo',
    minutos,
    base,
    valor: base,
  };
  const plenaDeFestivo =
    festivo?.plena && esDomingoOFestivo(inicio, desfaseMin) ? festivo.plena : null;
  const plena = plenaDeFestivo ?? t.plena;
  if (plena !== null && minutos > plena.desde_min) {
    linea = { ...linea, concepto: plenaDeFestivo ? 'plena_festivo' : 'plena', valor: plena.valor };
  }
  if (t.tope_dia !== null && linea.valor > t.tope_dia) {
    linea = { ...linea, concepto: 'tope_dia', valor: t.tope_dia };
  }
  return linea;
}

export interface Abono {
  /** Hasta cuándo cubre la mensualidad, en milisegundos Unix. */
  readonly vence: number;
}

export interface OpcionesDeLiquidacion {
  /** Desfase de la hora local en minutos; Colombia es −300 todo el año (§5.6). */
  readonly desfaseMin?: number;
}

/**
 * Liquida una estadía. `entrada` y `salida` son milisegundos Unix; `tope` es el tope por minuto
 * de la sede (`null` = sin tope). Lanza `TarifaInvalida` si la tarifa pasaría el tope y
 * `RangeError` si la salida es anterior a la entrada (un reloj corrido, §5.6).
 */
export function liquidar(
  entrada: number,
  salida: number,
  tarifa: ReglasDeTarifa,
  tope: number | null,
  abonado: Abono | null = null,
  perdido = false,
  opciones: OpcionesDeLiquidacion = {},
): Liquidacion {
  const problemas = validarTarifa(tarifa, tope);
  if (perdido && tarifa.perdido === null) {
    problemas.push({ campo: 'perdido', motivo: 'la tarifa no tiene valor del tiquete perdido' });
  }
  if (problemas.length > 0) throw new TarifaInvalida(problemas);
  if (!Number.isSafeInteger(entrada) || !Number.isSafeInteger(salida)) {
    throw new RangeError(`Instantes ilegibles: ${entrada}, ${salida}`);
  }
  if (salida < entrada) {
    throw new RangeError('La salida es anterior a la entrada: revise la hora de la caja');
  }
  const desfaseMin = opciones.desfaseMin ?? -300;

  const minutos = Math.ceil((salida - entrada) / MINUTO);
  const lineas: LineaDeLiquidacion[] = [];
  const avisos: Aviso[] = [];
  if (tope === null) avisos.push('sin_tope');

  let inicio = entrada;
  if (abonado !== null && abonado.vence > entrada) {
    inicio = Math.min(abonado.vence, salida);
    const cobrados = Math.ceil((salida - inicio) / MINUTO);
    lineas.push({ concepto: 'abonado', minutos: minutos - cobrados, base: 0, valor: 0 });
    avisos.push(inicio === salida ? 'abonado' : 'abonado_vencio');
  }

  if (inicio < salida && minutos <= tarifa.gracia_min) {
    lineas.push({ concepto: 'gracia', minutos, base: 0, valor: 0 });
    avisos.push('gracia');
  } else if (inicio < salida) {
    const cobrar = Math.ceil((salida - inicio) / MINUTO);
    const noches = tarifa.nocturna
      ? nochesCompletas(inicio, salida, tarifa.nocturna, desfaseMin)
      : [];
    /** Los bloques de 24 h de `m` minutos que empiezan `desde` minutos después de `inicio`. */
    const tramo = (m: number, desde: number) => {
      for (let resta = m, k = desde; resta > 0; resta -= DIA_MIN, k += DIA_MIN) {
        lineas.push(bloque(tarifa, inicio + k * MINUTO, Math.min(resta, DIA_MIN), desfaseMin));
      }
    };
    // Los minutos de la cuadrícula que empiezan dentro de una noche son de la noche: exactamente
    // su franja, porque la noche empieza y termina en minuto exacto.
    let k = 0;
    for (const [comienzo, fin] of noches) {
      const a = Math.ceil((comienzo - inicio) / MINUTO);
      const b = Math.ceil((fin - inicio) / MINUTO);
      tramo(a - k, k);
      const valor = tarifa.nocturna?.valor ?? 0;
      lineas.push({ concepto: 'nocturna', minutos: b - a, base: valor, valor });
      k = b;
    }
    tramo(cobrar - k, k);
  } else if (lineas.length === 0) {
    // Minuto 0: entrada y salida en el mismo instante.
    lineas.push({ concepto: 'gracia', minutos: 0, base: 0, valor: 0 });
    avisos.push('gracia');
  }

  if (perdido) {
    const valor = tarifa.perdido ?? 0;
    lineas.push({ concepto: 'perdido', minutos: 0, base: valor, valor });
    avisos.push('perdido');
  }

  const subtotal = lineas.reduce((a, l) => a + l.valor, 0);
  const unidad = tarifa.redondeo === 'abajo_50' ? 50 : tarifa.redondeo === 'abajo_100' ? 100 : 1;
  const redondeo = subtotal % unidad;
  return { minutos, lineas, subtotal, redondeo, total: subtotal - redondeo, avisos };
}
export * from './mensualidad.ts';
