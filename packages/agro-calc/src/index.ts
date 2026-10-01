export {
  dpvAireKPa,
  dpvHojaKPa,
  presionSaturacionKPa,
  TEMPERATURA_MAX_C,
  TEMPERATURA_MIN_C,
} from './dpv.ts';
export { ErrorDeMedida, exigirRango } from './medida.ts';
export { formatearKPa, type Lectura, leerNumero } from './numeros.ts';
export {
  buscarEtapa,
  CULTIVOS_DPV,
  type CultivoDpv,
  clasificarDpv,
  type EtapaDpv,
  type Indicacion,
  type NivelDpv,
} from './rangos-dpv.ts';
export { drenajePct, formatearPct, RANGO_CE_DS_M, RANGO_PH } from './riego.ts';
