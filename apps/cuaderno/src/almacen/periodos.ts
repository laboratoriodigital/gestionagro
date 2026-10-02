/**
 * Periodos de los reportes (HU-E7.2, HU-E7.4): este mes, el mes pasado o todo, en fechas
 * agronómicas de la finca (P8). Una sola fuente para las pantallas que filtran por periodo (P2).
 */
import type { Periodo } from './mano-de-obra.ts';

export const OPCIONES_DE_PERIODO = [
  { valor: 'mes', texto: 'Este mes' },
  { valor: 'mes-pasado', texto: 'El mes pasado' },
  { valor: 'todo', texto: 'Todo' },
];

export type ClavePeriodo = 'mes' | 'mes-pasado' | 'todo';
export function periodoDe(clave: ClavePeriodo, hoy: string): Periodo {
  const [a, m] = hoy.split('-').map(Number) as [number, number];
  const inicio = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, '0')}-01`;
  const fin = (anio: number, mes: number) =>
    new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
  if (clave === 'mes') return { desde: inicio(a, m), hasta: hoy };
  const [ap, mp] = m === 1 ? [a - 1, 12] : [a, m - 1];
  if (clave === 'mes-pasado') return { desde: inicio(ap, mp), hasta: fin(ap, mp) };
  return { desde: null, hasta: null };
}
