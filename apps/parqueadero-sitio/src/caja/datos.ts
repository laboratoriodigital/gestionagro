/**
 * El almacén local de la caja (PARQUEADERO §5.2): Dexie sobre IndexedDB. En Q1 solo las tablas
 * que la impresión usa; las de las entradas llegan con Q2 en la versión 2 del esquema.
 */
import type { Camino, MotivoDeFallo, PaginaDeCodigos, Trozo } from '@ed1/impresion';
import { Dexie, type EntityTable } from 'dexie';

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
}

export type BaseDeLaCaja = Dexie & {
  impresora: EntityTable<RegistroImpresora, 'id'>;
  entregas_pendientes: EntityTable<EntregaPendiente, 'id'>;
};

export function abrirBase(nombre = 'parqueadero-caja'): BaseDeLaCaja {
  const db = new Dexie(nombre) as BaseDeLaCaja;
  db.version(1).stores({ impresora: 'id', entregas_pendientes: '++id, creadaEn' });
  return db;
}
