/**
 * Rendimiento por operario (HU-E7.4): cuánto cosecha cada persona por hora, en la unidad de la
 * cosecha (kg, tallos, cajas). Casos en `casos/rendimiento-operario.json`.
 *
 * - Una cosecha con varias personas reparte la cantidad por partes iguales: se anotó en equipo.
 * - Solo las cosechas con horas entran a la tasa. Las que no tienen horas no cuentan como 0 horas
 *   ni como 0 kilos: se cuentan aparte para decir cuántas quedaron fuera (CA3, P1).
 * - Cada unidad va por separado: kilos y tallos no se suman.
 */

export interface CosechaConPersonas {
  personaIds: readonly string[];
  cantidad: number;
  unidad: string;
  /** Horas de cada persona; null si no se anotaron. */
  horasPorPersona: number | null;
}

export interface RendimientoDePersona {
  personaId: string;
  unidad: string;
  /** Lo cosechado en las cosechas con horas. */
  cantidad: number;
  horas: number;
  /** Cantidad por hora; null si no hay horas. */
  porHora: number | null;
  /** Cosechas de la persona en esa unidad sin horas anotadas: no entran a la tasa. */
  sinHoras: number;
}

const redondear = (n: number, cifras: number) => Math.round(n * 10 ** cifras) / 10 ** cifras;

export function rendimientoPorOperario(
  cosechas: readonly CosechaConPersonas[],
): RendimientoDePersona[] {
  const por = new Map<
    string,
    { personaId: string; unidad: string; cantidad: number; horas: number; sinHoras: number }
  >();
  for (const c of cosechas) {
    if (c.personaIds.length === 0) continue;
    const parte = c.cantidad / c.personaIds.length;
    for (const personaId of c.personaIds) {
      const clave = `${personaId}|${c.unidad}`;
      const fila = por.get(clave) ?? {
        personaId,
        unidad: c.unidad,
        cantidad: 0,
        horas: 0,
        sinHoras: 0,
      };
      if (c.horasPorPersona === null || !(c.horasPorPersona > 0)) fila.sinHoras += 1;
      else {
        fila.cantidad += parte;
        fila.horas += c.horasPorPersona;
      }
      por.set(clave, fila);
    }
  }
  return [...por.values()].map((f) => ({
    ...f,
    cantidad: redondear(f.cantidad, 3),
    horas: redondear(f.horas, 2),
    porHora: f.horas > 0 ? redondear(f.cantidad / f.horas, 2) : null,
  }));
}
