/**
 * La tabla de casos de PARQUEADERO §9.3, compartida por la caja, la calculadora y las pruebas. Las
 * horas son de Bogotá (UTC−5); con dos parqueaderos de prueba, ninguno real (P4).
 */
import { TARIFA_CARRO, TARIFA_MOTO } from '@ed1/parqueadero-schema/ensayos';
import type { Abono, ReglasDeTarifa } from './index.ts';

/** Milisegundos Unix de una hora de Bogotá. */
export const bogota = (a: number, m: number, d: number, h: number, min: number, s = 0): number =>
  Date.UTC(a, m - 1, d, h + 5, min, s);

export interface Caso {
  readonly nombre: string;
  readonly entrada: number;
  readonly salida: number;
  readonly tarifa: ReglasDeTarifa;
  readonly tope: number | null;
  readonly abonado?: Abono;
  readonly perdido?: boolean;
  readonly minutos: number;
  readonly total: number;
  readonly conceptos: readonly string[];
}

const CARRO = TARIFA_CARRO; // $230/min, 5 min de gracia, $30.000 por día, perdido $5.000
const MOTO = TARIFA_MOTO; // $60/min, plena desde 180 min $12.000, noche 20:00–05:30 $8.000, abajo_50

export const CASOS: readonly Caso[] = [
  {
    nombre: 'gracia exacta: 5 minutos no pagan',
    entrada: bogota(2026, 10, 6, 18, 5),
    salida: bogota(2026, 10, 6, 18, 10),
    tarifa: CARRO,
    tope: 230,
    minutos: 5,
    total: 0,
    conceptos: ['gracia'],
  },
  {
    nombre: 'un segundo después de la gracia paga 6 minutos',
    entrada: bogota(2026, 10, 6, 18, 5),
    salida: bogota(2026, 10, 6, 18, 10, 1),
    tarifa: CARRO,
    tope: 230,
    minutos: 6,
    total: 1_380,
    conceptos: ['tiempo'],
  },
  {
    nombre: 'minuto 0: entrada y salida en el mismo instante',
    entrada: bogota(2026, 10, 6, 18, 5),
    salida: bogota(2026, 10, 6, 18, 5),
    tarifa: MOTO,
    tope: 161,
    minutos: 0,
    total: 0,
    conceptos: ['gracia'],
  },
  {
    nombre: 'un segundo es un minuto iniciado',
    entrada: bogota(2026, 10, 6, 18, 5),
    salida: bogota(2026, 10, 6, 18, 5, 1),
    tarifa: MOTO,
    tope: 161,
    minutos: 1,
    total: 50,
    conceptos: ['tiempo'],
  },
  {
    nombre: 'cruce de medianoche: un solo bloque',
    entrada: bogota(2026, 10, 6, 23, 50),
    salida: bogota(2026, 10, 7, 0, 20),
    tarifa: CARRO,
    tope: 230,
    minutos: 30,
    total: 6_900,
    conceptos: ['tiempo'],
  },
  {
    nombre: 'la maqueta: 180 minutos, $41.400 por minutos y el tope diario de $30.000',
    entrada: bogota(2026, 10, 6, 18, 5),
    salida: bogota(2026, 10, 6, 21, 5),
    tarifa: CARRO,
    tope: 230,
    minutos: 180,
    total: 30_000,
    conceptos: ['tope_dia'],
  },
  {
    nombre: 'tres días con tope diario',
    entrada: bogota(2026, 10, 6, 8, 0),
    salida: bogota(2026, 10, 9, 8, 0),
    tarifa: CARRO,
    tope: 230,
    minutos: 4_320,
    total: 90_000,
    conceptos: ['tope_dia', 'tope_dia', 'tope_dia'],
  },
  {
    nombre: 'tres días y un minuto: el cuarto bloque cobra por minuto',
    entrada: bogota(2026, 10, 6, 8, 0),
    salida: bogota(2026, 10, 9, 8, 1),
    tarifa: CARRO,
    tope: 230,
    minutos: 4_321,
    total: 90_230,
    conceptos: ['tope_dia', 'tope_dia', 'tope_dia', 'tiempo'],
  },
  {
    nombre: 'plena: 180 minutos todavía por minuto',
    entrada: bogota(2026, 10, 6, 9, 0),
    salida: bogota(2026, 10, 6, 12, 0),
    tarifa: MOTO,
    tope: 161,
    minutos: 180,
    total: 10_800,
    conceptos: ['tiempo'],
  },
  {
    nombre: 'plena: el minuto 181 cobra el día completo',
    entrada: bogota(2026, 10, 6, 9, 0),
    salida: bogota(2026, 10, 6, 12, 1),
    tarifa: MOTO,
    tope: 161,
    minutos: 181,
    total: 12_000,
    conceptos: ['plena'],
  },
  {
    nombre: 'nocturna que empieza y termina: la tarde, la noche y la mañana',
    entrada: bogota(2026, 10, 6, 19, 0),
    salida: bogota(2026, 10, 7, 7, 0),
    tarifa: MOTO,
    tope: 161,
    minutos: 720,
    total: 17_000,
    conceptos: ['tiempo', 'nocturna', 'tiempo'],
  },
  {
    nombre: 'nocturna incompleta: llegó después de las 20:00 y no paga noche',
    entrada: bogota(2026, 10, 6, 21, 0),
    salida: bogota(2026, 10, 7, 7, 0),
    tarifa: MOTO,
    tope: 161,
    minutos: 600,
    total: 12_000,
    conceptos: ['plena'],
  },
  {
    nombre: 'tiquete perdido: una línea aparte',
    entrada: bogota(2026, 10, 6, 18, 5),
    salida: bogota(2026, 10, 6, 18, 15),
    tarifa: CARRO,
    tope: 230,
    perdido: true,
    minutos: 10,
    total: 7_300,
    conceptos: ['tiempo', 'perdido'],
  },
  {
    nombre: 'abonado vigente: no paga',
    entrada: bogota(2026, 10, 6, 10, 0),
    salida: bogota(2026, 10, 6, 18, 0),
    tarifa: MOTO,
    tope: 161,
    abonado: { vence: bogota(2026, 11, 1, 0, 0) },
    minutos: 480,
    total: 0,
    conceptos: ['abonado'],
  },
  {
    nombre: 'abonado que vence en medio: paga desde que venció',
    entrada: bogota(2026, 10, 31, 22, 30),
    salida: bogota(2026, 11, 1, 0, 30),
    tarifa: CARRO,
    tope: 230,
    abonado: { vence: bogota(2026, 11, 1, 0, 0) },
    minutos: 120,
    total: 6_900,
    conceptos: ['abonado', 'tiempo'],
  },
  {
    nombre: 'redondeo hacia abajo: $420 son $400',
    entrada: bogota(2026, 10, 6, 9, 0),
    salida: bogota(2026, 10, 6, 9, 7),
    tarifa: MOTO,
    tope: 161,
    minutos: 7,
    total: 400,
    conceptos: ['tiempo'],
  },
  {
    nombre: 'fin de año: del 31 de diciembre al 1 de enero de 2028',
    entrada: bogota(2027, 12, 31, 19, 0),
    salida: bogota(2028, 1, 1, 7, 0),
    tarifa: MOTO,
    tope: 161,
    minutos: 720,
    total: 17_000,
    conceptos: ['tiempo', 'nocturna', 'tiempo'],
  },
  {
    nombre: 'año bisiesto: del 28 de febrero al 1 de marzo de 2028 son dos días',
    entrada: bogota(2028, 2, 28, 12, 0),
    salida: bogota(2028, 3, 1, 12, 0),
    tarifa: CARRO,
    tope: 230,
    minutos: 2_880,
    total: 60_000,
    conceptos: ['tope_dia', 'tope_dia'],
  },
];
