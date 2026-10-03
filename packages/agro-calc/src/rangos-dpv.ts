/**
 * Indicación de rango del DPV según el catálogo `catalogos/rangos-dpv.json` (HU-E2.2, CA2).
 * Las acciones son de referencia, en lenguaje de finca; la decisión es del productor.
 */
import catalogo from '../catalogos/rangos-dpv.json' with { type: 'json' };

export interface EtapaDpv {
  id: string;
  nombre: string;
  optimo_kPa: readonly [number, number];
  aceptable_kPa: readonly [number, number];
  fuente: string;
}

export interface CultivoDpv {
  id: string;
  nombre: string;
  /** Otros nombres con que se anota el cultivo, sin tildes ni mayúsculas. */
  sinonimos: readonly string[];
  etapas: readonly EtapaDpv[];
}

export const CULTIVOS_DPV = catalogo.cultivos as unknown as readonly CultivoDpv[];

export type NivelDpv = 'bajo' | 'algo-bajo' | 'en-rango' | 'algo-alto' | 'alto';

export interface Indicacion {
  nivel: NivelDpv;
  titulo: string;
  accion: string;
}

const INDICACIONES: Record<NivelDpv, Omit<Indicacion, 'nivel'>> = {
  bajo: {
    titulo: 'Bajo',
    accion:
      'El aire está casi saturado: la planta transpira poco y aumenta el riesgo de hongos. Ventila o calienta un poco.',
  },
  'algo-bajo': {
    titulo: 'Algo bajo',
    accion:
      'Cerca del límite inferior. Vigila la condensación en hojas y techo, sobre todo al amanecer.',
  },
  'en-rango': { titulo: 'En rango', accion: 'Condición adecuada para el cultivo en esta etapa.' },
  'algo-alto': {
    titulo: 'Algo alto',
    accion:
      'Cerca del límite superior. Vigila el riego y el marchitamiento en las horas de más calor.',
  },
  alto: {
    titulo: 'Alto',
    accion:
      'El aire está muy seco: la planta pierde agua y puede cerrar estomas. Nebuliza, sombrea o cierra ventanas si hace viento seco.',
  },
};

export function clasificarDpv(dpvKPa: number, etapa: EtapaDpv): Indicacion {
  const [optMin, optMax] = etapa.optimo_kPa;
  const [aceMin, aceMax] = etapa.aceptable_kPa;
  const nivel: NivelDpv =
    dpvKPa < aceMin
      ? 'bajo'
      : dpvKPa < optMin
        ? 'algo-bajo'
        : dpvKPa <= optMax
          ? 'en-rango'
          : dpvKPa <= aceMax
            ? 'algo-alto'
            : 'alto';
  return { nivel, ...INDICACIONES[nivel] };
}

/** Sin tildes, en minúsculas y con un solo espacio: «Pimentón  Rojo» → «pimenton rojo». */
const llano = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * El cultivo del catálogo para lo que el productor anotó en el ciclo: «Tomate Chonto orgánico» es
 * tomate, «Pimiento rojo» es pimentón. Vale si el nombre anotado empieza por el nombre o un
 * sinónimo, palabra completa. Sin coincidencia, undefined: el DPV se da sin indicación (P1).
 */
export function cultivoDpvDe(anotado: string): CultivoDpv | undefined {
  const texto = llano(anotado);
  return CULTIVOS_DPV.find((c) =>
    [c.nombre, ...c.sinonimos].map(llano).some((s) => texto === s || texto.startsWith(`${s} `)),
  );
}

export function buscarEtapa(cultivoId: string, etapaId: string): EtapaDpv | undefined {
  return CULTIVOS_DPV.find((c) => c.id === cultivoId)?.etapas.find((e) => e.id === etapaId);
}
