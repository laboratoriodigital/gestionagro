import type { Registro } from '@ed1/parqueadero-schema';
import { ENTRADA_ENSAYO, SALIDA_ENSAYO } from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { COLUMNAS_DEL_REPORTE, csvDelReporte, reporteDelDia } from './reporte.ts';
import { resumirTurno } from './turno.ts';

const comun = {
  org_id: null,
  v: 1,
  fecha_local: '2026-10-06',
  autor_usuario_id: null,
  origen: 'manual',
  anula_id: null,
  estadia_id: null,
  serie: null,
  consecutivo: null,
} as const;

let n = 0;
const reg = (
  tipo: Registro['tipo'],
  dispositivo_id: string,
  instante_evento: string,
  datos: object,
  extra: Partial<Registro> = {},
): Registro => ({
  ...comun,
  id: `0199bc3e-0000-7000-8000-${String(++n).padStart(12, '0')}`,
  tipo,
  dispositivo_id,
  instante_evento,
  datos,
  ...extra,
});

// Caja A (la de los ensayos): turno de 6:00 a 21:30, una entrada y su salida de $30.000 en
// efectivo, y una copia.
const A = ENTRADA_ENSAYO.dispositivo_id;
const APERTURA_A = reg('turno_apertura', A, '2026-10-06T11:00:00.000Z', {
  base: 100_000,
  operador: 'Ana',
});
const CIERRE_A = reg('turno_cierre', A, '2026-10-07T02:30:00.000Z', {
  apertura_id: APERTURA_A.id,
  esperado: 130_000,
  contado: 129_600,
  diferencia: -400,
  motivo: 'cambio mal dado',
});
const COPIA = reg('entrega_recibo', A, '2026-10-06T23:10:00.000Z', {
  recibo_id: ENTRADA_ENSAYO.id,
  canal: 'papel',
  copia: true,
  resultado: 'enviado',
});

// Caja B: abrió a las 18:00 y sigue abierta; una entrada que Beto anuló.
const B = 'caja-ensayo-2';
const APERTURA_B = reg('turno_apertura', B, '2026-10-06T23:00:00.000Z', {
  base: 50_000,
  operador: 'Beto',
});
const ENTRADA_B: Registro = {
  ...ENTRADA_ENSAYO,
  id: '0199bc3e-3b40-7000-8000-000000000301',
  dispositivo_id: B,
  serie: 'B',
  consecutivo: 1,
  instante_evento: '2026-10-06T23:20:00.000Z',
};
const ANULACION_B = reg(
  'anulacion',
  B,
  '2026-10-06T23:25:00.000Z',
  { motivo: 'placa equivocada', operador: 'Beto' },
  { anula_id: ENTRADA_B.id },
);

// El día anterior, en la caja A: no es de este reporte, pero cuenta para numerar T-002.
const AYER = reg(
  'turno_apertura',
  A,
  '2026-10-05T11:00:00.000Z',
  { base: 0, operador: 'Ana' },
  { fecha_local: '2026-10-05' },
);
const CIERRE_AYER = reg('turno_cierre', A, '2026-10-05T20:00:00.000Z', {
  apertura_id: AYER.id,
  esperado: 0,
  contado: 0,
  diferencia: 0,
  motivo: null,
});

const TODO: Registro[] = [
  AYER,
  CIERRE_AYER,
  APERTURA_A,
  ENTRADA_ENSAYO,
  COPIA,
  SALIDA_ENSAYO,
  CIERRE_A,
  APERTURA_B,
  ENTRADA_B,
  ANULACION_B,
];

describe('el reporte del día (HU-Q8.5)', () => {
  it('trae los turnos de todas las cajas del día, cada uno como su cierre impreso', () => {
    const r = reporteDelDia(TODO, '2026-10-06');
    expect(r.turnos.map((t) => [t.caja, t.resumen.numero, t.resumen.operador])).toEqual([
      ['A', 'T-002', 'Ana'],
      ['B', 'T-001', 'Beto'],
    ]);
    // El turno A es el mismo que cuenta su cierre: los registros entre la apertura y el cierre.
    const a = r.turnos[0];
    expect(a?.resumen).toEqual(
      resumirTurno(APERTURA_A, [APERTURA_A, ENTRADA_ENSAYO, COPIA, SALIDA_ENSAYO, CIERRE_A], 2),
    );
    expect(a?.cierre).toEqual({
      cerro: Date.parse(CIERRE_A.instante_evento),
      contado: 129_600,
      diferencia: -400,
      motivo: 'cambio mal dado',
    });
    expect(r.entradas).toBe(1);
    expect(r.salidas).toBe(1);
    expect(r.porMedio).toEqual({ efectivo: 30_000 });
    expect(r.diferencia).toBe(-400);
    expect(r.porCajero).toEqual({
      Ana: { turnos: 1, anulaciones: 0, copias: 1 },
      Beto: { turnos: 1, anulaciones: 1, copias: 0 },
    });
  });

  it('❌ con un turno abierto o un registro del día en cuarentena no está completo (CA3)', () => {
    const conAbierto = reporteDelDia(TODO, '2026-10-06');
    expect(conAbierto.abiertos).toBe(1);
    expect(conAbierto.completo).toBe(false);
    const soloA = reporteDelDia(TODO, '2026-10-06', { dispositivo: A });
    expect(soloA.completo).toBe(true);
    const enCuarentena = reporteDelDia(TODO, '2026-10-06', {
      dispositivo: A,
      cuarentena: new Set([ENTRADA_ENSAYO.id]),
    });
    expect(enCuarentena.enCuarentena).toBe(1);
    expect(enCuarentena.completo).toBe(false);
    // Uno de otro día no toca este reporte; uno que la caja no tiene, sí, por si acaso.
    expect(
      reporteDelDia(TODO, '2026-10-06', { dispositivo: A, cuarentena: new Set([AYER.id]) })
        .completo,
    ).toBe(true);
    expect(
      reporteDelDia(TODO, '2026-10-06', { dispositivo: A, cuarentena: new Set(['otro']) })
        .enCuarentena,
    ).toBe(1);
  });

  it('el cajero ve solo su caja; un turno es del día en que abrió', () => {
    expect(reporteDelDia(TODO, '2026-10-06', { dispositivo: B }).turnos).toHaveLength(1);
    expect(reporteDelDia(TODO, '2026-10-05').turnos.map((t) => t.resumen.numero)).toEqual([
      'T-001',
    ]);
    expect(reporteDelDia(TODO, '2026-10-07').turnos).toEqual([]);
  });

  it('sale en CSV para Excel: punto y coma, BOM, una fila por turno y el total', () => {
    const csv = csvDelReporte(reporteDelDia(TODO, '2026-10-06'));
    expect(csv.startsWith('﻿')).toBe(true);
    const [cabecera, a, b, total] = csv.slice(1).trimEnd().split('\r\n');
    expect(cabecera).toBe(COLUMNAS_DEL_REPORTE.join(';'));
    expect(a).toBe(
      '2026-10-06;A;T-002;Ana;06:00;21:30;1;1;30000;0;0;0;0;100000;130000;129600;-400;cambio mal dado;0;1',
    );
    expect(b).toBe('2026-10-06;B;T-001;Beto;18:00;abierto;0;0;0;0;0;0;0;50000;50000;;;;1;0');
    expect(total).toBe('2026-10-06;;total parcial;;;;1;1;30000;0;0;0;0;;;;-400;;1;1');
  });

  it('❌ un operador con fórmula no corre en Excel', () => {
    const apertura = reg('turno_apertura', 'caja-x', '2026-10-06T12:00:00.000Z', {
      base: 0,
      operador: '=HYPERLINK("x")',
    });
    const csv = csvDelReporte(reporteDelDia([apertura], '2026-10-06'));
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
