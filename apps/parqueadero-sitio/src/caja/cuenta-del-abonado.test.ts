/**
 * HU-Q13.5: quién debe y quién está al día, y qué se cobra después de «No cobrar ahora». Antes la
 * caja daba por pagada la vigencia del catálogo y cobraba el periodo siguiente: otra fecha y otro
 * valor (bitácora 40).
 */
import type { Abonado } from '@ed1/parqueadero-schema';
import { describe, expect, it } from 'vitest';
import { cuentaDelAbonado, pagadoHastaDe, periodoPorCobrar } from './abonados.ts';

function abonado(cambios: Partial<Abonado> = {}): Abonado {
  return {
    id: '0192e9a0-0000-7000-8000-000000000001',
    org_id: null,
    version: 1,
    actualizado: '2026-10-20T17:00:00.000Z',
    entidad: 'abonado',
    placa: 'JKL456',
    vehiculo: 'carro',
    referencia: null,
    desde: '2026-10-20',
    hasta: '2026-10-31',
    valor: 300_000,
    activo: true,
    ...cambios,
  };
}

describe('hasta dónde pagó cada abonado (HU-Q13.5)', () => {
  it('el pago que más lejos llega, por abonado; sin pagos, no aparece', () => {
    const m = pagadoHastaDe([
      { abonado_id: 'a', desde: '2026-11-01', hasta: '2026-11-30' },
      { abonado_id: 'a', desde: '2026-10-20', hasta: '2026-10-31' },
      { abonado_id: 'b', desde: '2026-10-01', hasta: '2026-10-15' },
    ]);
    expect([...m.entries()]).toEqual([
      ['a', '2026-11-30'],
      ['b', '2026-10-15'],
    ]);
    expect(m.has('c')).toBe(false);
  });
});

describe('la cuenta de un abonado (HU-Q13.5)', () => {
  it('sin pagos en la caja y con la vigencia corriendo, debe desde que empezó', () => {
    expect(cuentaDelAbonado(abonado(), null, '2026-10-20')).toEqual({
      es: 'debe',
      desde: '2026-10-20',
      hasta: '2026-10-31',
    });
  });

  it('pagado hasta el fin de la vigencia, al día; pagado una parte, debe desde el día siguiente', () => {
    expect(cuentaDelAbonado(abonado(), '2026-10-31', '2026-10-28')).toEqual({
      es: 'al-dia',
      hasta: '2026-10-31',
    });
    expect(cuentaDelAbonado(abonado({ hasta: '2026-11-30' }), '2026-10-31', '2026-10-28')).toEqual({
      es: 'debe',
      desde: '2026-11-01',
      hasta: '2026-11-30',
    });
  });

  it('❌ vencido, o inactivo, no se confunde con al día', () => {
    expect(cuentaDelAbonado(abonado(), '2026-10-31', '2026-11-02')).toEqual({
      es: 'vencido',
      hasta: '2026-10-31',
    });
    expect(cuentaDelAbonado(abonado({ activo: false }), '2026-10-31', '2026-10-28')).toEqual({
      es: 'inactivo',
    });
  });
});

describe('lo que se cobra con lo pagado en la caja (HU-Q13.5)', () => {
  it('después de «No cobrar ahora», cobra lo que falta de la vigencia, no el mes siguiente', () => {
    expect(periodoPorCobrar(abonado(), '2026-10-28', { pagadoHasta: null })).toEqual({
      desde: '2026-10-20',
      hasta: '2026-10-31',
      valor: 116_100,
    });
  });

  it('con la vigencia pagada, sigue el periodo siguiente entero', () => {
    expect(periodoPorCobrar(abonado(), '2026-10-28', { pagadoHasta: '2026-10-31' })).toEqual({
      desde: '2026-11-01',
      hasta: '2026-11-30',
      valor: 300_000,
    });
  });

  it('pagada una parte, cobra desde el día siguiente a lo pagado', () => {
    const a = abonado({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(periodoPorCobrar(a, '2026-10-20', { pagadoHasta: '2026-10-15' })).toEqual({
      desde: '2026-10-16',
      hasta: '2026-10-31',
      // 16 de los 31 días del mes que empieza el 16.
      valor: Math.floor((300_000 * 16) / 31 / 100) * 100,
    });
  });

  it('❌ vencida y sin pagar, no cobra el pasado: empieza hoy', () => {
    expect(periodoPorCobrar(abonado(), '2026-11-05', { pagadoHasta: null })).toEqual({
      desde: '2026-11-05',
      hasta: '2026-12-04',
      valor: 300_000,
    });
  });
});
