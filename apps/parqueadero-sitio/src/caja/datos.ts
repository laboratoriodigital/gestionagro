/**
 * El almacén local de la caja (PARQUEADERO §5.2): Dexie sobre IndexedDB. La versión 1 (Q1) tenía
 * solo lo de la impresión; la 2 (Q2) agrega los registros, los catálogos, las estadías abiertas,
 * las fotos y `meta` (dispositivo, consecutivo y PIN); la 3 (Q3), `contactos`.
 */
import type { Camino, MotivoDeFallo, PaginaDeCodigos, Trozo } from '@ed1/impresion';
import type { Catalogo, Registro, Vehiculo } from '@ed1/parqueadero-schema';
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

export type Meta =
  | { readonly clave: 'dispositivo'; readonly id: string; readonly serie: string }
  | { readonly clave: 'consecutivo'; readonly ultimo: number }
  | { readonly clave: 'pin'; readonly sal: string; readonly huella: string }
  /** La imagen del QR de pagos del propio parqueadero (HU-Q3.5 CA2): ED1 no toca el dinero. */
  | { readonly clave: 'qr_pago'; readonly datos: Blob }
  /** El último respaldo entregado (HU-Q3.10 CA1): la cabecera dice su fecha. */
  | { readonly clave: 'respaldo'; readonly instante: number };

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
  return db;
}

/** Borra los números vencidos (HU-Q4.1 CA3). Corre al abrir la caja y cada tanto. */
export const purgarContactos = (db: BaseDeLaCaja, ahora: number): Promise<number> =>
  db.contactos.where('borrar_en').belowOrEqual(ahora).delete();
