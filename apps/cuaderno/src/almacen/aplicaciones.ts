/**
 * Aplicaciones y sus vencimientos (HU-E3.10).
 *
 * - La dosis es la de la etiqueta, como número y unidad; la app no sugiere dosis (CA2).
 * - Carencia y reentrada se copian del insumo al aplicar: si después se corrige la etiqueta del
 *   insumo, lo ya aplicado conserva lo que decía. Si la etiqueta no las traía (desconocidas), se
 *   usa lo que el insumo diga hoy: completar el insumo levanta el bloqueo (CA4, P1).
 * - La carencia se cuenta en fecha agronómica de la finca; la reentrada en horas desde el
 *   instante de la aplicación (CA3, P8). Los cálculos son de `agro-calc` (P2).
 * - La misma mezcla en varias áreas: un registro por área, en una transacción, como el riego.
 */
import {
  ErrorDeValidacion,
  type EstadoDeArea,
  estadosDeAplicaciones,
  type Insumo,
  type Registro,
} from '@ed1/agro-schema';
import { cabeceraDeRegistro, type OpcionesDeRegistro } from './cabecera.ts';
import { soloVigentes } from './consultas.ts';
import type { CuadernoDb } from './db.ts';
import { guardarRegistros } from './guardar.ts';

export interface DatosAplicacion {
  insumoId: string;
  dosis: number;
  dosisUnidad: string;
  volumenMezclaL: number | null;
  equipo: string | null;
  /** Quién aplicó (responsable). */
  personaIds: string[];
  /**
   * Cuánto producto se gastó en total, en la unidad del insumo (HU-E7.1); null si no se anotó.
   * Con varias áreas se reparte en proporción a sus m²: cada registro lleva su parte, y la suma
   * es lo que salió de bodega.
   */
  cantidadUsada?: number | null;
}

export interface DatosAplicacionGuardada {
  insumo_id: string;
  insumo: string;
  dosis: number;
  dosisUnidad: string;
  volumenMezclaL: number | null;
  equipo: string | null;
  carenciaDias: number | null;
  reentradaHoras: number | null;
  /** v2 (HU-E7.1): la parte de este registro; null = no se anotó (o un registro v1). */
  cantidadUsada: number | null;
}

/**
 * Lo que la dosis y la mezcla dicen que se gastó, si la dosis va «por litro» en la unidad del
 * insumo (`mL/L` con un insumo en mL): dosis × litros. Es una sugerencia que la persona confirma;
 * nunca se guarda sola (P1). Nulo si no se puede deducir.
 */
export function cantidadSugerida(
  dosis: number,
  dosisUnidad: string,
  litros: number | null,
  unidadInsumo: string,
): number | null {
  if (litros === null || !(dosis > 0)) return null;
  const limpio = (t: string) => t.toLocaleLowerCase('es').replace(/\s+/g, '');
  // «mL/L», «mL / litro», «mL por litro» → «ml».
  const por = limpio(dosisUnidad).match(/^(.+?)(?:\/l|\/litro|porlitro|porl)$/);
  if (!por || por[1] !== limpio(unidadInsumo)) return null;
  return Math.round(dosis * litros * 1e4) / 1e4;
}

/** Reparte una cantidad entre áreas según sus m²; la última se lleva lo que deja el redondeo. */
export function repartirPorArea(total: number, m2: readonly number[]): number[] {
  const suma = m2.reduce((a, b) => a + b, 0);
  const partes = m2.map((x) =>
    suma > 0
      ? Math.round(((total * x) / suma) * 1e4) / 1e4
      : Math.round((total / m2.length) * 1e4) / 1e4,
  );
  const resto = Math.round((total - partes.slice(0, -1).reduce((a, b) => a + b, 0)) * 1e4) / 1e4;
  return [...partes.slice(0, -1), resto];
}

/** Hasta cuántos días atrás se anota una aplicación (HU-E10.2). */
export const MAXIMO_ATRAS_DIAS = 90;
const MAXIMO_ATRAS_MS = MAXIMO_ATRAS_DIAS * 86_400_000;
/** Un reloj de teléfono un poco adelantado no debe impedir anotar. */
const TOLERANCIA_FUTURO_MS = 5 * 60_000;

export async function guardarAplicacion(
  db: CuadernoDb,
  fincaId: string,
  areaIds: readonly string[],
  datos: DatosAplicacion,
  { ahora = () => new Date(), corrige, cuando }: OpcionesDeRegistro = {},
): Promise<Registro[]> {
  // Una corrección reemplaza un registro de una sola área: la del corregido.
  const areas = corrige ? corrige.area_ids.slice(0, 1) : areaIds;
  const faltan = [];
  // Una aplicación anotada después (HU-E10.2): nunca en el futuro, y no de hace meses por un error
  // al escribir el año (P1). Una corrección conserva el momento del evento corregido.
  if (cuando && !corrige) {
    const ms = cuando.getTime();
    if (Number.isNaN(ms)) faltan.push({ campo: 'cuando', motivo: 'no es una fecha y hora reales' });
    else if (ms > ahora().getTime() + TOLERANCIA_FUTURO_MS) {
      faltan.push({ campo: 'cuando', motivo: 'no puede ser en el futuro' });
    } else if (ahora().getTime() - ms > MAXIMO_ATRAS_MS) {
      faltan.push({
        campo: 'cuando',
        motivo: `es de hace más de ${MAXIMO_ATRAS_DIAS} días: revisa la fecha`,
      });
    }
  }
  if (areas.length === 0) faltan.push({ campo: 'area_ids', motivo: 'elige al menos un área' });
  if (datos.personaIds.length === 0) {
    faltan.push({ campo: 'persona_ids', motivo: 'elige quién aplicó' });
  }
  const insumo = await db.insumo.get(datos.insumoId);
  if (!insumo || insumo.finca_id !== fincaId) {
    faltan.push({ campo: 'insumo_id', motivo: 'elige un insumo de la finca' });
  }
  if (faltan.length > 0 || !insumo) throw new ErrorDeValidacion('Aplicación', faltan);

  // Corregir la dosis no cambia la etiqueta que regía al aplicar; cambiar el insumo, sí.
  const antes = corrige?.datos as DatosAplicacionGuardada | undefined;
  const etiqueta =
    antes && antes.insumo_id === insumo.id
      ? { carenciaDias: antes.carenciaDias, reentradaHoras: antes.reentradaHoras }
      : { carenciaDias: insumo.carencia_dias, reentradaHoras: insumo.reentrada_horas };
  const registros = [];
  const cantidades =
    datos.cantidadUsada === null || datos.cantidadUsada === undefined
      ? areas.map(() => null)
      : repartirPorArea(
          datos.cantidadUsada,
          await Promise.all(areas.map(async (id) => (await db.area.get(id))?.area_m2 ?? 0)),
        );
  for (const [i, areaId] of areas.entries()) {
    const cabecera = await cabeceraDeRegistro(db, {
      fincaId,
      areaId,
      tipo: 'aplicacion',
      v: 2,
      personaIds: datos.personaIds,
      // Quien registra anota a nombre de quien aplicó, tenga o no cuenta (ARQUITECTURA §5.3).
      origen: 'tablero',
      ahora,
      corrige,
      cuando: corrige ? undefined : cuando,
    });
    registros.push({
      ...cabecera,
      datos: {
        insumo_id: insumo.id,
        insumo: insumo.nombre_comercial,
        dosis: datos.dosis,
        dosisUnidad: datos.dosisUnidad.trim(),
        volumenMezclaL: datos.volumenMezclaL,
        equipo: datos.equipo?.trim() || null,
        ...etiqueta,
        cantidadUsada: cantidades[i] ?? null,
      } satisfies DatosAplicacionGuardada,
    });
  }
  return guardarRegistros(db, registros, { ahora });
}

// El cálculo, sin almacén, vive en `@ed1/agro-schema`: el MCP del cuaderno da la misma respuesta
// con lo de la celda (HU-C9.7, P2). Aquí solo se lee del teléfono.
export {
  type EstadoCarencia,
  type EstadoDeArea,
  type EstadoReentrada,
  textoCarencia,
  textoReentrada,
} from '@ed1/agro-schema';

/**
 * Carencia y reentrada vigentes de cada área con aplicaciones. Un área que no aparece está libre.
 * Una carencia desconocida pesa más que cualquier fecha: no se puede saber cuándo cosechar.
 */
export async function estadosPorArea(
  db: CuadernoDb,
  fincaId: string,
  ahora: Date = new Date(),
): Promise<Map<string, EstadoDeArea>> {
  // Una aplicación corregida cuenta una sola vez: con su versión vigente (HU-E3.12).
  const aplicaciones = await soloVigentes(
    db,
    await db.registro
      .where('tipo')
      .equals('aplicacion')
      .filter((r) => r.finca_id === fincaId)
      .toArray(),
  );
  const insumos = new Map<string, Insumo>();
  for (const i of await db.insumo.where('finca_id').equals(fincaId).toArray()) insumos.set(i.id, i);
  return estadosDeAplicaciones(
    aplicaciones.map((r) => ({ ...r, datos: r.datos as DatosAplicacionGuardada })),
    insumos,
    ahora,
  );
}
