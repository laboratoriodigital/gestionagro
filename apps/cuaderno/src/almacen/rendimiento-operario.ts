/**
 * Rendimiento por operario (HU-E7.4), en el navegador (ADR-5) con `rendimientoPorOperario` de
 * agro-calc: lo cosechado por hora de cada persona en un periodo, y sus horas en labores.
 * Solo cosechas vigentes: una corregida cuenta una vez. Las cosechas sin horas o sin quién
 * cosechó no entran al cálculo y se cuentan para decirlo (CA3, P1).
 */
import { type RendimientoDePersona, rendimientoPorOperario } from '@gestionagro/agro-calc';
import type { Registro } from '@gestionagro/agro-schema';
import { soloVigentes } from './consultas.ts';
import type { CuadernoDb } from './db.ts';
import type { Periodo } from './mano-de-obra.ts';

export interface RendimientoDeOperario {
  personaId: string;
  nombre: string;
  /** Una fila por unidad de cosecha (kg, tallos…). */
  cosecha: RendimientoDePersona[];
  /** Horas en labores del periodo. */
  horasLabor: number;
}

export interface RendimientoDelEquipo {
  personas: RendimientoDeOperario[];
  /** Cosechas sin quién cosechó: no son de nadie. */
  cosechasSinPersona: number;
  /** Cosechas con personas pero sin horas: no entran a la tasa. */
  cosechasSinHoras: number;
}

export async function rendimientoDelEquipo(
  db: CuadernoDb,
  fincaId: string,
  periodo: Periodo,
): Promise<RendimientoDelEquipo> {
  const delPeriodo = async (tipo: string) =>
    soloVigentes(
      db,
      await db.registro
        .where('tipo')
        .equals(tipo)
        .filter(
          (r) =>
            r.finca_id === fincaId &&
            (periodo.desde === null || r.fecha_agronomica >= periodo.desde) &&
            (periodo.hasta === null || r.fecha_agronomica <= periodo.hasta),
        )
        .toArray(),
    );
  const [cosechas, labores, personas] = await Promise.all([
    delPeriodo('cosecha'),
    delPeriodo('labor'),
    db.persona.where('finca_id').equals(fincaId).toArray(),
  ]);
  const horasDe = (r: Registro) =>
    (r.datos as { horasPorPersona?: number | null }).horasPorPersona ?? null;

  const filas = rendimientoPorOperario(
    cosechas.map((r) => ({
      personaIds: r.persona_ids,
      cantidad: (r.datos as { cantidad: number }).cantidad,
      unidad: (r.datos as { unidad: string }).unidad,
      horasPorPersona: horasDe(r),
    })),
  );
  const horasLabor = new Map<string, number>();
  for (const r of labores) {
    for (const id of r.persona_ids) {
      horasLabor.set(id, (horasLabor.get(id) ?? 0) + (horasDe(r) ?? 0));
    }
  }
  const nombreDe = new Map(personas.map((p) => [p.id, p.nombre]));
  const ids = [...new Set([...filas.map((f) => f.personaId), ...horasLabor.keys()])];
  return {
    personas: ids
      .map((personaId) => ({
        personaId,
        nombre: nombreDe.get(personaId) ?? 'Persona sin nombre',
        cosecha: filas.filter((f) => f.personaId === personaId),
        horasLabor: Math.round((horasLabor.get(personaId) ?? 0) * 100) / 100,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    cosechasSinPersona: cosechas.filter((r) => r.persona_ids.length === 0).length,
    cosechasSinHoras: cosechas.filter((r) => r.persona_ids.length > 0 && horasDe(r) === null)
      .length,
  };
}
