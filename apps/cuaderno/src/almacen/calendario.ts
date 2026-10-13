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
import { type Area, calendarioDeAreas, type FilaDelCalendario } from '@ed1/agro-schema';
import { estadosPorArea } from './aplicaciones.ts';
import type { CuadernoDb } from './db.ts';

// El cálculo vive en `@ed1/agro-schema` (HU-C9.7): el MCP del cuaderno usa el mismo.
export {
  type Color,
  calendarioDeAreas,
  DIAS_DEL_CALENDARIO,
  type DiaDelCalendario,
  diaDelCalendario,
  type FilaDelCalendario,
} from '@ed1/agro-schema';

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
