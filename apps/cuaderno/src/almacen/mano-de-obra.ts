/**
 * Costo de la mano de obra por nave y periodo (HU-E7.2), en el navegador (ADR-5) con agro-calc.
 *
 * Cada labor vigente cuesta, por persona, `horas / 8 × jornal`, con el jornal que regía el día de
 * la labor: el de la persona o, si no tiene, el general de la finca. Cambiar un valor no toca lo
 * pasado (CA1). Sin ningún valor que rija, el costo de esa persona no se conoce: se cuenta para
 * decirlo, nunca se suma como 0 (P1). No liquida nómina ni recargos (CA3).
 */
import { costoDeHoras, type ValorConVigencia, valorVigente } from '@ed1/agro-calc';
import { soloVigentes } from './consultas.ts';
import type { CuadernoDb } from './db.ts';

export interface ManoDeObraDeArea {
  areaId: string;
  horas: number;
  /** Suma de lo conocido, en pesos. */
  costo: number;
  /** Personas-labor sin valor de jornal que rigiera ese día. */
  sinValor: number;
}

export interface Periodo {
  /** AAAA-MM-DD, incluidos; null = sin límite. */
  desde: string | null;
  hasta: string | null;
}

export interface ManoDeObraDeAreaYCiclo extends ManoDeObraDeArea {
  /** El ciclo del registro, si el área es de ese ciclo; null si no hay. */
  cicloId: string | null;
}

/** Por área, sumando sus ciclos. */
export async function manoDeObraPorArea(
  db: CuadernoDb,
  fincaId: string,
  periodo: Periodo,
): Promise<ManoDeObraDeArea[]> {
  const por = new Map<string, ManoDeObraDeArea>();
  for (const f of await manoDeObraPorAreaYCiclo(db, fincaId, periodo)) {
    const fila = por.get(f.areaId) ?? { areaId: f.areaId, horas: 0, costo: 0, sinValor: 0 };
    fila.horas += f.horas;
    fila.costo += f.costo;
    fila.sinValor += f.sinValor;
    por.set(f.areaId, fila);
  }
  return [...por.values()].map((f) => ({ ...f, horas: Math.round(f.horas * 100) / 100 }));
}

/**
 * Por área y ciclo (HU-E7.3). Una labor en varias áreas lleva el ciclo de la primera: en las otras
 * cuenta para su ciclo solo si el área también es de él; si no, va al área sin ciclo.
 */
export async function manoDeObraPorAreaYCiclo(
  db: CuadernoDb,
  fincaId: string,
  periodo: Periodo,
): Promise<ManoDeObraDeAreaYCiclo[]> {
  const labores = (
    await soloVigentes(
      db,
      await db.registro
        .where('tipo')
        .equals('labor')
        .filter(
          (r) =>
            r.finca_id === fincaId &&
            (periodo.desde === null || r.fecha_agronomica >= periodo.desde) &&
            (periodo.hasta === null || r.fecha_agronomica <= periodo.hasta),
        )
        .toArray(),
    )
  ).sort((a, b) => a.fecha_agronomica.localeCompare(b.fecha_agronomica));
  // Pocas filas por finca: sin índice por finca_id (db.ts), se filtra.
  const valores = await db.valor_jornal.filter((v) => v.finca_id === fincaId).toArray();
  const deQuien = (personaId: string | null): ValorConVigencia[] =>
    valores
      .filter((v) => v.persona_id === personaId)
      .map((v) => ({ desde: v.vigente_desde, valor: v.valor_cop, actualizado: v.actualizado }));
  const general = deQuien(null);
  const areasDelCiclo = new Map(
    (await db.ciclo.where('finca_id').equals(fincaId).toArray()).map((c) => [c.id, c.area_ids]),
  );
  const por = new Map<string, ManoDeObraDeAreaYCiclo>();
  for (const r of labores) {
    const horas = (r.datos as { horasPorPersona: number }).horasPorPersona;
    for (const areaId of r.area_ids) {
      const cicloId =
        r.ciclo_id && areasDelCiclo.get(r.ciclo_id)?.includes(areaId) ? r.ciclo_id : null;
      const clave = `${areaId}|${cicloId ?? ''}`;
      const fila = por.get(clave) ?? { areaId, cicloId, horas: 0, costo: 0, sinValor: 0 };
      for (const personaId of r.persona_ids) {
        const valor =
          valorVigente(deQuien(personaId), r.fecha_agronomica) ??
          valorVigente(general, r.fecha_agronomica);
        // Una labor en varias áreas reparte sus horas por partes iguales.
        const parte = horas / r.area_ids.length;
        fila.horas += parte;
        const costo = costoDeHoras(parte, valor);
        if (costo === null) fila.sinValor += 1;
        else fila.costo += costo;
      }
      por.set(clave, fila);
    }
  }
  return [...por.values()];
}
