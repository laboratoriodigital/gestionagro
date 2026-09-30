/**
 * Almacén local del cuaderno: Dexie sobre IndexedDB (ADR-3, ARQUITECTURA §5.3, HU-E3.2).
 *
 * El dato nace y vive en el teléfono. Las versiones locales son **aditivas**: una versión nueva
 * agrega tablas o índices y migra datos; nunca borra una tabla con registros (P21). La prueba
 * `migraciones.test.ts` abre cada versión anterior con datos de las dos fincas de prueba y exige
 * que la última no pierda ninguno (P4 al revés: probar la base que ya existe).
 */
import type { Area, Ciclo, Finca, Insumo, Persona, Registro } from '@gestionagro/agro-schema';
import { Dexie, type EntityTable, type Transaction } from 'dexie';

/** Operación pendiente de subir a la celda. Se escribe en la misma transacción que su dato. */
export interface OperacionSalida {
  /** Igual al id de la entidad: reintentar no duplica (ARQUITECTURA §5.6). */
  id: string;
  entidad: 'registro' | 'finca' | 'area' | 'ciclo' | 'persona' | 'insumo';
  op: 'crear' | 'actualizar';
  creado: string;
}

export interface Meta {
  clave: string;
  valor: unknown;
  actualizado: string;
}

export type CuadernoDb = Dexie & {
  finca: EntityTable<Finca, 'id'>;
  area: EntityTable<Area, 'id'>;
  ciclo: EntityTable<Ciclo, 'id'>;
  persona: EntityTable<Persona, 'id'>;
  insumo: EntityTable<Insumo, 'id'>;
  registro: EntityTable<Registro, 'id'>;
  outbox: EntityTable<OperacionSalida, 'id'>;
  meta: EntityTable<Meta, 'clave'>;
};

export interface VersionLocal {
  version: number;
  /** Tablas e índices en la sintaxis de Dexie. `null` borra una tabla: prohibido con datos. */
  tablas: Record<string, string | null>;
  migrar?: (tx: Transaction) => Promise<void>;
}

/**
 * Historial completo de versiones locales. Solo se agrega al final.
 * Cada índice cuesta escritura y espacio en teléfonos baratos: se justifica en su comentario.
 */
export const VERSIONES_LOCALES: readonly VersionLocal[] = [
  {
    version: 1,
    tablas: {
      finca: 'id',
      area: 'id, finca_id', // áreas de una finca
      ciclo: 'id, finca_id', // ciclos de una finca
      persona: 'id, finca_id', // personas de una finca
      insumo: 'id, finca_id', // insumos de una finca
      registro: 'id, fecha_agronomica, tipo', // historial por día y por tipo (HU-E3.12)
      outbox: 'id, creado', // envío en orden de creación (HU-E5.2)
      meta: 'clave',
    },
  },
];

export const NOMBRE_POR_DEFECTO = 'gestionagro-cuaderno';

export interface OpcionesDeApertura {
  nombre?: string;
  /** Inyectables para las pruebas (fake-indexeddb); en el navegador se usan los globales. */
  indexedDB?: IDBFactory;
  IDBKeyRange?: typeof IDBKeyRange;
  versiones?: readonly VersionLocal[];
}

export function abrirCuaderno(opciones: OpcionesDeApertura = {}): CuadernoDb {
  const { nombre = NOMBRE_POR_DEFECTO, versiones = VERSIONES_LOCALES, ...dependencias } = opciones;
  const db = new Dexie(nombre, dependencias) as CuadernoDb;
  for (const v of versiones) {
    const version = db.version(v.version).stores(v.tablas);
    if (v.migrar) version.upgrade(v.migrar);
  }
  return db;
}
