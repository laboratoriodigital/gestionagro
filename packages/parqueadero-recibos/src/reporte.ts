/**
 * El reporte del día (HU-Q8.5, PARQUEADERO §13.1): los turnos de todas las cajas con lo que
 * cobraron, su diferencia y su motivo, y las anulaciones y copias de cada cajero. Se calcula en el
 * dispositivo con lo que tiene, que con la nube es lo de todas las cajas del parqueadero (HU-Q7.5).
 *
 * - **El día comercial es el de Bogotá:** un turno es del día en que abrió (`fecha_local` de su
 *   apertura), aunque cierre después de medianoche.
 * - **Cada turno cuenta como su cierre impreso:** `resumirTurno` con los registros de esa caja entre
 *   su apertura y su cierre. El reporte y el papel del cierre no pueden decir cosas distintas (P2).
 * - **CA3:** con un turno abierto o un registro del día en cuarentena, el reporte no está completo y
 *   lo dice; sus totales son parciales (P1).
 */
import {
  celdaCsv,
  type DatosDeCierre,
  MEDIOS_DE_PAGO,
  type MedioDePago,
  type Registro,
} from '@ed1/parqueadero-schema';
import { type ResumenDeTurno, resumirTurno } from './turno.ts';

export interface TurnoDelReporte {
  readonly dispositivo: string;
  /** La serie de la caja (`A`); nula si esa caja todavía no emitió un recibo. */
  readonly caja: string | null;
  readonly resumen: ResumenDeTurno;
  /** Nulo mientras el turno siga abierto. */
  readonly cierre: {
    readonly cerro: number;
    readonly contado: number;
    readonly diferencia: number;
    readonly motivo: string | null;
  } | null;
}

export interface DelCajero {
  readonly turnos: number;
  /** Las anulaciones que hizo, en los turnos del día. */
  readonly anulaciones: number;
  /** Las copias impresas en sus turnos. */
  readonly copias: number;
}

export interface ReporteDelDia {
  /** `2026-10-06`, el día de Bogotá. */
  readonly fecha: string;
  readonly turnos: readonly TurnoDelReporte[];
  readonly entradas: number;
  readonly salidas: number;
  readonly porMedio: Readonly<Partial<Record<MedioDePago, number>>>;
  /** La suma de las diferencias de los turnos cerrados. */
  readonly diferencia: number;
  readonly porCajero: Readonly<Record<string, DelCajero>>;
  readonly abiertos: number;
  /** Registros del día que la celda puso en cuarentena (o de día desconocido). */
  readonly enCuarentena: number;
  /** Sin turnos abiertos ni cuarentena: los totales son los del día cerrado. */
  readonly completo: boolean;
}

const antes = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * El reporte de `fecha` con todos los registros que tiene el dispositivo. `cuarentena`: los ids de
 * los registros que la celda no aceptó. `dispositivo`: solo los turnos de esa caja (el cajero ve
 * los suyos, HU-Q7.8).
 */
export function reporteDelDia(
  registros: readonly Registro[],
  fecha: string,
  o: { readonly cuarentena?: ReadonlySet<string>; readonly dispositivo?: string } = {},
): ReporteDelDia {
  const porDispositivo = new Map<string, Registro[]>();
  const serieDe = new Map<string, string>();
  const cierres = new Map<string, Registro>();
  for (const r of registros) {
    const lista = porDispositivo.get(r.dispositivo_id) ?? [];
    lista.push(r);
    porDispositivo.set(r.dispositivo_id, lista);
    if (r.serie !== null && !serieDe.has(r.dispositivo_id)) serieDe.set(r.dispositivo_id, r.serie);
    if (r.tipo === 'turno_cierre') cierres.set((r.datos as DatosDeCierre).apertura_id, r);
  }

  const turnos: TurnoDelReporte[] = [];
  for (const [dispositivo, propios] of porDispositivo) {
    if (o.dispositivo !== undefined && dispositivo !== o.dispositivo) continue;
    propios.sort((a, b) => antes(a.instante_evento, b.instante_evento) || antes(a.id, b.id));
    const aperturas = propios.filter((r) => r.tipo === 'turno_apertura');
    aperturas.forEach((apertura, i) => {
      if (apertura.fecha_local !== fecha) return;
      const cierre = cierres.get(apertura.id);
      const hasta = cierre?.instante_evento;
      const del = propios.filter(
        (r) =>
          r.instante_evento >= apertura.instante_evento &&
          (hasta === undefined || r.instante_evento <= hasta),
      );
      const c = cierre?.datos as DatosDeCierre | undefined;
      turnos.push({
        dispositivo,
        caja: serieDe.get(dispositivo) ?? null,
        resumen: resumirTurno(apertura, del, i + 1),
        cierre:
          cierre && c
            ? {
                cerro: Date.parse(cierre.instante_evento),
                contado: c.contado,
                diferencia: c.diferencia,
                motivo: c.motivo,
              }
            : null,
      });
    });
  }
  turnos.sort(
    (a, b) =>
      a.resumen.abrio - b.resumen.abrio ||
      antes(a.caja ?? '', b.caja ?? '') ||
      antes(a.dispositivo, b.dispositivo),
  );

  const porMedio: Partial<Record<MedioDePago, number>> = {};
  const porCajero: Record<string, { turnos: number; anulaciones: number; copias: number }> = {};
  const cajero = (nombre: string) => {
    porCajero[nombre] ??= { turnos: 0, anulaciones: 0, copias: 0 };
    return porCajero[nombre];
  };
  let entradas = 0;
  let salidas = 0;
  let diferencia = 0;
  for (const t of turnos) {
    const r = t.resumen;
    entradas += r.entradas;
    salidas += r.salidas;
    diferencia += t.cierre?.diferencia ?? 0;
    for (const m of MEDIOS_DE_PAGO) {
      const v = r.porMedio[m];
      if (v !== undefined) porMedio[m] = (porMedio[m] ?? 0) + v;
    }
    const suyo = cajero(r.operador);
    suyo.turnos++;
    suyo.copias += r.copias;
    for (const [nombre, n] of Object.entries(r.anulacionesPorOperador))
      cajero(nombre).anulaciones += n;
  }

  // Un registro en cuarentena que el dispositivo no tiene es de día desconocido: cuenta también.
  const delDia = new Map(registros.map((r) => [r.id, r.fecha_local]));
  let enCuarentena = 0;
  for (const id of o.cuarentena ?? []) {
    const dia = delDia.get(id);
    if (dia === undefined || dia === fecha) enCuarentena++;
  }
  const abiertos = turnos.filter((t) => t.cierre === null).length;

  return {
    fecha,
    turnos,
    entradas,
    salidas,
    porMedio,
    diferencia,
    porCajero,
    abiertos,
    enCuarentena,
    completo: abiertos === 0 && enCuarentena === 0,
  };
}

const hora = (ms: number, desfaseMin: number) =>
  new Date(ms + desfaseMin * 60_000).toISOString().slice(11, 16);

export const COLUMNAS_DEL_REPORTE = [
  'fecha',
  'caja',
  'turno',
  'operador',
  'abrio',
  'cerro',
  'entradas',
  'salidas',
  ...MEDIOS_DE_PAGO,
  'base',
  'esperado',
  'contado',
  'diferencia',
  'motivo',
  'anulaciones',
  'copias',
] as const;

/**
 * El reporte en CSV para Excel en español, como el del respaldo: punto y coma y BOM de UTF-8. Una
 * fila por turno y la del total; un turno abierto dice «abierto» en `cerro`, y si el día no está
 * completo el total dice «parcial».
 */
export function csvDelReporte(r: ReporteDelDia, desfaseMin = -300): string {
  const filas = r.turnos.map((t) => {
    const s = t.resumen;
    return [
      r.fecha,
      t.caja,
      s.numero,
      s.operador,
      hora(s.abrio, desfaseMin),
      t.cierre ? hora(t.cierre.cerro, desfaseMin) : 'abierto',
      s.entradas,
      s.salidas,
      ...MEDIOS_DE_PAGO.map((m) => s.porMedio[m] ?? 0),
      s.base,
      s.esperado,
      t.cierre?.contado ?? null,
      t.cierre?.diferencia ?? null,
      t.cierre?.motivo ?? null,
      s.anulaciones,
      s.copias,
    ];
  });
  filas.push([
    r.fecha,
    null,
    r.completo ? 'total' : 'total parcial',
    null,
    null,
    null,
    r.entradas,
    r.salidas,
    ...MEDIOS_DE_PAGO.map((m) => r.porMedio[m] ?? 0),
    null,
    null,
    null,
    r.diferencia,
    null,
    r.turnos.reduce((a, t) => a + t.resumen.anulaciones, 0),
    r.turnos.reduce((a, t) => a + t.resumen.copias, 0),
  ]);
  const lineas = filas.map((f) => f.map(celdaCsv).join(';'));
  return `﻿${[COLUMNAS_DEL_REPORTE.join(';'), ...lineas].join('\r\n')}\r\n`;
}
