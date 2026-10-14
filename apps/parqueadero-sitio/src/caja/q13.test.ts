/**
 * Sprint Q13 en la caja: la hora militar o de reloj (HU-Q13.1), la tarifa de domingos y festivos
 * en Ajustes (HU-Q13.2) y la mensualidad por días hábiles (HU-Q13.3).
 */
import type { Abonado } from '@ed1/parqueadero-schema';
import { afterEach, describe, expect, it } from 'vitest';
import { borradorVacio, leerBorrador } from './Ajustes.tsx';
import { periodoPorCobrar } from './abonados.ts';
import { horaBogota, ponerHora12 } from './fecha.ts';

afterEach(() => ponerHora12(false));

describe('la hora en las pantallas (HU-Q13.1)', () => {
  const tarde = Date.UTC(2026, 9, 13, 23, 5); // 18:05 de Bogotá
  it('militar por omisión, y de reloj si la sede lo eligió', () => {
    expect(horaBogota(tarde)).toBe('18:05');
    ponerHora12(true);
    expect(horaBogota(tarde)).toBe('6:05 p. m.');
    expect(horaBogota(Date.UTC(2026, 9, 13, 5, 0))).toBe('12:00 a. m.');
  });
});

/** Un borrador con la sede llena y la tarifa del carro, para leerlo como lo guarda Ajustes. */
function borrador(tarifa: Record<string, string>) {
  const b = borradorVacio();
  Object.assign(b, {
    nombre: 'Parqueadero Ensayo',
    nit: '900.000.000-0',
    direccion: 'Calle 1 # 2-3',
    ciudad: 'Medellín',
    telefono: '3000000000',
    poliza: 'no',
    imprimir: 'siempre',
    pin: '2468',
    pin2: '2468',
  });
  b.tarifas['carro'] = {
    ...(b.tarifas['carro'] as Record<string, string>),
    valor: '100',
    tope: '130',
    gracia: '5',
    redondeo: 'ninguno',
    ...tarifa,
  } as never;
  return b;
}

describe('la tarifa de domingos y festivos en Ajustes (HU-Q13.2)', () => {
  const ahora = '2026-10-13T15:00:00.000Z';

  it('es opcional: sin ella, la tarifa no la lleva', () => {
    const { errores, tarifas } = leerBorrador(borrador({}), false, ahora);
    expect(errores).toEqual({});
    expect(tarifas[0]?.festivo).toBeUndefined();
  });

  it('con el valor y el día completo, los guarda con los minutos del día completo', () => {
    const { errores, tarifas } = leerBorrador(
      borrador({
        plenaDesde: '240',
        plenaValor: '15.000',
        festivoValor: '120',
        festivoPlena: '20.000',
      }),
      false,
      ahora,
    );
    expect(errores).toEqual({});
    expect(tarifas[0]?.festivo).toEqual({
      valor: 120,
      plena: { desde_min: 240, valor: 20_000 },
    });
    expect(tarifas[0]?.plena).toEqual({ desde_min: 240, valor: 15_000 });
  });

  it('❌ el día completo de festivo pide desde cuántos minutos y su valor por minuto', () => {
    const { errores } = leerBorrador(borrador({ festivoPlena: '20.000' }), false, ahora);
    expect(Object.keys(errores).sort()).toEqual([
      'tarifa-carro-festivoValor',
      'tarifa-carro-plenaDesde',
    ]);
  });

  it('❌ un valor de festivo por encima del tope por minuto no se guarda', () => {
    const { errores } = leerBorrador(borrador({ festivoValor: '200' }), false, ahora);
    expect(errores['tarifa-carro-festivoValor']).toContain('pasa el tope');
  });
});

describe('la mensualidad por días hábiles (HU-Q13.3)', () => {
  const a: Abonado = {
    id: '0192e9a0-0000-7000-8000-000000000001',
    org_id: null,
    version: 1,
    actualizado: '2026-10-01T05:00:00.000Z',
    entidad: 'abonado',
    placa: 'ABC12D',
    vehiculo: 'moto',
    referencia: null,
    desde: '2026-10-15',
    hasta: '2026-10-31',
    valor: 300_000,
    activo: true,
  };

  it('el primer pago, empezado el 15, cobra sus hábiles; por omisión, sus días calendario', () => {
    const calendario = periodoPorCobrar(a, '2026-10-15', { primero: true });
    const habiles = periodoPorCobrar(a, '2026-10-15', { primero: true, cuenta: 'habiles' });
    expect(calendario.valor).toBe(Math.floor((300_000 * 17) / 31 / 100) * 100);
    expect(habiles.valor).not.toBe(calendario.valor);
    expect([habiles.desde, habiles.hasta]).toEqual(['2026-10-15', '2026-10-31']);
  });
});
