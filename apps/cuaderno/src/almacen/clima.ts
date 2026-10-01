/**
 * Registro de clima (HU-E3.8): temperatura y humedad de la nave, temperatura de la hoja opcional
 * y el DPV calculado.
 *
 * - El DPV lo calcula siempre esta función con `agro-calc`, la misma de la calculadora pública:
 *   nunca se guarda un DPV que no salga de los datos crudos (CA1, P2). `recalcularDpv` lo vuelve a
 *   sacar de lo guardado.
 * - El registro va al ciclo activo del área, si lo hay (HU-E3.4, CA1).
 * - Con `corrige`, reemplaza a un registro anterior sin borrarlo (HU-E3.12).
 */
import { dpvAireKPa } from '@gestionagro/agro-calc';
import type { Registro } from '@gestionagro/agro-schema';
import { cabeceraDeRegistro, type OpcionesDeRegistro } from './cabecera.ts';
import { ultimosRegistros } from './consultas.ts';
import type { CuadernoDb } from './db.ts';
import { guardarRegistro } from './guardar.ts';

export interface DatosClima {
  temperaturaC: number;
  humedadRelativaPct: number;
  temperaturaHojaC: number | null;
}

export interface DatosClimaGuardado extends DatosClima {
  dpvKPa: number;
}

export async function guardarClima(
  db: CuadernoDb,
  fincaId: string,
  areaId: string,
  datos: DatosClima,
  { ahora = () => new Date(), corrige }: OpcionesDeRegistro = {},
): Promise<Registro> {
  // Valida T y HR (lanza ErrorDeMedida con el campo) y calcula con la fórmula única.
  const dpvKPa = dpvAireKPa(datos.temperaturaC, datos.humedadRelativaPct);
  const cabecera = await cabeceraDeRegistro(db, {
    fincaId,
    areaId,
    tipo: 'clima',
    v: 1,
    personaIds: [],
    origen: 'manual',
    ahora,
    corrige,
  });
  return guardarRegistro(
    db,
    { ...cabecera, datos: { ...datos, dpvKPa } satisfies DatosClimaGuardado },
    { ahora },
  );
}

/** DPV recalculado desde los datos crudos de un registro de clima guardado (CA1). */
export function recalcularDpv(r: Registro): number {
  const d = r.datos as DatosClimaGuardado;
  return dpvAireKPa(d.temperaturaC, d.humedadRelativaPct);
}

/** Últimos registros de clima de la finca, del más reciente al más viejo. */
export function ultimosClimas(db: CuadernoDb, fincaId: string, limite = 10): Promise<Registro[]> {
  return ultimosRegistros(db, fincaId, ['clima'], limite);
}

export { pendientesDeSubir } from './consultas.ts';
