/**
 * Los recaudos de la contraentrega sin la pantalla (HU-T9.5): la antigüedad en palabras y lo que
 * revisa «Liquidar» antes de mandar. Puras, para probarlas sin navegador.
 */
import { pesos } from './catalogo.ts';

export interface FilaDeRecaudo {
  pedido: string;
  numero: number;
  estado: string;
  montoCop: number;
  comisionCop: number | null;
  fleteIdaCop: number | null;
  fleteVueltaCop: number | null;
  netoCop: number;
  transportadora: string | null;
  guia: string | null;
  desde: string;
}

interface Total {
  montoCop: number;
  cantidad: number;
  desde: string | null;
}

export interface Recaudos {
  porRecaudar: Total;
  sinLiquidar: Total;
  perdidos: Total;
  recaudos: FilaDeRecaudo[];
}

const DIA_MS = 86_400_000;

/** «hoy», «hace 1 día», «hace 12 días»: cuánto lleva así, en días de calendario de Bogotá. */
export function antiguedad(desde: string, ahoraMs: number): string {
  const dia = (ms: number) => Math.floor((ms - 5 * 3_600_000) / DIA_MS);
  const dias = dia(ahoraMs) - dia(Date.parse(desde));
  if (dias <= 0) return 'hoy';
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}

/** Lo que revisa «Liquidar»: al menos uno elegido y el número de la liquidación. */
export function revisarLiquidacion(
  elegidos: readonly string[],
  referencia: string,
): { campo: string; mensaje: string }[] {
  const errores: { campo: string; mensaje: string }[] = [];
  if (elegidos.length === 0)
    errores.push({
      campo: 'pedidos',
      mensaje: 'Elige los recaudos que llegaron en la liquidación.',
    });
  if (!referencia.trim())
    errores.push({
      campo: 'liquidacionRef',
      mensaje: 'Escribe el número de la liquidación de la transportadora.',
    });
  return errores;
}

/** HU-T9.5 CA1: devolver contra entrega pide el flete de vuelta, si se sabe; vacío no es $0. */
export function fleteDeVuelta(texto: string): number | null | undefined {
  if (texto.trim() === '') return null;
  const n = pesos(texto);
  return n !== null && Number.isInteger(n) && n >= 0 ? n : undefined;
}
