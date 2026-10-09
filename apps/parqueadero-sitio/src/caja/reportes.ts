/**
 * Lo que el reporte del día lee del teléfono (HU-Q8.5), con lo que el rol puede ver (HU-Q7.8): con
 * la cuenta, el cajero ve solo los turnos de esta caja; sin cuenta no hay roles.
 */
import { type ReporteDelDia, reporteDelDia } from '@ed1/parqueadero-recibos';
import { alcance } from '@ed1/parqueadero-schema/sync';
import { rolDeLaSesion } from './cuenta.ts';
import type { BaseDeLaCaja } from './datos.ts';

export interface Lectura {
  readonly reporte: ReporteDelDia;
  /** Solo los de esta caja: el cajero con cuenta. */
  readonly soloEstaCaja: boolean;
}

export async function leerReporte(db: BaseDeLaCaja, fecha: string): Promise<Lectura> {
  const [registros, rechazos, propia, sesion] = await Promise.all([
    db.registros.toArray(),
    db.rechazos.toArray(),
    db.meta.get('dispositivo'),
    db.meta.get('sesion'),
  ]);
  const rol = sesion?.clave === 'sesion' ? rolDeLaSesion(sesion.sesion) : null;
  const soloEstaCaja = rol !== null && alcance(rol, 'reportes') !== 'si';
  const dispositivo = propia?.clave === 'dispositivo' ? propia.id : '';
  const cuarentena = new Set(
    rechazos.filter((r) => r.entidad === 'registro').map((r) => r.entidad_id),
  );
  return {
    reporte: reporteDelDia(registros, fecha, {
      cuarentena,
      ...(soloEstaCaja ? { dispositivo } : {}),
    }),
    soloEstaCaja,
  };
}
