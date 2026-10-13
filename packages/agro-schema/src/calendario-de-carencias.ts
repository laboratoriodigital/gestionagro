/**
 * El calendario de carencias y reentradas, sin almacén (HU-E9.1, HU-C9.7): «¿qué nave puedo
 * cosechar hoy?» y los días siguientes. Lo usan el cuaderno (con lo del teléfono) y el MCP del
 * cuaderno (con lo de la celda): la misma respuesta en los dos lados (P2).
 *
 * - Los días son fechas agronómicas de la finca (`AAAA-MM-DD`, huso de Bogotá) y se cuentan en el
 *   calendario, nunca sumando horas (P8).
 * - Lo desconocido va en gris y nunca en verde (P1): sin la carencia o la reentrada de la etiqueta
 *   no se sabe cuándo se puede.
 * - Un área hereda lo aplicado en las áreas que la contienen.
 * - Una aplicación corregida cuenta una sola vez: con su versión vigente. Quien llama pasa solo
 *   las vigentes.
 */
import { vencimientoCarencia, vencimientoReentrada } from '@ed1/agro-calc';
import type { Area } from './catalogos.ts';
import { fechaAgronomica, sumarDias } from './reloj.ts';

export const DIAS_DEL_CALENDARIO = 14;

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

/** Lo que el cálculo usa de una aplicación vigente. */
export interface AplicacionParaCarencias {
  instante_evento: string;
  fecha_agronomica: string;
  area_ids: readonly string[];
  datos: {
    insumo_id: string;
    insumo: string;
    carenciaDias?: number | null;
    reentradaHoras?: number | null;
  };
}

/** Lo que el cálculo usa de un insumo: la etiqueta de hoy, si la aplicación no la guardó. */
export interface InsumoParaCarencias {
  carencia_dias: number | null;
  reentrada_horas: number | null;
}

const LIBRE: EstadoDeArea = { carencia: { tipo: 'libre' }, reentrada: { tipo: 'libre' } };
const sinRepetir = (xs: string[]) => [...new Set(xs)];

/**
 * Carencia y reentrada vigentes de cada área con aplicaciones. Un área que no aparece está libre.
 * Una carencia desconocida pesa más que cualquier fecha: no se puede saber cuándo cosechar.
 */
export function estadosDeAplicaciones(
  aplicaciones: readonly AplicacionParaCarencias[],
  insumos: ReadonlyMap<string, InsumoParaCarencias>,
  ahora: Date,
): Map<string, EstadoDeArea> {
  const hoy = fechaAgronomica(ahora.getTime());
  const estados = new Map<string, EstadoDeArea>();
  for (const r of aplicaciones) {
    // Al evaluar un momento pasado (corregir una cosecha vieja), lo aplicado después no cuenta.
    if (Date.parse(r.instante_evento) > ahora.getTime()) continue;
    const d = r.datos;
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

/** «13/12» desde `AAAA-MM-DD`, sin pasar por un huso (P8). */
const diaMes = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

const FECHA_HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
/** «13/12/2026 14:30», hora de Bogotá. El cuaderno lo usa como su `fechaHora` (P2). */
export const fechaHoraDeBogota = (iso: string): string =>
  FECHA_HORA.format(new Date(iso)).replace(',', '');

/** Texto de la carencia para la nave, o null si se puede cosechar. */
export function textoCarencia(e: EstadoCarencia): string | null {
  if (e.tipo === 'libre') return null;
  if (e.tipo === 'hasta') return `No cosechar hasta el ${diaMes(e.fecha)} (${e.insumo})`;
  return `Carencia desconocida de ${e.insumos.join(', ')}: no cosechar hasta completarla en Insumos`;
}

/** Texto de la reentrada para la nave, o null si ya se puede entrar. */
export function textoReentrada(e: EstadoReentrada): string | null {
  if (e.tipo === 'libre') return null;
  if (e.tipo === 'desde') return `Reentrada desde ${fechaHoraDeBogota(e.instante)} (${e.insumo})`;
  return `Reentrada desconocida de ${e.insumos.join(', ')}: complétala en Insumos antes de entrar`;
}

export type Color = 'verde' | 'rojo' | 'gris';

export type DiaDelCalendario = {
  fecha: string;
  color: Color;
  /** La carencia sigue ese día: no se cosecha aunque ya se pueda entrar. */
  enCarencia: boolean;
  /** Hora de Bogotá (`HH:MM`) en que termina la reentrada ese día; null si no termina ese día. */
  entrarDesde: string | null;
};

export type FilaDelCalendario = {
  area: Area;
  /** Nombre con el de las áreas que la contienen: «Nave 1 › Cama 2». */
  nombre: string;
  hoy: { color: Color; carencia: string | null; reentrada: string | null };
  dias: DiaDelCalendario[];
};

const HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function peorCarencia(a: EstadoCarencia, b: EstadoCarencia): EstadoCarencia {
  if (a.tipo === 'desconocida' && b.tipo === 'desconocida') {
    return { tipo: 'desconocida', insumos: [...new Set([...a.insumos, ...b.insumos])] };
  }
  if (a.tipo === 'desconocida' || b.tipo === 'libre') return a;
  if (b.tipo === 'desconocida' || a.tipo === 'libre') return b;
  return b.fecha > a.fecha ? b : a;
}

function peorReentrada(a: EstadoReentrada, b: EstadoReentrada): EstadoReentrada {
  if (a.tipo === 'desconocida' && b.tipo === 'desconocida') {
    return { tipo: 'desconocida', insumos: [...new Set([...a.insumos, ...b.insumos])] };
  }
  if (a.tipo === 'desconocida' || b.tipo === 'libre') return a;
  if (b.tipo === 'desconocida' || a.tipo === 'libre') return b;
  return Date.parse(b.instante) > Date.parse(a.instante) ? b : a;
}

/** El color de un día: gris si algo es desconocido, rojo si la carencia o la reentrada siguen. */
export function diaDelCalendario(estado: EstadoDeArea, fecha: string): DiaDelCalendario {
  const { carencia, reentrada } = estado;
  if (carencia.tipo === 'desconocida' || reentrada.tipo === 'desconocida') {
    return { fecha, color: 'gris', enCarencia: false, entrarDesde: null };
  }
  // «Cosechar desde el 13» : el 13 ya se puede.
  const enCarencia = carencia.tipo === 'hasta' && fecha < carencia.fecha;
  let entrarDesde: string | null = null;
  let sinEntrar = false;
  if (reentrada.tipo === 'desde') {
    const fin = Date.parse(reentrada.instante);
    const diaFin = fechaAgronomica(fin);
    sinEntrar = fecha <= diaFin;
    if (fecha === diaFin) entrarDesde = HORA.format(new Date(fin));
  }
  return { fecha, color: enCarencia || sinEntrar ? 'rojo' : 'verde', enCarencia, entrarDesde };
}

/** Hoy y los días siguientes de cada área activa, ordenadas por nombre. */
export function calendarioDeAreas(
  areas: Area[],
  estados: ReadonlyMap<string, EstadoDeArea>,
  ahora: Date,
  dias: number = DIAS_DEL_CALENDARIO,
): FilaDelCalendario[] {
  const porId = new Map(areas.map((a) => [a.id, a]));
  const hoy = fechaAgronomica(ahora.getTime());
  const cadena = (a: Area): Area[] => {
    const padre = a.padre_id ? porId.get(a.padre_id) : undefined;
    return padre ? [...cadena(padre), a] : [a];
  };
  return areas
    .filter((a) => a.activa)
    .map((area) => {
      const linaje = cadena(area);
      const estado = linaje.reduce<EstadoDeArea>((e, a) => {
        const propio = estados.get(a.id) ?? LIBRE;
        return {
          carencia: peorCarencia(e.carencia, propio.carencia),
          reentrada: peorReentrada(e.reentrada, propio.reentrada),
        };
      }, LIBRE);
      // Los estados ya dejaron fuera lo vencido a esta hora: hoy sale como cualquier otro día.
      const calendario = Array.from({ length: dias }, (_, i) =>
        diaDelCalendario(estado, sumarDias(hoy, i)),
      );
      return {
        area,
        nombre: linaje.map((a) => a.nombre).join(' › '),
        hoy: {
          color: calendario[0]?.color ?? diaDelCalendario(estado, hoy).color,
          carencia: textoCarencia(estado.carencia),
          reentrada: textoReentrada(estado.reentrada),
        },
        dias: calendario,
      };
    })
    .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es', { numeric: true }));
}
