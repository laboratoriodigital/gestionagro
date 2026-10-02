/**
 * Lógica de la calculadora de carencia y reentrada (HU-E10.1), sin interfaz: de lo que el
 * productor copia de la etiqueta a las fechas que se muestran. Usa `vencimientoCarencia` y
 * `vencimientoReentrada` de agro-calc, los mismos del cuaderno: aquí no hay otra copia del
 * cálculo (P2). Todo pasa en el teléfono; nada sale a la red (CA4).
 *
 * - La fecha y la hora de la aplicación son las de Colombia, aunque el teléfono tenga otro huso
 *   (P8). Colombia no cambia la hora en el año (UTC−5 fijo), así que la hora escrita se lleva a un
 *   instante con ese desfase.
 * - Una carencia o una reentrada vacía no es 0: es «desconocida» y no se da fecha (CA2, P1).
 */
import {
  ErrorDeMedida,
  leerNumero,
  vencimientoCarencia,
  vencimientoReentrada,
} from '@gestionagro/agro-calc';
import { fechaAgronomica } from '@gestionagro/agro-schema';

export interface EntradasCarencia {
  /** `AAAA-MM-DD`, como lo da `<input type="date">`. */
  fecha: string;
  /** `HH:MM`, como lo da `<input type="time">`. */
  hora: string;
  carencia: string;
  reentrada: string;
}

export type CampoCarencia = keyof EntradasCarencia;

export type Salida =
  | { tipo: 'espera' }
  | { tipo: 'desconocida' }
  | { tipo: 'fecha'; texto: string; valor: string };

export interface ResultadoCarencia {
  errores: Partial<Record<CampoCarencia, string>>;
  cosechar: Salida;
  entrar: Salida;
}

/** Colombia: UTC−5 todo el año (sin horario de verano desde 1993). */
const DESFASE_COLOMBIA = '-05:00';

const HORA_COLOMBIA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** «13/12» desde `AAAA-MM-DD`, sin pasar por un huso. */
const diaMes = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
/** «10/12/2026 19:00» en hora de Colombia. */
const fechaHora = (ms: number) => {
  const f = fechaAgronomica(ms);
  return `${diaMes(f)}/${f.slice(0, 4)} ${HORA_COLOMBIA.format(new Date(ms))}`;
};

/** Ahora, en Colombia: los valores por defecto de fecha y hora (CA1). */
export function ahoraEnColombia(ms: number): { fecha: string; hora: string } {
  return { fecha: fechaAgronomica(ms), hora: HORA_COLOMBIA.format(new Date(ms)) };
}

const MENSAJES: Record<'carencia' | 'reentrada', string> = {
  carencia: 'La carencia va en días enteros, de 0 a 365, como en la etiqueta.',
  reentrada: 'La reentrada va en horas enteras, de 0 a 8.760, como en la etiqueta.',
};

export function calcularCarencia(e: EntradasCarencia): ResultadoCarencia {
  const errores: ResultadoCarencia['errores'] = {};
  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(e.fecha);
  const horaValida = /^\d{2}:\d{2}$/.test(e.hora);
  if (e.fecha && !fechaValida) errores.fecha = 'Elige la fecha de la aplicación.';
  if (e.hora && !horaValida) errores.hora = 'Elige la hora de la aplicación.';

  /** null = vacío (desconocido); undefined = ilegible (error junto al campo). */
  const leer = (campo: 'carencia' | 'reentrada', texto: string): number | null | undefined => {
    if (texto.trim() === '') return null;
    const r = leerNumero(texto);
    if (!r.ok) {
      errores[campo] = r.motivo;
      return undefined;
    }
    return r.valor;
  };
  const dias = leer('carencia', e.carencia);
  const horas = leer('reentrada', e.reentrada);

  const conError = <T>(campo: 'carencia' | 'reentrada', f: () => T): T | undefined => {
    try {
      return f();
    } catch (err) {
      if (err instanceof ErrorDeMedida) {
        errores[campo] = MENSAJES[campo];
        return undefined;
      }
      throw err;
    }
  };

  let cosechar: Salida = { tipo: 'espera' };
  if (dias === null) cosechar = { tipo: 'desconocida' };
  else if (dias !== undefined && fechaValida) {
    const desde = conError('carencia', () => vencimientoCarencia(e.fecha, dias));
    if (desde) cosechar = { tipo: 'fecha', texto: diaMes(desde), valor: desde };
  }

  let entrar: Salida = { tipo: 'espera' };
  if (horas === null) entrar = { tipo: 'desconocida' };
  else if (horas !== undefined && fechaValida && horaValida) {
    const instante = Date.parse(`${e.fecha}T${e.hora}:00${DESFASE_COLOMBIA}`);
    if (Number.isNaN(instante)) errores.fecha = 'Elige la fecha de la aplicación.';
    else {
      const ms = conError('reentrada', () => vencimientoReentrada(instante, horas));
      if (ms !== undefined) {
        entrar = { tipo: 'fecha', texto: fechaHora(ms), valor: new Date(ms).toISOString() };
      }
    }
  }
  // Con la fecha mal escrita no se calcula nada.
  if (errores.fecha) cosechar = { tipo: 'espera' };
  return { errores, cosechar, entrar };
}
