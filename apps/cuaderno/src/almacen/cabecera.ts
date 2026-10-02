/**
 * Columnas comunes de un registro nuevo o de una corrección (HU-E3.12). Una sola copia para todos
 * los tipos (P2).
 *
 * Corregir no borra ni modifica (ADR-4): escribe un registro nuevo con `anula_id` que apunta al
 * corregido. El evento sigue siendo el mismo, así que conserva área, ciclo, fecha agronómica e
 * instante del evento; el id nuevo (UUIDv7) guarda cuándo se corrigió.
 */
import { fechaAgronomica, type Registro, uuidv7 } from '@gestionagro/agro-schema';
import { cicloActivoDe } from './ciclos.ts';
import type { CuadernoDb } from './db.ts';
import { idDispositivo } from './dispositivo.ts';

export interface OpcionesDeRegistro {
  ahora?: () => Date;
  /** Registro vigente que este reemplaza. */
  corrige?: Registro | undefined;
  /**
   * Cuándo pasó, si no fue ahora (HU-E10.2): la aplicación de la mañana anotada en la noche. De
   * aquí salen la fecha agronómica y la carencia; el id sigue siendo el momento de anotarlo.
   */
  cuando?: Date | undefined;
}

type Cabecera = Omit<Registro, 'datos'>;

export async function cabeceraDeRegistro(
  db: CuadernoDb,
  p: {
    fincaId: string;
    areaId: string;
    tipo: string;
    v: number;
    personaIds: readonly string[];
    origen: Registro['origen'];
    ahora: () => Date;
    corrige?: Registro | undefined;
    cuando?: Date | undefined;
  },
): Promise<Cabecera> {
  const momento = p.ahora();
  const comunes = {
    // Varios registros en el mismo milisegundo: el azar del UUIDv7 los distingue.
    id: uuidv7(() => momento.getTime()),
    org_id: null,
    finca_id: p.fincaId,
    tipo: p.tipo,
    v: p.v,
    autor_usuario_id: null,
    persona_ids: [...p.personaIds],
    dispositivo_id: await idDispositivo(db, p.ahora),
    origen: p.origen,
  };
  if (p.corrige) {
    return {
      ...comunes,
      area_ids: [...p.corrige.area_ids],
      ciclo_id: p.corrige.ciclo_id,
      fecha_agronomica: p.corrige.fecha_agronomica,
      instante_evento: p.corrige.instante_evento,
      anula_id: p.corrige.id,
    };
  }
  const ciclo = await cicloActivoDe(db, p.areaId);
  return {
    ...comunes,
    area_ids: [p.areaId],
    ciclo_id: ciclo?.id ?? null,
    fecha_agronomica: fechaAgronomica((p.cuando ?? momento).getTime()),
    instante_evento: (p.cuando ?? momento).toISOString(),
    anula_id: null,
  };
}
