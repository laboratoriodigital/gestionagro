import type { Registro } from '@ed1/parqueadero-schema';
import { ENTRADA_ENSAYO } from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { ahorroDelPeriodo, periodosDelAhorro } from './ahorro.ts';
import { entregasDeLosRecibos } from './entregas.ts';

let n = 0;
const entrega = (
  de: Registro,
  canal: string,
  resultado: string,
  extra: { copia?: boolean; fecha?: string } = {},
): Registro => ({
  ...ENTRADA_ENSAYO,
  id: `0199bc3e-0000-7000-8000-${String(++n).padStart(12, '0')}`,
  tipo: 'entrega_recibo',
  serie: null,
  consecutivo: null,
  fecha_local: extra.fecha ?? '2026-10-06',
  instante_evento: `2026-10-06T23:${String(10 + n).padStart(2, '0')}:00.000Z`,
  datos: { recibo_id: de.id, canal, copia: extra.copia ?? false, resultado },
});

const recibo = (consecutivo: number, fecha = '2026-10-06'): Registro => ({
  ...ENTRADA_ENSAYO,
  id: `0199bc3e-3b40-7000-8000-${String(consecutivo).padStart(12, '0')}`,
  estadia_id: `0199bc3e-3b40-7000-8000-${String(consecutivo).padStart(12, '0')}`,
  consecutivo,
  fecha_local: fecha,
});

const PAPEL = recibo(1);
const WHATSAPP = recibo(2);
const PANTALLA = recibo(3);
const NO_SE_ENVIO = recibo(4);
const AYER = recibo(5, '2026-10-05');

const REGISTROS: Registro[] = [
  PAPEL,
  entrega(PAPEL, 'papel', 'enviado'),
  entrega(PAPEL, 'papel', 'enviado', { copia: true }),
  WHATSAPP,
  entrega(WHATSAPP, 'whatsapp', 'abierto'),
  PANTALLA,
  entrega(PANTALLA, 'pantalla', 'confirmado'),
  // Abierto en WhatsApp, y el operador dijo «No se envió»: salió en papel.
  NO_SE_ENVIO,
  entrega(NO_SE_ENVIO, 'whatsapp', 'abierto'),
  entrega(NO_SE_ENVIO, 'whatsapp', 'no_enviado'),
  entrega(NO_SE_ENVIO, 'papel', 'enviado'),
  AYER,
  entrega(AYER, 'whatsapp', 'abierto', { fecha: '2026-10-05' }),
];

describe('lo que ahorra el parqueadero (HU-Q8.6)', () => {
  it('cuenta cada recibo una vez por su mejor canal, y el papel que no se gastó', () => {
    const a = ahorroDelPeriodo(REGISTROS, '2026-10-06', '2026-10-06', 13);
    expect(a).toMatchObject({
      recibos: 4,
      papel: 2,
      whatsapp: 1,
      pantalla: 1,
      sinEntrega: 0,
      sinPapel: 2,
      pesos: 26,
    });
  });

  it('❌ un WhatsApp marcado «No se envió» no cuenta como digital (CA3)', () => {
    const sinPapel = [NO_SE_ENVIO, ...REGISTROS.filter((r) => r.estadia_id === NO_SE_ENVIO.id)];
    const conLoQueHubo = sinPapel.filter(
      (r) => !(r.tipo === 'entrega_recibo' && (r.datos as { canal: string }).canal === 'papel'),
    );
    expect(entregasDeLosRecibos(conLoQueHubo).canalDe(NO_SE_ENVIO.id)).toBe('sin_entrega');
    expect(ahorroDelPeriodo(conLoQueHubo, '2026-10-06', '2026-10-06', 13).whatsapp).toBe(0);
  });

  it('❌ sin el costo de la sede no hay pesos: nulo, nunca $0 (P1)', () => {
    expect(ahorroDelPeriodo(REGISTROS, '2026-10-06', '2026-10-06', null).pesos).toBeNull();
  });

  it('las entregas anotadas son las que cuentan los eventos, también el WhatsApp desmentido', () => {
    expect(ahorroDelPeriodo(REGISTROS, '2026-10-05', '2026-10-06', 13).anotadas).toEqual({
      papel: 2,
      copia: 1,
      whatsapp: 3,
      pantalla: 1,
    });
  });

  it('un recibo anulado no cuenta', () => {
    const anulacion: Registro = {
      ...entrega(WHATSAPP, 'whatsapp', 'abierto'),
      tipo: 'anulacion',
      anula_id: WHATSAPP.id,
      datos: { motivo: 'placa equivocada', operador: 'Ana' },
    };
    const a = ahorroDelPeriodo([...REGISTROS, anulacion], '2026-10-06', '2026-10-06', 13);
    expect(a.recibos).toBe(3);
    expect(a.whatsapp).toBe(0);
  });

  it('las semanas van de lunes a domingo, y los meses del 1 al último', () => {
    // El 6 de octubre de 2026 es martes.
    expect(periodosDelAhorro('2026-10-06')).toEqual([
      { nombre: 'Esta semana', desde: '2026-10-05', hasta: '2026-10-06' },
      { nombre: 'Semana pasada', desde: '2026-09-28', hasta: '2026-10-04' },
      { nombre: 'Este mes', desde: '2026-10-01', hasta: '2026-10-06' },
      { nombre: 'Mes pasado', desde: '2026-09-01', hasta: '2026-09-30' },
    ]);
    expect(periodosDelAhorro('2026-03-01')[3]).toEqual({
      nombre: 'Mes pasado',
      desde: '2026-02-01',
      hasta: '2026-02-28',
    });
    // Un domingo es el último día de su semana.
    expect(periodosDelAhorro('2026-10-11')[0]?.desde).toBe('2026-10-05');
  });
});
