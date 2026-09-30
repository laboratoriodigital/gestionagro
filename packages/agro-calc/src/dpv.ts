/**
 * Déficit de presión de vapor (DPV). ARQUITECTURA §5.2, HU-E2.1.
 *
 * Fuente: Allen, R. G., Pereira, L. S., Raes, D. y Smith, M. (1998). *Crop evapotranspiration*,
 * FAO Irrigation and Drainage Paper 56, ecuación 11.
 *
 * La calculadora pública, el cuaderno y el firmware del nodo usan esta misma fórmula y la misma
 * tabla de casos, `casos/dpv.json` (P2).
 */
import { exigirRango } from './medida.ts';

/** Rango de temperatura aceptado, en °C: cubre cualquier invernadero y cualquier error de tecleo evidente. */
export const TEMPERATURA_MIN_C = -10;
export const TEMPERATURA_MAX_C = 60;

const exigirTemperatura = (campo: string, valor: number): number =>
  exigirRango(campo, valor, TEMPERATURA_MIN_C, TEMPERATURA_MAX_C);

const exigirHumedad = (valor: number): number => exigirRango('humedadRelativaPct', valor, 0, 100);

/** FAO-56 ec. 11, sin validar: la única copia de la fórmula. Recibe valores ya validados. */
const saturacionKPa = (temperaturaC: number): number =>
  0.6108 * Math.exp((17.27 * temperaturaC) / (temperaturaC + 237.3));

/**
 * Presión de vapor de saturación, FAO-56 ec. 11:
 * `es(T) = 0,6108 · exp(17,27 · T / (T + 237,3))`.
 *
 * @param temperaturaC temperatura en °C, de −10 a 60.
 * @returns presión de vapor de saturación en kPa.
 * @throws ErrorDeMedida si la temperatura no es un número finito o está fuera de rango.
 */
export function presionSaturacionKPa(temperaturaC: number): number {
  return saturacionKPa(exigirTemperatura('temperaturaC', temperaturaC));
}

/**
 * DPV del aire: `DPV = es(T) · (1 − HR/100)`.
 *
 * Ejemplo resuelto: nave a 24 °C y 70 % → es = 2,984 kPa → DPV = 2,984 · 0,30 = 0,895 kPa.
 *
 * @param temperaturaC temperatura del aire en °C, de −10 a 60.
 * @param humedadRelativaPct humedad relativa del aire en %, de 0 a 100.
 * @returns DPV del aire en kPa.
 * @throws ErrorDeMedida si algún valor no es un número finito o está fuera de rango.
 */
export function dpvAireKPa(temperaturaC: number, humedadRelativaPct: number): number {
  const hr = exigirHumedad(humedadRelativaPct);
  return presionSaturacionKPa(temperaturaC) * (1 - hr / 100);
}

/**
 * DPV entre la hoja y el aire: `DPVh = es(Th) − es(T) · HR/100`.
 *
 * Ejemplo resuelto: aire a 26 °C y 60 %, hoja a 24 °C →
 * ea = 3,361 · 0,60 = 2,017 kPa; es(24) = 2,984 kPa → DPVh = 0,967 kPa.
 *
 * Puede ser negativo (hoja más fría que el punto de rocío del aire: condensa); se devuelve tal
 * cual para que quien lo muestre decida cómo avisarlo.
 *
 * @param temperaturaAireC temperatura del aire en °C, de −10 a 60.
 * @param humedadRelativaPct humedad relativa del aire en %, de 0 a 100.
 * @param temperaturaHojaC temperatura de la hoja en °C, de −10 a 60.
 * @returns DPV de la hoja en kPa.
 * @throws ErrorDeMedida si algún valor no es un número finito o está fuera de rango.
 */
export function dpvHojaKPa(
  temperaturaAireC: number,
  humedadRelativaPct: number,
  temperaturaHojaC: number,
): number {
  const hr = exigirHumedad(humedadRelativaPct);
  const aire = exigirTemperatura('temperaturaAireC', temperaturaAireC);
  const hoja = exigirTemperatura('temperaturaHojaC', temperaturaHojaC);
  return saturacionKPa(hoja) - saturacionKPa(aire) * (hr / 100);
}
