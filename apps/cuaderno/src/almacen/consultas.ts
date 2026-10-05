/**
 * Consultas de registros para las pantallas del cuaderno. Todo se calcula en el teléfono
 * (ADR-5): la celda nunca ejecuta un reporte.
 *
 * Un registro corregido queda **anulado**: otro registro lo nombra en `anula_id` (HU-E3.12).
 * Sigue guardado para la traza, pero ninguna cuenta, aviso ni lista de vigentes lo usa.
 */
import type { Registro } from '@ed1/agro-schema';
import type { CuadernoDb } from './db.ts';

/** Ids de los registros anulados por una corrección. Usa el índice `anula_id` (v6). */
export async function anulados(db: CuadernoDb): Promise<Set<string>> {
  // IndexedDB no indexa null: solo aparecen los registros que corrigen a otro.
  const ids = await db.registro.orderBy('anula_id').keys();
  return new Set(ids.map(String));
}

/** Los registros que nadie anuló. */
export async function soloVigentes(db: CuadernoDb, registros: Registro[]): Promise<Registro[]> {
  const fuera = await anulados(db);
  return registros.filter((r) => !fuera.has(r.id));
}

/** Del más reciente al más viejo; mismo instante (un riego en varias naves): desempata el id. */
const recientesPrimero = (a: Registro, b: Registro) =>
  b.instante_evento.localeCompare(a.instante_evento) || b.id.localeCompare(a.id);

/** Últimos registros vigentes de la finca de los tipos pedidos, del más reciente al más viejo. */
export async function ultimosRegistros(
  db: CuadernoDb,
  fincaId: string,
  tipos: readonly string[],
  limite = 10,
): Promise<Registro[]> {
  const registros = await db.registro
    .where('tipo')
    .anyOf([...tipos])
    .filter((r) => r.finca_id === fincaId)
    .toArray();
  return (await soloVigentes(db, registros)).sort(recientesPrimero).slice(0, limite);
}

export interface FiltroHistorial {
  /** Fechas agronómicas `AAAA-MM-DD`, ambas incluidas. */
  desde: string;
  hasta: string;
  areaId?: string | undefined;
  tipo?: string | undefined;
}

export interface EntradaDeHistorial {
  /** Versión vigente. */
  registro: Registro;
  /** Versiones que esta reemplazó, de la más reciente a la más vieja. */
  anteriores: Registro[];
}

/**
 * Historial por área, tipo y rango de fechas (HU-E3.12, CA1). Usa el índice de fecha agronómica:
 * no recorre la base entera. Cada vigente trae la cadena de versiones que reemplazó (CA2).
 */
export async function historial(
  db: CuadernoDb,
  fincaId: string,
  filtro: FiltroHistorial,
): Promise<EntradaDeHistorial[]> {
  const delRango = await db.registro
    .where('fecha_agronomica')
    .between(filtro.desde, filtro.hasta, true, true)
    .filter(
      (r) =>
        r.finca_id === fincaId &&
        (!filtro.tipo || r.tipo === filtro.tipo) &&
        (!filtro.areaId || r.area_ids.includes(filtro.areaId)),
    )
    .toArray();
  const porId = new Map(delRango.map((r) => [r.id, r]));
  const fuera = await anulados(db);
  return delRango
    .filter((r) => !fuera.has(r.id))
    .sort(recientesPrimero)
    .map((registro) => {
      const anteriores: Registro[] = [];
      // Una corrección conserva la fecha del evento: su cadena cae en el mismo rango.
      for (let id = registro.anula_id; id; ) {
        const previo = porId.get(id);
        if (!previo) break;
        anteriores.push(previo);
        id = previo.anula_id;
      }
      return { registro, anteriores };
    });
}

/** Ids de registros que siguen en la cola de salida: «solo en este teléfono» (HU-E3.14). */
export async function pendientesDeSubir(db: CuadernoDb): Promise<Set<string>> {
  // Para un registro, el id de su operación de salida es el id del registro.
  const ids = await db.outbox.filter((o) => o.entidad === 'registro').primaryKeys();
  return new Set(ids.map(String));
}
