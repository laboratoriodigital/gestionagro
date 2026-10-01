/**
 * Lógica de la calculadora de DPV (HU-E2.2), sin interfaz: de lo que el productor escribe al
 * resultado que se muestra. Todo pasa en el teléfono; nada sale a la red (CA5).
 */
import {
  buscarEtapa,
  CULTIVOS_DPV,
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

/** Parámetros del enlace compartido. Solo temperatura y humedad: nada personal (HU-E2.4, CA2, P13). */
export const PARAMETROS_COMPARTIDOS = ['t', 'hr'] as const;

const conComa = (n: number) => String(n).replace('.', ',');

export interface Compartir {
  texto: string;
  enlaceCalculadora: string;
  enlaceWhatsApp: string;
}

/**
 * Mensaje para WhatsApp con T, HR, DPV, la indicación si hay cultivo, y el enlace con los valores
 * cargados (HU-E2.4, CA1). Sin emoji. Null si todavía no hay un resultado válido.
 */
export function paraCompartir(e: Entradas, r: Resultado, urlCalculadora: string): Compartir | null {
  const t = leerNumero(e.temperatura);
  const hr = leerNumero(e.humedad);
  if (!r.aire || !t.ok || !hr.ok) return null;
  const url = new URL(urlCalculadora);
  url.search = '';
  url.hash = '';
  url.searchParams.set('t', String(t.valor));
  url.searchParams.set('hr', String(hr.valor));
  const partes = [
    `DPV de mi invernadero: ${r.aire.texto} (${conComa(t.valor)} °C y ${conComa(hr.valor)} % de humedad).`,
  ];
  const [cultivoId, etapaId] = e.cultivoEtapa.split(':');
  const cultivo = CULTIVOS_DPV.find((c) => c.id === cultivoId);
  const etapa = cultivo?.etapas.find((x) => x.id === etapaId);
  if (r.indicacion && cultivo && etapa) {
    partes.push(
      `Para ${cultivo.nombre.toLowerCase()} en ${etapa.nombre.toLowerCase()}: ${r.indicacion.titulo.toLowerCase()}.`,
    );
  }
  partes.push(`Calcúlalo aquí: ${url.toString()}`);
  const texto = partes.join(' ');
  return {
    texto,
    enlaceCalculadora: url.toString(),
    enlaceWhatsApp: `https://wa.me/?text=${encodeURIComponent(texto)}`,
  };
}

/** Lee T y HR de un enlace compartido (CA3). Solo esos dos; cualquier otro parámetro se ignora. */
export function entradasDeEnlace(
  busqueda: string,
): Partial<Pick<Entradas, 'temperatura' | 'humedad'>> {
  const p = new URLSearchParams(busqueda);
  const t = p.get('t');
  const hr = p.get('hr');
  return {
    ...(t !== null ? { temperatura: t.slice(0, 12) } : {}),
    ...(hr !== null ? { humedad: hr.slice(0, 12) } : {}),
  };
}
