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
import { vencimientoCarencia, vencimientoReentrada } from '@gestionagro/agro-calc';
import {
  ErrorDeValidacion,
  fechaAgronomica,
  type Insumo,
  type Registro,
} from '@gestionagro/agro-schema';
import { fechaHora } from '../formato.ts';
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
}

export async function guardarAplicacion(
  db: CuadernoDb,
  fincaId: string,
  areaIds: readonly string[],
  datos: DatosAplicacion,
  { ahora = () => new Date(), corrige }: OpcionesDeRegistro = {},
): Promise<Registro[]> {
  // Una corrección reemplaza un registro de una sola área: la del corregido.
  const areas = corrige ? corrige.area_ids.slice(0, 1) : areaIds;
  const faltan = [];
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
  for (const areaId of areas) {
    const cabecera = await cabeceraDeRegistro(db, {
      fincaId,
      areaId,
      tipo: 'aplicacion',
      v: 1,
      personaIds: datos.personaIds,
      // Quien registra anota a nombre de quien aplicó, tenga o no cuenta (ARQUITECTURA §5.3).
      origen: 'tablero',
      ahora,
      corrige,
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
      } satisfies DatosAplicacionGuardada,
    });
  }
  return guardarRegistros(db, registros, { ahora });
}

export type EstadoCarencia =
  | { tipo: 'libre' }
  | { tipo: 'hasta'; fecha: string; insumo: string }
  | { tipo: 'desconocida'; insumos: string[] };

export type EstadoReentrada =
  | { tipo: 'libre' }
  | { tipo: 'desde'; instante: string; insumo: string }
  | { tipo: 'desconocida'; insumos: string[] };

export interface EstadoDeArea {
  carencia: EstadoCarencia;
  reentrada: EstadoReentrada;
}

const LIBRE: EstadoDeArea = { carencia: { tipo: 'libre' }, reentrada: { tipo: 'libre' } };

/**
 * Carencia y reentrada vigentes de cada área con aplicaciones. Un área que no aparece está libre.
 * Una carencia desconocida pesa más que cualquier fecha: no se puede saber cuándo cosechar.
 */
export async function estadosPorArea(
  db: CuadernoDb,
  fincaId: string,
  ahora: Date = new Date(),
): Promise<Map<string, EstadoDeArea>> {
  const hoy = fechaAgronomica(ahora.getTime());
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

  const estados = new Map<string, EstadoDeArea>();
  for (const r of aplicaciones) {
    const d = r.datos as DatosAplicacionGuardada;
    const actual = insumos.get(d.insumo_id);
    const carenciaDias = d.carenciaDias ?? actual?.carencia_dias ?? null;
    const reentradaHoras = d.reentradaHoras ?? actual?.reentrada_horas ?? null;
    for (const areaId of r.area_ids) {
      const e = estados.get(areaId) ?? structuredClone(LIBRE);
      if (carenciaDias === null) {
        e.carencia =
          e.carencia.tipo === 'desconocida'
            ? { tipo: 'desconocida', insumos: sinRepetir([...e.carencia.insumos, d.insumo]) }
            : { tipo: 'desconocida', insumos: [d.insumo] };
      } else if (e.carencia.tipo !== 'desconocida') {
        const fecha = vencimientoCarencia(r.fecha_agronomica, carenciaDias);
        const vigente = fecha > hoy;
        if (vigente && (e.carencia.tipo === 'libre' || fecha > e.carencia.fecha)) {
          e.carencia = { tipo: 'hasta', fecha, insumo: d.insumo };
        }
      }
      if (reentradaHoras === null) {
        e.reentrada =
          e.reentrada.tipo === 'desconocida'
            ? { tipo: 'desconocida', insumos: sinRepetir([...e.reentrada.insumos, d.insumo]) }
            : { tipo: 'desconocida', insumos: [d.insumo] };
      } else if (e.reentrada.tipo !== 'desconocida') {
        const ms = vencimientoReentrada(Date.parse(r.instante_evento), reentradaHoras);
        const vigente = ms > ahora.getTime();
        if (vigente && (e.reentrada.tipo === 'libre' || ms > Date.parse(e.reentrada.instante))) {
          e.reentrada = { tipo: 'desde', instante: new Date(ms).toISOString(), insumo: d.insumo };
        }
      }
      estados.set(areaId, e);
    }
  }
  return estados;
}

const sinRepetir = (xs: string[]) => [...new Set(xs)];

/** «13/12» desde `AAAA-MM-DD`, sin pasar por un huso (P8). */
const diaMes = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

/** Texto de la carencia para la nave, o null si se puede cosechar (CA1, CA4). */
export function textoCarencia(e: EstadoCarencia): string | null {
  if (e.tipo === 'libre') return null;
  if (e.tipo === 'hasta') return `No cosechar hasta el ${diaMes(e.fecha)} (${e.insumo})`;
  return `Carencia desconocida de ${e.insumos.join(', ')}: no cosechar hasta completarla en Insumos`;
}

/** Texto de la reentrada para la nave, o null si ya se puede entrar (CA1). */
export function textoReentrada(e: EstadoReentrada): string | null {
  if (e.tipo === 'libre') return null;
  if (e.tipo === 'desde') return `Reentrada desde ${fechaHora(e.instante)} (${e.insumo})`;
  return `Reentrada desconocida de ${e.insumos.join(', ')}: complétala en Insumos antes de entrar`;
}
