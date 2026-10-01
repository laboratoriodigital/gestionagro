/**
 * Dónde nace una organización (HU-E4.1, CA3; ARQUITECTURA §5.4). La celda, el shard y el anillo
 * los decide esta regla escrita, nunca una persona: la finca cero pasa por aquí igual que las
 * demás (ADR-1, P6).
 *
 * 1. **Celda:** entre las celdas `activa` que tienen al menos un shard, la que tiene menos
 *    organizaciones. Empate: la de anillo de despliegue menor y, después, el id menor.
 * 2. **Shard:** dentro de esa celda, el que tiene menos organizaciones. Empate: el primero en el
 *    orden de `celdas.json`.
 * 3. **Anillo de funciones** (§7.3): las primeras `PILOTOS_MAXIMOS` organizaciones son pilotos
 *    (anillo 1) y reciben primero las funciones nuevas; las demás, anillo 2.
 *
 * Si ninguna celda puede recibir organizaciones, se lanza un error que dice por qué. No hay
 * celda «por defecto» (P1).
 */

/** Organizaciones piloto (anillo 1). La finca cero es la primera que se crea (HU-E4.3). */
export const PILOTOS_MAXIMOS = 5;

export interface CeldaDelDirectorio {
  id: string;
  estado: 'activa' | 'fuera';
  anillo_despliegue: number;
  shards: readonly string[];
}

/** Organizaciones que ya viven en cada shard. */
export interface Carga {
  celda_id: string;
  shard: string;
  organizaciones: number;
}

export interface Ubicacion {
  celda_id: string;
  shard: string;
  anillo: 1 | 2;
}

export class SinCeldaDisponible extends Error {
  override name = 'SinCeldaDisponible';
}

export function asignarUbicacion(
  celdas: readonly CeldaDelDirectorio[],
  cargas: readonly Carga[],
  pilotosActuales: number,
): Ubicacion {
  const candidatas = celdas.filter((c) => c.estado === 'activa' && c.shards.length > 0);
  if (candidatas.length === 0) {
    const motivos = celdas.map((c) =>
      c.estado !== 'activa' ? `${c.id} está «${c.estado}»` : `${c.id} no tiene shards`,
    );
    throw new SinCeldaDisponible(
      `Ninguna celda puede recibir organizaciones${motivos.length > 0 ? `: ${motivos.join('; ')}` : ': el directorio está vacío'}. Revisa infrastructure/celdas.json y despliega.`,
    );
  }
  const enShard = (celdaId: string, nombreShard: string) =>
    cargas
      .filter((c) => c.celda_id === celdaId && c.shard === nombreShard)
      .reduce((suma, c) => suma + c.organizaciones, 0);
  const enCelda = (celdaId: string) =>
    cargas.filter((c) => c.celda_id === celdaId).reduce((suma, c) => suma + c.organizaciones, 0);

  const [celda] = [...candidatas].sort(
    (a, b) =>
      enCelda(a.id) - enCelda(b.id) ||
      a.anillo_despliegue - b.anillo_despliegue ||
      a.id.localeCompare(b.id, 'es', { numeric: true }),
  );
  if (!celda) throw new SinCeldaDisponible('Ninguna celda puede recibir organizaciones');
  // `sort` es estable: a carga igual, queda el primero de celdas.json.
  const [shard] = [...celda.shards].sort((a, b) => enShard(celda.id, a) - enShard(celda.id, b));
  if (!shard) throw new SinCeldaDisponible(`${celda.id} no tiene shards`);
  return { celda_id: celda.id, shard, anillo: pilotosActuales < PILOTOS_MAXIMOS ? 1 : 2 };
}
