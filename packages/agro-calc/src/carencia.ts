/**
 * Vencimientos de una aplicación (HU-E3.10). Casos en `casos/carencia.json`.
 *
 * - **Carencia:** días de calendario desde la fecha agronómica de la aplicación, nunca desde la
 *   fecha UTC (P8). Devuelve el primer día en que se puede cosechar: aplicado el 10/12 con 3 días
 *   de carencia, se cosecha desde el 13/12 («No cosechar hasta el 13/12»).
 * - **Reentrada:** horas desde el instante de la aplicación; el huso solo importa al mostrarla.
 *
 * Los días y las horas salen de la etiqueta del insumo. Si son desconocidos, aquí no se llama:
 * quien llama muestra el bloqueo (P1). Nada de valores por defecto.
 */
import { ErrorDeMedida, exigirRango } from './medida.ts';

const MS_POR_DIA = 86_400_000;
const MS_POR_HORA = 3_600_000;

/** Días y horas aceptados: hasta un año. Una etiqueta con más es un error de digitación. */
const MAXIMO_DIAS = 365;
const MAXIMO_HORAS = 24 * 365;

function exigirEntero(campo: string, valor: number, maximo: number): number {
  exigirRango(campo, valor, 0, maximo);
  if (!Number.isInteger(valor)) {
    throw new ErrorDeMedida(campo, `«${campo}» debe ser un número entero: ${valor}`);
  }
  return valor;
}

/** Milisegundos UTC de la medianoche de una fecha `AAAA-MM-DD` que exista en el calendario. */
function diaDe(fecha: string): number {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  const [a, m, d] = partes ? partes.slice(1).map(Number) : [];
  if (a !== undefined && m !== undefined && d !== undefined) {
    const ms = Date.UTC(a, m - 1, d);
    // Date.UTC corre el 29/02/2027 al 01/03: se compara de vuelta para rechazarlo.
    if (new Date(ms).toISOString().slice(0, 10) === fecha) return ms;
  }
  throw new ErrorDeMedida(
    'fechaAplicacion',
    `«fechaAplicacion» no es una fecha AAAA-MM-DD: ${fecha}`,
  );
}

/** Primer día (`AAAA-MM-DD`) en que se puede cosechar. */
export function vencimientoCarencia(fechaAplicacion: string, carenciaDias: number): string {
  const dias = exigirEntero('carenciaDias', carenciaDias, MAXIMO_DIAS);
  return new Date(diaDe(fechaAplicacion) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

/** Instante (ms Unix) desde el que se puede volver a entrar al área. */
export function vencimientoReentrada(instanteAplicacionMs: number, reentradaHoras: number): number {
  exigirRango('instanteAplicacion', instanteAplicacionMs, 0, 2 ** 48);
  const horas = exigirEntero('reentradaHoras', reentradaHoras, MAXIMO_HORAS);
  return instanteAplicacionMs + horas * MS_POR_HORA;
}
