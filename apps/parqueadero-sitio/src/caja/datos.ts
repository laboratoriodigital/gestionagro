/**
 * El almacén local de la caja (PARQUEADERO §5.2): Dexie sobre IndexedDB. La versión 1 (Q1) tenía
 * solo lo de la impresión; la 2 (Q2) agrega los registros, los catálogos, las estadías abiertas,
 * las fotos y `meta` (dispositivo, consecutivo y PIN); la 3 (Q3), `contactos`; la 4 (HU-Q7.5),
 * la cola de salida (`outbox`) y lo que la celda puso en cuarentena (`rechazos`).
 */
import type { Camino, MotivoDeFallo, PaginaDeCodigos, Trozo } from '@ed1/impresion';
import type { Catalogo, Registro, Vehiculo } from '@ed1/parqueadero-schema';
import type { Entidad } from '@ed1/parqueadero-schema/sync';
import { Dexie, type EntityTable, type Table } from 'dexie';

/** La impresora de esta caja. No sincroniza: cada caja tiene la suya (§5.2). */
export interface RegistroImpresora {
  readonly id: 'actual';
  readonly camino: Camino;
  readonly nombre: string;
  readonly dispositivoId: string;
  readonly servicio?: string;
  readonly caracteristica?: string;
  readonly trozo?: Trozo;
  readonly paginaDeCodigos: PaginaDeCodigos;
  readonly qr: 'nativo' | 'imagen';
  readonly columnas: number;
  /** La página de prueba superada (§7.7). Sin ella, la cabecera dice «Impresora sin probar». */
  readonly probada: boolean;
  readonly probadaEn?: number;
}

/** Una impresión o un envío que falló y espera reintento (§7.3). */
export interface EntregaPendiente {
  id?: number;
  readonly trabajoId: string;
  readonly canal: 'papel';
  readonly motivo: MotivoDeFallo;
  readonly detalle: string;
  readonly creadaEn: number;
  /** El registro del recibo que no salió; vacío en una página de prueba. */
  readonly reciboId?: string;
}

/** Una estadía abierta, para buscar rápido. Se deriva de `registros` y se puede reconstruir. */
export interface Estadia {
  /** El id de la entrada. */
  readonly id: string;
  readonly placa: string;
  readonly vehiculo: Vehiculo;
  readonly numero: string;
  readonly entrada: number;
}

/** Una foto del estado del vehículo, con su formato real (§5.5). */
export interface Foto {
  readonly id: string;
  readonly estadia_id: string;
  readonly tipo: 'image/webp' | 'image/jpeg';
  readonly datos: Blob;
  readonly creada: number;
}

/** Versión anterior de un catálogo (anexo A, `entidad_historial`). */
export interface VersionAnterior {
  readonly id: string;
  readonly entidad: string;
  readonly entidad_id: string;
  readonly version: number;
  readonly datos: unknown;
  readonly reemplazada: string;
  readonly motivo: 'edicion' | 'conflicto';
}

/**
 * El WhatsApp del conductor de una estadía, con su autorización (§8.3, HU-Q4.1 CA3). Vive solo
 * aquí: nunca en `registros`, en el respaldo ni en la consola, y no sincroniza en M0–M2 (ADR-38).
 */
export interface Contacto {
  /** El id de la entrada. */
  readonly estadia_id: string;
  /** Normalizado por `@ed1/whatsapp`: `573001234567`. */
  readonly numero: string;
  /** Cuándo autorizó, en ms. */
  readonly autorizado: number;
  /** Quién lo pidió. Hasta el turno (HU-Q3.9) la caja no tiene operador: es el dispositivo. */
  readonly operador: string;
  readonly aviso_version: string;
  /** 24 h después de la salida; nulo mientras el vehículo esté adentro. */
  readonly borrar_en: number | null;
}

/**
 * Algo que esta caja escribió y la celda todavía no confirma (PARQUEADERO §5.2). Entra en la misma
 * transacción que el registro o el catálogo, y solo si la caja está vinculada a la nube (`nube`
 * en `meta`): una caja sin cuenta, como las de `v0.2.x`, no llena la cola (P10).
 */
export interface OperacionSalida {
  /** El id del registro, o `<id del catálogo>@v<versión>`: el mismo id que viaja en el lote. */
  readonly id: string;
  readonly entidad: Entidad;
  readonly entidad_id: string;
  readonly version: number;
  /** Cuándo entró a la cola, en ms: el orden de salida. */
  readonly creado: number;
}

/** Lo que la celda guardó aparte con su motivo (PARQUEADERO §12): sale de la cola y se dice. */
export interface Rechazo {
  /** El id de la operación. */
  readonly id: string;
  readonly entidad: Entidad;
  readonly entidad_id: string;
  readonly motivo: string;
  /** Cuándo lo dijo la celda, en ms. */
  readonly recibido: number;
}

export type Meta =
  | { readonly clave: 'dispositivo'; readonly id: string; readonly serie: string }
  | { readonly clave: 'consecutivo'; readonly ultimo: number }
  | { readonly clave: 'pin'; readonly sal: string; readonly huella: string }
  /** La imagen del QR de pagos del propio parqueadero (HU-Q3.5 CA2): ED1 no toca el dinero. */
  | { readonly clave: 'qr_pago'; readonly datos: Blob }
  /** El último respaldo entregado (HU-Q3.10 CA1): la cabecera dice su fecha. */
  | { readonly clave: 'respaldo'; readonly instante: number }
  /** Los eventos contados que todavía no salieron a `/_m` (HU-Q5.3): sin datos personales. */
  | { readonly clave: 'eventos'; readonly conteos: Readonly<Record<string, number>> }
  /**
   * La caja está vinculada a la celda de su parqueadero y sincroniza (HU-Q7.5). La escribe la
   * entrada con la cuenta (HU-Q7.6), que también refresca `acceso`; sin ella, nada sale ni entra.
   */
  | {
      readonly clave: 'nube';
      readonly api: string;
      readonly acceso: string;
      /** El parqueadero de la nube (HU-Q7.6): la sesión se renueva para él. */
      readonly org_id?: string;
    }
  /** La cuenta con que se entró (HU-Q7.6). Como `nube`, no viaja en el respaldo (P13). */
  | { readonly clave: 'sesion'; readonly sesion: Sesion }
  /** El id del parqueadero que se está creando en la cuenta: el mismo en cada reintento. */
  | { readonly clave: 'org_pendiente'; readonly id: string }
  /**
   * Lo del piloto que sube a la nube al reclamar (HU-Q7.6 CA2). `encolado`: todo entró a la cola.
   * Queda «verificado» solo cuando la celda tiene lo mismo que la caja (P21).
   */
  | {
      readonly clave: 'reclamo';
      readonly estado: 'subiendo' | 'verificado' | 'con-rechazos';
      readonly encolado: boolean;
      readonly desde: number;
      readonly verificado?: {
        readonly registros: number;
        readonly catalogos: number;
        readonly cuando: number;
      };
    }
  /**
   * Los términos de la nube que se aceptaron en esta caja (HU-Q7.11 CA1): versión e instante.
   * `registrados`: la versión que la celda ya tiene en la fila de la caja; nula mientras no.
   */
  | {
      readonly clave: 'terminos';
      readonly version: string;
      readonly aceptados: number;
      readonly registrados: string | null;
    }
  /**
   * El permiso de Google Drive que se pidió (HU-Q10.1): el verificador espera la vuelta de Google,
   * que solo sirve con él y por 10 minutos. Nunca va en el respaldo.
   */
  | {
      readonly clave: 'drive_pendiente';
      readonly verificador: string;
      readonly accion: 'guardar' | 'traer';
      readonly creado: number;
    }
  /** La última vez que todo lo de la caja estaba en la nube y lo de la nube en la caja (HU-Q7.9). */
  | { readonly clave: 'nube_al_dia'; readonly instante: number }
  /** Hasta dónde bajó la caja lo de las demás cajas: los dos cursores del pull (`@ed1/sync`). */
  | { readonly clave: 'cursor'; readonly registro: number; readonly catalogo: number };

/** La sesión de la cuenta del CORE (HU-C4.3): el token es del producto `parqueadero`. */
export interface Sesion {
  readonly acceso: string;
  readonly acceso_vence: number;
  readonly refresh: string;
  readonly refresh_vence: number;
  readonly usuario: { readonly nombre: string; readonly email: string };
  readonly organizaciones: readonly {
    readonly org_id: string;
    readonly nombre: string;
    readonly rol: string;
  }[];
  readonly org_id: string | null;
  /** La API de la celda de ese parqueadero; nula sin parqueadero. */
  readonly url_api: string | null;
}

export type BaseDeLaCaja = Dexie & {
  impresora: EntityTable<RegistroImpresora, 'id'>;
  entregas_pendientes: EntityTable<EntregaPendiente, 'id'>;
  registros: EntityTable<Registro, 'id'>;
  catalogos: EntityTable<Catalogo, 'id'>;
  historial: EntityTable<VersionAnterior, 'id'>;
  estadias: EntityTable<Estadia, 'id'>;
  fotos: EntityTable<Foto, 'id'>;
  contactos: EntityTable<Contacto, 'estadia_id'>;
  meta: Table<Meta, Meta['clave']>;
  outbox: EntityTable<OperacionSalida, 'id'>;
  rechazos: EntityTable<Rechazo, 'id'>;
};

export function abrirBase(nombre = 'parqueadero-caja'): BaseDeLaCaja {
  const db = new Dexie(nombre) as BaseDeLaCaja;
  db.version(1).stores({ impresora: 'id', entregas_pendientes: '++id, creadaEn' });
  db.version(2).stores({
    registros: 'id, tipo, estadia_id, instante_evento',
    catalogos: 'id, entidad',
    historial: 'id, entidad_id',
    estadias: 'id, placa',
    fotos: 'id, estadia_id',
    meta: 'clave',
  });
  db.version(3).stores({ contactos: 'estadia_id, borrar_en' });
  db.version(4).stores({ outbox: 'id, creado, entidad_id', rechazos: 'id, recibido' });
  return db;
}

/** Borra los números vencidos (HU-Q4.1 CA3). Corre al abrir la caja y cada tanto. */
export const purgarContactos = (db: BaseDeLaCaja, ahora: number): Promise<number> =>
  db.contactos.where('borrar_en').belowOrEqual(ahora).delete();
