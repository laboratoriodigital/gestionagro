/**
 * La hora del teléfono, comparada con la del servidor (HU-Q3.8, PARQUEADERO §5.6). La hora del
 * recibo es la del teléfono, y de ella sale lo que se cobra: si está corrida más de 2 minutos, la
 * cabecera lo dice en rojo y pide corregirla. Nunca la corrige en silencio (P8).
 *
 * Se lee la cabecera `Date` de un archivo del sitio que la caja no precarga, con `no-store` y una
 * marca en la URL: una respuesta guardada traería la hora de cuando se guardó (P7).
 */
import type { Senal } from './senales.ts';

export const MAXIMA_DIFERENCIA = 2 * 60_000;

/** Un archivo pequeño del sitio, fuera de `/caja/`: el service worker no lo responde. */
export const URL_DE_LA_HORA = '/sitio.css';

type Pedir = (url: string, init: RequestInit) => Promise<Pick<Response, 'headers'>>;

/**
 * Milisegundos que el teléfono va adelante (positivo) o atrás (negativo) del servidor, o `null`
 * sin red o sin cabecera. Compara con la mitad del viaje: la respuesta tarda en llegar.
 */
export async function diferenciaDeHora(pedir: Pedir, reloj: () => number): Promise<number | null> {
  const antes = reloj();
  let fecha: string | null;
  try {
    const r = await pedir(`${URL_DE_LA_HORA}?hora=${antes}`, { method: 'HEAD', cache: 'no-store' });
    fecha = r.headers.get('date');
  } catch {
    return null;
  }
  const servidor = fecha ? Date.parse(fecha) : Number.NaN;
  if (Number.isNaN(servidor)) return null;
  return Math.round((antes + reloj()) / 2 - servidor);
}

/** `undefined`: todavía no se revisó. `null`: no se pudo (sin red). */
export function senalDeHora(diferencia: number | null | undefined): Senal {
  if (diferencia === undefined || diferencia === null) {
    return { texto: 'Hora sin revisar', tono: 'neutro' };
  }
  if (Math.abs(diferencia) <= MAXIMA_DIFERENCIA) return { texto: 'Hora correcta', tono: 'bien' };
  const minutos = Math.round(Math.abs(diferencia) / 60_000);
  return {
    texto: `La hora del teléfono está ${minutos} min ${diferencia > 0 ? 'adelantada' : 'atrasada'}: corríjala`,
    tono: 'error',
  };
}
