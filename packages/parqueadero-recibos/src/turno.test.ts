import type { Registro } from '@ed1/parqueadero-schema';
import { ENTRADA_ENSAYO, SALIDA_ENSAYO } from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { lineasDePapel } from './papel.ts';
import { numeroDeTurno, papelDelCierre, resumirTurno } from './turno.ts';

const comun = {
  org_id: null,
  v: 1,
  fecha_local: '2026-10-06',
  autor_usuario_id: null,
  dispositivo_id: 'caja-ensayo-1',
  origen: 'manual',
  anula_id: null,
  estadia_id: null,
  serie: null,
  consecutivo: null,
} as const;

let n = 0;
const reg = (tipo: Registro['tipo'], datos: object, extra: Partial<Registro> = {}): Registro => ({
  ...comun,
  id: `0199bc3e-0000-7000-8000-${String(++n).padStart(12, '0')}`,
  tipo,
  instante_evento: '2026-10-06T23:30:00.000Z',
  datos,
  ...extra,
});

const APERTURA = reg(
  'turno_apertura',
  { base: 100_000, operador: 'Caja 1' },
  {
    instante_evento: '2026-10-06T11:00:00.000Z',
  },
);

const entrega = (recibo: Registro, canal: string, extra: object = {}) =>
  reg('entrega_recibo', {
    recibo_id: recibo.id,
    canal,
    copia: false,
    resultado: 'enviado',
    ...extra,
  });

/** Una segunda estadía, cobrada con QR y después anulada por cobrar mal. */
const OTRA_ENTRADA = {
  ...ENTRADA_ENSAYO,
  id: '0199bc3e-3b40-7000-8000-000000000201',
  consecutivo: 125,
};
const OTRA_SALIDA: Registro = {
  ...SALIDA_ENSAYO,
  id: '0199bcf1-5a80-7000-8000-000000000202',
  estadia_id: OTRA_ENTRADA.id,
  consecutivo: 126,
  datos: {
    ...(SALIDA_ENSAYO.datos as object),
    medio_pago: 'transferencia',
    recibido: null,
    cambio: null,
  },
};

const TURNO: Registro[] = [
  ENTRADA_ENSAYO,
  entrega(ENTRADA_ENSAYO, 'papel'),
  entrega(ENTRADA_ENSAYO, 'papel', { copia: true }),
  SALIDA_ENSAYO,
  entrega(SALIDA_ENSAYO, 'whatsapp', { resultado: 'abierto', autorizado: true }),
  OTRA_ENTRADA,
  entrega(OTRA_ENTRADA, 'papel'),
  entrega(OTRA_ENTRADA, 'papel', { resultado: 'fallido' }),
  entrega(OTRA_ENTRADA, 'pantalla', { resultado: 'confirmado' }),
  OTRA_SALIDA,
  reg(
    'anulacion',
    { motivo: 'cobró con QR y era efectivo', operador: 'Caja 1' },
    {
      anula_id: OTRA_SALIDA.id,
      estadia_id: OTRA_ENTRADA.id,
    },
  ),
  reg('movimiento_caja', {
    clase: 'gasto',
    valor: 4_000,
    concepto: 'bolsas',
    turno_id: APERTURA.id,
  }),
  reg('movimiento_caja', {
    clase: 'ingreso',
    valor: 2_000,
    concepto: 'sencillo',
    turno_id: APERTURA.id,
  }),
];

describe('el resumen del turno (HU-Q3.9)', () => {
  const r = resumirTurno(APERTURA, TURNO, 12);

  it('cuenta lo vigente, deja fuera lo anulado y cuenta la anulación (HU-Q3.7 CA2)', () => {
    expect(r).toMatchObject({ numero: 'T-012', operador: 'Caja 1', entradas: 2, salidas: 1 });
    expect(r.anulaciones).toBe(1);
    expect(r.anulacionesPorOperador).toEqual({ 'Caja 1': 1 });
    expect(r.porMedio).toEqual({ efectivo: 30_000 });
  });

  it('lo esperado es base + efectivo + ingresos − gastos', () => {
    expect(r.esperado).toBe(100_000 + 30_000 + 2_000 - 4_000);
  });

  it('cada recibo cuenta una vez, por el mejor camino; «No salió» no es papel', () => {
    expect(r.copias).toBe(1);
    expect(r.entregas).toEqual({ recibos: 3, papel: 1, whatsapp: 1, pantalla: 1, sinEntrega: 0 });
  });

  it('el número del turno lleva tres cifras', () => {
    expect(numeroDeTurno(7)).toBe('T-007');
  });
});

describe('el cierre impreso (HU-Q3.9 CA2)', () => {
  const datos = {
    nombreDeLaSede: 'Parqueadero Ensayo Uno',
    serie: 'A',
    cerro: Date.parse('2026-10-06T19:00:00.000Z'),
    abiertas: 1,
    contado: 123_700,
    motivo: 'cambio mal dado',
    version: '0.0.0',
  };

  it('dice lo de la maqueta del anexo B, sin pasar de 32 columnas', () => {
    const lineas = lineasDePapel(
      papelDelCierre(resumirTurno(APERTURA, TURNO, 12), datos, {
        columnas: 32,
        paginaDeCodigos: 'transliterar',
      }),
      32,
    );
    for (const l of lineas) expect(l.length, l).toBeLessThanOrEqual(32);
    const todo = lineas.join('\n');
    expect(todo).toContain('CIERRE DE TURNO            T-012');
    expect(todo).toMatch(/Abrio +06\/10\/2026 06:00/);
    expect(todo).toMatch(/Cerro +06\/10\/2026 14:00/);
    expect(todo).toMatch(/Anulaciones +1/);
    expect(todo).toMatch(/Efectivo +\$30\.000/);
    expect(todo).toMatch(/Efectivo esperado +\$128\.000/);
    expect(todo).toMatch(/Diferencia +-\$4\.300/);
    expect(todo).toContain('Motivo: cambio mal dado');
    expect(todo).toContain('Papel ahorrado: 2 recibos');
    expect(todo).toContain('Caja 0.0.0');
  });

  it('con anulaciones de dos operadores, dice las de cada uno', () => {
    const otra = reg(
      'anulacion',
      { motivo: 'error', operador: 'Ana' },
      { anula_id: ENTRADA_ENSAYO.id },
    );
    const lineas = lineasDePapel(
      papelDelCierre(resumirTurno(APERTURA, [...TURNO, otra], 1), datos, {
        columnas: 32,
        paginaDeCodigos: 'cp850',
      }),
      32,
    ).join('\n');
    expect(lineas).toMatch(/ {2}Caja 1 +1/);
    expect(lineas).toMatch(/ {2}Ana +1/);
  });
});
