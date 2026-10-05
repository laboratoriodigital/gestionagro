/**
 * Rendimiento por ciclo y área (HU-E6.6), en el navegador (ADR-5) con `rendimiento` de agro-calc.
 *
 * - Una fila por ciclo y unidad de cosecha: lo cosechado en el ciclo, sobre el área de sus naves
 *   (m²) y sobre sus plantas. Sin plantas anotadas, «por planta» no se calcula (P1).
 * - Las cosechas sin ciclo van aparte, por área, sin «por planta».
 * - Agrupadas por cultivo, para comparar naves del mismo cultivo (CA2). Solo cosechas vigentes:
 *   una corregida cuenta una vez.
 */
import { type Rendimiento, rendimiento } from '@ed1/agro-calc';
import type { Registro } from '@ed1/agro-schema';
import { soloVigentes } from './consultas.ts';
import type { CuadernoDb } from './db.ts';

export interface FilaDeRendimiento {
  clave: string;
  /** Nombres de las áreas del ciclo (o el área de la cosecha sin ciclo). */
  areas: string;
  areaM2: number;
  /** Nulo para las cosechas sin ciclo. */
  ciclo: {
    cultivo: string;
    variedad: string;
    trasplante: string;
    estado: 'activo' | 'cerrado';
    plantas: number | null;
  } | null;
  unidad: string;
  cosechas: number;
  cosechado: number;
  descarte: number;
  resultado: Rendimiento;
}

export interface GrupoDeRendimiento {
  /** «Sin ciclo» para las cosechas que no tienen. */
  cultivo: string;
  filas: FilaDeRendimiento[];
}

interface DatosCosecha {
  cantidad: number;
  unidad: string;
  descarte: number | null;
}

export async function rendimientoDeLaFinca(
  db: CuadernoDb,
  fincaId: string,
): Promise<GrupoDeRendimiento[]> {
  const [areas, ciclos, todas] = await Promise.all([
    db.area.where('finca_id').equals(fincaId).toArray(),
    db.ciclo.where('finca_id').equals(fincaId).toArray(),
    db.registro
      .where('tipo')
      .equals('cosecha')
      .filter((r) => r.finca_id === fincaId)
      .toArray(),
  ]);
  const cosechas = await soloVigentes(db, todas);
  const areaDe = new Map(areas.map((a) => [a.id, a]));
  const cicloDe = new Map(ciclos.map((c) => [c.id, c]));

  // Clave: ciclo (o área, sin ciclo) y unidad.
  const acumulado = new Map<string, { base: Omit<FilaDeRendimiento, 'resultado'> }>();
  for (const r of cosechas as Registro[]) {
    const d = r.datos as DatosCosecha;
    const ciclo = r.ciclo_id ? cicloDe.get(r.ciclo_id) : undefined;
    const ids = ciclo ? ciclo.area_ids : r.area_ids;
    const clave = `${ciclo ? `ciclo:${ciclo.id}` : `area:${ids.join(',')}`}|${d.unidad}`;
    const previo = acumulado.get(clave);
    if (previo) {
      previo.base.cosechas += 1;
      previo.base.cosechado += d.cantidad;
      previo.base.descarte += d.descarte ?? 0;
      continue;
    }
    const suyas = ids.flatMap((id) => areaDe.get(id) ?? []);
    acumulado.set(clave, {
      base: {
        clave,
        areas: suyas.map((a) => a.nombre).join(', ') || 'Área sin nombre',
        areaM2: suyas.reduce((s, a) => s + a.area_m2, 0),
        ciclo: ciclo
          ? {
              cultivo: ciclo.cultivo,
              variedad: ciclo.variedad,
              trasplante: ciclo.fecha_trasplante,
              estado: ciclo.estado,
              plantas: ciclo.plantas,
            }
          : null,
        unidad: d.unidad,
        cosechas: 1,
        cosechado: d.cantidad,
        descarte: d.descarte ?? 0,
      },
    });
  }

  const grupos = new Map<string, FilaDeRendimiento[]>();
  for (const { base } of acumulado.values()) {
    if (base.areaM2 <= 0) continue; // un área sin m² no deja calcular por m²
    const fila: FilaDeRendimiento = {
      ...base,
      resultado: rendimiento({
        cosechado: base.cosechado,
        descarte: Math.min(base.descarte, base.cosechado),
        areaM2: base.areaM2,
        plantas: base.ciclo?.plantas ?? null,
      }),
    };
    const cultivo = base.ciclo?.cultivo ?? 'Sin ciclo';
    grupos.set(cultivo, [...(grupos.get(cultivo) ?? []), fila]);
  }
  return [...grupos]
    .map(([cultivo, filas]) => ({
      cultivo,
      // La mejor nave primero: es lo que se compara.
      filas: filas.sort((a, b) => b.resultado.porM2 - a.resultado.porM2),
    }))
    .sort((a, b) =>
      a.cultivo === 'Sin ciclo'
        ? 1
        : b.cultivo === 'Sin ciclo'
          ? -1
          : a.cultivo.localeCompare(b.cultivo, 'es'),
    );
}
