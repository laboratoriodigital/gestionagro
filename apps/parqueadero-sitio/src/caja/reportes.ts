/**
 * Lo que el reporte del día lee del teléfono (HU-Q8.5), con lo que el rol puede ver (HU-Q7.8): con
 * la cuenta, el cajero ve solo los turnos de esta caja; sin cuenta no hay roles.
 */
import { type ReporteDelDia, reporteDelDia } from '@ed1/parqueadero-recibos';
import {
  celdaCsv,
  type DatosDePagoAbonado,
  type DatosDeSalida,
  MEDIOS_DE_PAGO,
  type MedioDePago,
} from '@ed1/parqueadero-schema';
import { alcance } from '@ed1/parqueadero-schema/sync';
import { rolDeLaSesion } from './cuenta.ts';
import type { BaseDeLaCaja } from './datos.ts';
import { usaTurnos } from './turno.ts';

export interface ResumenDiario {
  readonly fecha: string;
  readonly entradas: number;
  readonly salidas: number;
  readonly mensualidades: number;
  readonly porMedio: Readonly<Partial<Record<MedioDePago, number>>>;
  readonly completo: boolean;
}

export function csvDelDia(d: ResumenDiario): string {
  const columnas = ['fecha', 'entradas', 'salidas', 'mensualidades', ...MEDIOS_DE_PAGO, 'estado'];
  const valores = [
    d.fecha,
    d.entradas,
    d.salidas,
    d.mensualidades,
    ...MEDIOS_DE_PAGO.map((m) => d.porMedio[m] ?? 0),
    d.completo ? 'registrado al consultar' : 'total parcial: registros en cuarentena',
  ];
  return `\uFEFF${columnas.join(';')}\r\n${valores.map(celdaCsv).join(';')}\r\n`;
}

export interface Lectura {
  readonly reporte: ReporteDelDia;
  /** Solo los de esta caja: el cajero con cuenta. */
  readonly soloEstaCaja: boolean;
  readonly sinTurnos: boolean;
  readonly diario: ResumenDiario;
}

export async function leerReporte(db: BaseDeLaCaja, fecha: string): Promise<Lectura> {
  const [registros, rechazos, propia, sesion, sede] = await Promise.all([
    db.registros.toArray(),
    db.rechazos.toArray(),
    db.meta.get('dispositivo'),
    db.meta.get('sesion'),
    db.catalogos.where('entidad').equals('sede').first(),
  ]);
  const rol = sesion?.clave === 'sesion' ? rolDeLaSesion(sesion.sesion) : null;
  const soloEstaCaja = rol !== null && alcance(rol, 'reportes') !== 'si';
  const dispositivo = propia?.clave === 'dispositivo' ? propia.id : '';
  const cuarentena = new Set(
    rechazos.filter((r) => r.entidad === 'registro').map((r) => r.entidad_id),
  );
  // Las anulaciones pueden ser de un día posterior: el recibo original deja de contar.
  const anulados = new Set(registros.filter((r) => r.tipo === 'anulacion').map((r) => r.anula_id));
  const vigentes = registros.filter(
    (r) =>
      r.fecha_local === fecha &&
      !anulados.has(r.id) &&
      (!soloEstaCaja || r.dispositivo_id === dispositivo),
  );
  const porMedio: Partial<Record<MedioDePago, number>> = {};
  for (const r of vigentes) {
    if (r.tipo === 'salida') {
      const d = r.datos as DatosDeSalida;
      porMedio[d.medio_pago] = (porMedio[d.medio_pago] ?? 0) + d.total;
    } else if (r.tipo === 'pago_abonado') {
      const d = r.datos as DatosDePagoAbonado;
      porMedio[d.medio_pago] = (porMedio[d.medio_pago] ?? 0) + d.valor;
    }
  }
  const reporte = reporteDelDia(registros, fecha, {
    cuarentena,
    ...(soloEstaCaja ? { dispositivo } : {}),
  });
  return {
    sinTurnos: !usaTurnos(sede?.entidad === 'sede' ? sede : null),
    diario: {
      fecha,
      entradas: vigentes.filter((r) => r.tipo === 'entrada').length,
      salidas: vigentes.filter((r) => r.tipo === 'salida').length,
      mensualidades: vigentes.filter((r) => r.tipo === 'pago_abonado').length,
      porMedio,
      completo: reporte.enCuarentena === 0,
    },
    reporte,
    soloEstaCaja,
  };
}
