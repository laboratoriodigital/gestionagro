/**
 * Lógica de la calculadora de DPV (HU-E2.2), sin interfaz: de lo que el productor escribe al
 * resultado que se muestra. Todo pasa en el teléfono; nada sale a la red (CA5).
 */
import {
  buscarEtapa,
  clasificarDpv,
  dpvAireKPa,
  dpvHojaKPa,
  ErrorDeMedida,
  type EtapaDpv,
  formatearKPa,
  type Indicacion,
  leerNumero,
} from '@gestionagro/agro-calc';

export interface Entradas {
  temperatura: string;
  humedad: string;
  temperaturaHoja: string;
  /** `cultivo:etapa` del catálogo, o vacío para calcular sin indicación. */
  cultivoEtapa: string;
}

export type CampoDpv = 'temperatura' | 'humedad' | 'temperaturaHoja';

export interface Resultado {
  /** Motivo por campo, para mostrarlo junto al campo (CA3). */
  errores: Partial<Record<CampoDpv, string>>;
  aire: { kPa: number; texto: string } | null;
  hoja: { kPa: number; texto: string } | null;
  indicacion: (Indicacion & { fuente: string }) | null;
}

const CAMPO_DE_MEDIDA: Record<string, CampoDpv> = {
  temperaturaC: 'temperatura',
  temperaturaAireC: 'temperatura',
  humedadRelativaPct: 'humedad',
  temperaturaHojaC: 'temperaturaHoja',
};

const MENSAJE_DE_RANGO: Record<CampoDpv, string> = {
  temperatura: 'La temperatura debe estar entre −10 y 60 °C.',
  humedad: 'La humedad debe estar entre 0 y 100 %.',
  temperaturaHoja: 'La temperatura de la hoja debe estar entre −10 y 60 °C.',
};

function etapaDe(cultivoEtapa: string): EtapaDpv | undefined {
  const [cultivo, etapa] = cultivoEtapa.split(':');
  return cultivo && etapa ? buscarEtapa(cultivo, etapa) : undefined;
}

export function calcular(e: Entradas): Resultado {
  const errores: Resultado['errores'] = {};
  const leer = (campo: CampoDpv, texto: string): number | null => {
    if (texto.trim() === '') return null; // vacío: todavía no escribe; no es error ni cero
    const r = leerNumero(texto);
    if (!r.ok) {
      errores[campo] = r.motivo;
      return null;
    }
    return r.valor;
  };
  const t = leer('temperatura', e.temperatura);
  const hr = leer('humedad', e.humedad);
  const th = leer('temperaturaHoja', e.temperaturaHoja);
  const vacio: Resultado = { errores, aire: null, hoja: null, indicacion: null };
  if (t === null || hr === null || Object.keys(errores).length > 0) return vacio;

  try {
    const aire = dpvAireKPa(t, hr);
    const hoja = th === null ? null : dpvHojaKPa(t, hr, th);
    const etapa = etapaDe(e.cultivoEtapa);
    return {
      errores,
      aire: { kPa: aire, texto: formatearKPa(aire) },
      hoja: hoja === null ? null : { kPa: hoja, texto: formatearKPa(hoja) },
      indicacion: etapa ? { ...clasificarDpv(aire, etapa), fuente: etapa.fuente } : null,
    };
  } catch (error) {
    if (error instanceof ErrorDeMedida) {
      const campo = CAMPO_DE_MEDIDA[error.campo] ?? 'temperatura';
      errores[campo] = MENSAJE_DE_RANGO[campo];
      return vacio;
    }
    throw error;
  }
}
