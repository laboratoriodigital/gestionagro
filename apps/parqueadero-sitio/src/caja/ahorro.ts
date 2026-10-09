/**
 * Lo que ahorra el parqueadero (HU-Q8.6): los recibos de esta semana, la pasada, este mes y el
 * pasado por el canal que llegaron, con el costo por recibo que la sede declaró en Ajustes. Lee
 * los registros del teléfono, que con la nube son los de todas las cajas (HU-Q7.5).
 */
import {
  type AhorroDelPeriodo,
  ahorroDelPeriodo,
  periodosDelAhorro,
} from '@ed1/parqueadero-recibos';
import { leerAjustes } from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';

export interface AhorroConNombre extends AhorroDelPeriodo {
  readonly nombre: string;
}

export interface LecturaDelAhorro {
  readonly periodos: readonly AhorroConNombre[];
  /** Nulo mientras la sede no diga lo que le cuesta cada recibo en papel (P1). */
  readonly costo: number | null;
}

export async function leerAhorro(db: BaseDeLaCaja, hoy: string): Promise<LecturaDelAhorro> {
  const [registros, { sede }] = await Promise.all([db.registros.toArray(), leerAjustes(db)]);
  const costo = sede?.costo_papel ?? null;
  return {
    costo,
    periodos: periodosDelAhorro(hoy).map((p) => ({
      nombre: p.nombre,
      ...ahorroDelPeriodo(registros, p.desde, p.hasta, costo),
    })),
  };
}
