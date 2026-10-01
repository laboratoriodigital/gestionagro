/**
 * Almacén local del cuaderno: Dexie sobre IndexedDB (ADR-3, ARQUITECTURA §5.3, HU-E3.2).
 *
 * El dato nace y vive en el teléfono. Las versiones locales son **aditivas**: una versión nueva
 * agrega tablas o índices y migra datos; nunca borra una tabla con registros (P21). La prueba
 * `migraciones.test.ts` abre cada versión anterior con datos de las dos fincas de prueba y exige
 * que la última no pierda ninguno (P4 al revés: probar la base que ya existe).
 */
import type {
  Area,
  Ciclo,
  Cultivo,
  Finca,
  Insumo,
  Persona,
  Registro,
} from '@gestionagro/agro-schema';
import { Dexie, type EntityTable, type Transaction } from 'dexie';

export type Entidad = 'registro' | 'finca' | 'area' | 'ciclo' | 'persona' | 'insumo' | 'cultivo';

/** Operación pendiente de subir a la celda. Se escribe en la misma transacción que su dato. */
export interface OperacionSalida {
  /**
   * Id de la operación. Para un registro (inmutable) es su id; para un catálogo,
   * `<entidad_id>@v<version>`, porque una misma área se edita varias veces. Reintentar no duplica.
   */
  id: string;
  entidad: Entidad;
  entidad_id: string;
  version: number;
  op: 'crear' | 'actualizar';
  creado: string;
}

/** Versión reemplazada de un catálogo (ADR-4: última escritura gana, con historial). */
export interface VersionAnterior {
  id: string;
  entidad: Exclude<Entidad, 'registro'>;
  entidad_id: string;
  version: number;
  datos: unknown;
  reemplazada: string;
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
  cultivo: EntityTable<Cultivo, 'id'>;
  registro: EntityTable<Registro, 'id'>;
  outbox: EntityTable<OperacionSalida, 'id'>;
  historial: EntityTable<VersionAnterior, 'id'>;
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
  {
    // HU-E3.3: historial de versiones de catálogos, y la cola de salida con entidad y versión.
    version: 2,
    tablas: {
      historial: 'id, entidad_id', // versiones anteriores de un área, una finca…
    },
    migrar: async (tx) => {
      // Las operaciones de v1 eran solo registros: su entidad es ella misma y su versión, 1.
      await tx
        .table('outbox')
        .toCollection()
        .modify((op: Partial<OperacionSalida> & { id: string }) => {
          op.entidad_id ??= op.id;
          op.version ??= 1;
        });
    },
  },
  {
    // HU-E3.4: catálogo de cultivos y ciclos buscables por área (ciclo activo de una nave).
    version: 3,
    tablas: {
      cultivo: 'id, finca_id', // cultivos y variedades de una finca
      ciclo: 'id, finca_id, *area_ids', // ciclos de un área (multiEntry)
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
