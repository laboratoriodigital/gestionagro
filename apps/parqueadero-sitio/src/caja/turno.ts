/**
 * El turno abierto (HU-Q3.9), leído de los registros: si se cierra la app, al volver la caja lo
 * retoma (CA3). Sin zod: el inicio lo pinta sin cargar los esquemas (bitácora parqueadero 14).
 */
import type { DatosDeApertura, DatosDeCierre, Registro } from '@ed1/parqueadero-schema';
import type { BaseDeLaCaja } from './datos.ts';

export interface Turno {
  readonly apertura: Registro;
  /** El orden de la apertura en esta caja: `T-012` es el 12. */
  readonly numero: number;
  readonly operador: string;
  readonly base: number;
}

/** Nada se registra fuera de un turno (HU-Q3.9 CA4). */
export class SinTurno extends Error {
  constructor() {
    super('Primero abra el turno: ningún recibo queda fuera de un turno');
    this.name = 'SinTurno';
  }
}

export async function turnoAbierto(db: BaseDeLaCaja): Promise<Turno | null> {
  const aperturas = await db.registros.where('tipo').equals('turno_apertura').sortBy('id');
  const apertura = aperturas.at(-1);
  if (!apertura) return null;
  const cerrado = await db.registros
    .where('tipo')
    .equals('turno_cierre')
    .filter((c) => (c.datos as DatosDeCierre).apertura_id === apertura.id)
    .count();
  if (cerrado > 0) return null;
  const d = apertura.datos as DatosDeApertura;
  return { apertura, numero: aperturas.length, operador: d.operador, base: d.base };
}

export async function exigirTurno(db: BaseDeLaCaja): Promise<Turno> {
  const t = await turnoAbierto(db);
  if (!t) throw new SinTurno();
  return t;
}

/** `50.000`, `50000` o `$50.000` → 50000; vacío o ilegible → null. */
export function pesosEscritos(texto: string): number | null {
  const limpio = texto.replace(/[$.\s]/g, '');
  return /^\d{1,9}$/.test(limpio) ? Number(limpio) : null;
}
