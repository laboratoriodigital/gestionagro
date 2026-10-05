/**
 * Calendario de carencias y reentradas (HU-E9.1): «¿qué nave puedo cosechar hoy?» y los 14 días
 * siguientes. Sale de `estadosPorArea`, que usa `vencimientoCarencia` y `vencimientoReentrada` de
 * agro-calc, la misma fuente que la herramienta pública (P2).
 *
 * - Los días son fechas agronómicas de la finca (`AAAA-MM-DD`, huso de Bogotá) y se cuentan en el
 *   calendario, nunca sumando horas: el huso del teléfono no cambia el día (P8).
 * - Lo desconocido va en gris y nunca en verde (P1): sin la carencia o la reentrada de la etiqueta
 *   no se sabe cuándo se puede.
 * - Un área hereda lo aplicado en las áreas que la contienen: si se fumigó la nave, sus camas
 *   tampoco se pueden cosechar.
 */
import { type Area, fechaAgronomica, sumarDias } from '@ed1/agro-schema';
import {
  type EstadoCarencia,
  type EstadoDeArea,
  type EstadoReentrada,
  estadosPorArea,
  textoCarencia,
  textoReentrada,
} from './aplicaciones.ts';
import type { CuadernoDb } from './db.ts';

export const DIAS_DEL_CALENDARIO = 14;

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

const LIBRE: EstadoDeArea = { carencia: { tipo: 'libre' }, reentrada: { tipo: 'libre' } };

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

/** Hoy y los días siguientes de cada área activa, en el orden de `areas`. */
export function calendarioDeAreas(
  areas: Area[],
  estados: Map<string, EstadoDeArea>,
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
      // `estadosPorArea` ya dejó fuera lo vencido a esta hora: hoy sale como cualquier otro día.
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

/** El calendario de la finca leído del cuaderno. */
export async function calendarioDeCarencias(
  db: CuadernoDb,
  fincaId: string,
  areas: Area[],
  ahora: Date = new Date(),
): Promise<FilaDelCalendario[]> {
  return calendarioDeAreas(areas, await estadosPorArea(db, fincaId, ahora), ahora);
}

/**
 * Una cama o un surco igual a su nave no se repite: hereda lo de ella (revisión del dueño,
 * 3 oct 2026: con 32 camas la lista se volvía interminable). Se muestra si algo la distingue.
 */
export function distintasDeSuNave(filas: readonly FilaDelCalendario[]): FilaDelCalendario[] {
  const porId = new Map(filas.map((f) => [f.area.id, f]));
  const igual = (a: FilaDelCalendario, b: FilaDelCalendario) =>
    a.hoy.carencia === b.hoy.carencia &&
    a.hoy.reentrada === b.hoy.reentrada &&
    a.dias.every(
      (d, i) => d.color === b.dias[i]?.color && d.entrarDesde === b.dias[i]?.entrarDesde,
    );
  return filas.filter((f) => {
    const padre = f.area.padre_id ? porId.get(f.area.padre_id) : undefined;
    return !padre || !igual(f, padre);
  });
}
