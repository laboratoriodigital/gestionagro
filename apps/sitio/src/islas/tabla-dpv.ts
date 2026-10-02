/**
 * Tabla de DPV imprimible (HU-E2.3): temperatura × humedad con el DPV de cada cruce y su nivel
 * para el cultivo elegido. Cada celda sale de `dpvAireKPa` y `clasificarDpv` de agro-calc (P2):
 * la tabla no tiene su propia fórmula.
 *
 * - Filas cada 2 °C y columnas cada 5 %, para que quepa en una hoja y se lea de pie en la nave.
 * - Sin cultivo, solo los valores: no hay nivel que inventar.
 * - El nivel lleva una marca además del color (--, -, +, ++), para que se lea impreso en blanco
 *   y negro (CA1).
 */
import {
  buscarEtapa,
  clasificarDpv,
  dpvAireKPa,
  type EtapaDpv,
  leerNumero,
  type NivelDpv,
} from '@gestionagro/agro-calc';

export const PASO_TEMPERATURA = 2;
export const PASO_HUMEDAD = 5;
/** Lo que cabe legible en una hoja horizontal. */
export const MAXIMO_FILAS = 16;
export const MAXIMO_COLUMNAS = 14;

export interface EntradasTabla {
  cultivoEtapa: string;
  tMin: string;
  tMax: string;
  hrMin: string;
  hrMax: string;
}

export type CampoTabla = Exclude<keyof EntradasTabla, 'cultivoEtapa'>;

export interface Celda {
  kPa: number;
  /** «0,90» */
  texto: string;
  nivel: NivelDpv | null;
}

export interface TablaDpv {
  etapa: EtapaDpv | null;
  temperaturas: number[];
  humedades: number[];
  /** `celdas[fila][columna]`: fila = temperatura, columna = humedad. */
  celdas: Celda[][];
}

export const MARCA: Record<NivelDpv, string> = {
  bajo: '--',
  'algo-bajo': '-',
  'en-rango': '',
  'algo-alto': '+',
  alto: '++',
};

export const NOMBRE_NIVEL: Record<NivelDpv, string> = {
  bajo: 'Bajo',
  'algo-bajo': 'Algo bajo',
  'en-rango': 'En rango',
  'algo-alto': 'Algo alto',
  alto: 'Alto',
};

export const ENTRADAS_POR_DEFECTO: EntradasTabla = {
  cultivoEtapa: 'tomate:produccion',
  tMin: '12',
  tMax: '34',
  hrMin: '40',
  hrMax: '95',
};

const pasos = (desde: number, hasta: number, paso: number) =>
  Array.from({ length: Math.floor((hasta - desde) / paso) + 1 }, (_, i) => desde + i * paso);

export function armarTabla(e: EntradasTabla): {
  errores: Partial<Record<CampoTabla, string>>;
  tabla: TablaDpv | null;
} {
  const errores: Partial<Record<CampoTabla, string>> = {};
  const entero = (campo: CampoTabla, min: number, max: number, que: string): number | null => {
    const r = leerNumero(e[campo]);
    if (!r.ok || !Number.isInteger(r.valor) || r.valor < min || r.valor > max) {
      errores[campo] = `${que}: un número entero entre ${min} y ${max}.`;
      return null;
    }
    return r.valor;
  };
  const tMin = entero('tMin', 0, 50, 'Temperatura');
  const tMax = entero('tMax', 0, 50, 'Temperatura');
  const hrMin = entero('hrMin', 5, 100, 'Humedad');
  const hrMax = entero('hrMax', 5, 100, 'Humedad');
  if (tMin !== null && tMax !== null && tMax <= tMin)
    errores.tMax = 'Debe ser mayor que la temperatura «desde».';
  if (hrMin !== null && hrMax !== null && hrMax <= hrMin)
    errores.hrMax = 'Debe ser mayor que la humedad «desde».';
  if (Object.keys(errores).length > 0 || tMin === null || tMax === null) {
    return { errores, tabla: null };
  }
  if (hrMin === null || hrMax === null) return { errores, tabla: null };

  const temperaturas = pasos(tMin, tMax, PASO_TEMPERATURA);
  const humedades = pasos(hrMin, hrMax, PASO_HUMEDAD);
  if (temperaturas.length > MAXIMO_FILAS) {
    errores.tMax = `Caben hasta ${MAXIMO_FILAS} temperaturas (cada ${PASO_TEMPERATURA} °C): acorta el rango.`;
  }
  if (humedades.length > MAXIMO_COLUMNAS) {
    errores.hrMax = `Caben hasta ${MAXIMO_COLUMNAS} humedades (cada ${PASO_HUMEDAD} %): acorta el rango.`;
  }
  if (Object.keys(errores).length > 0) return { errores, tabla: null };

  const [cultivo, etapaId] = e.cultivoEtapa.split(':');
  const etapa = (cultivo && etapaId && buscarEtapa(cultivo, etapaId)) || null;
  const celdas = temperaturas.map((t) =>
    humedades.map((hr): Celda => {
      const kPa = dpvAireKPa(t, hr);
      return {
        kPa,
        texto: kPa.toFixed(2).replace('.', ','),
        nivel: etapa ? clasificarDpv(kPa, etapa).nivel : null,
      };
    }),
  );
  return { errores, tabla: { etapa, temperaturas, humedades, celdas } };
}
