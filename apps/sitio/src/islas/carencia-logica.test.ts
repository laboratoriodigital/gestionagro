import { afterEach, describe, expect, it } from 'vitest';
import { ahoraEnColombia, calcularCarencia, type EntradasCarencia } from './carencia-logica.ts';

const con = (e: Partial<EntradasCarencia>): EntradasCarencia => ({
  fecha: '2026-12-10',
  hora: '07:00',
  carencia: '',
  reentrada: '',
  ...e,
});

describe('calculadora de carencia y reentrada (HU-E10.1)', () => {
  it('CA1: el 10/12 a las 7:00 con 3 días y 12 h → cosechar desde el 13/12, entrar desde el 10/12/2026 19:00', () => {
    const r = calcularCarencia(con({ carencia: '3', reentrada: '12' }));
    expect(r.cosechar).toEqual({ tipo: 'fecha', texto: '13/12', valor: '2026-12-13' });
    expect(r.entrar).toMatchObject({ tipo: 'fecha', texto: '10/12/2026 19:00' });
    expect(r.errores).toEqual({});
  });

  it('CA2: vacío no es cero: dice «desconocida» y no da fecha (P1)', () => {
    const r = calcularCarencia(con({}));
    expect(r.cosechar).toEqual({ tipo: 'desconocida' });
    expect(r.entrar).toEqual({ tipo: 'desconocida' });
  });

  it('control negativo: 0 escrito sí es 0, el mismo día y la misma hora', () => {
    const r = calcularCarencia(con({ carencia: '0', reentrada: '0' }));
    expect(r.cosechar).toMatchObject({ texto: '10/12' });
    expect(r.entrar).toMatchObject({ texto: '10/12/2026 07:00' });
  });

  it.each([
    ['carencia', '-3'],
    ['carencia', '2,5'],
    ['carencia', 'tres'],
    ['carencia', '400'],
    ['reentrada', '-1'],
    ['reentrada', '12,5'],
  ] as const)('CA2: %s «%s» se marca junto al campo, sin calcular', (campo, valor) => {
    const r = calcularCarencia(con({ [campo]: valor }));
    expect(r.errores[campo]).toBeTruthy();
    expect(r[campo === 'carencia' ? 'cosechar' : 'entrar'].tipo).toBe('espera');
  });

  it.each([
    ['fin de mes', '2027-01-30', '22:00', '3', '4', '02/02', '31/01/2027 02:00'],
    ['cambio de año', '2026-12-31', '23:30', '1', '1', '01/01', '01/01/2027 00:30'],
    ['29 de febrero', '2028-02-28', '20:00', '1', '6', '29/02', '29/02/2028 02:00'],
    ['año no bisiesto', '2027-02-28', '08:00', '1', '24', '01/03', '01/03/2027 08:00'],
  ])('CA4: %s', (_c, fecha, hora, carencia, reentrada, cosechar, entrar) => {
    const r = calcularCarencia({ fecha, hora, carencia, reentrada });
    expect(r.cosechar).toMatchObject({ texto: cosechar });
    expect(r.entrar).toMatchObject({ texto: entrar });
  });

  describe('CA4: con el teléfono en otro huso, las fechas son las de Colombia (P8)', () => {
    const tz = process.env['TZ'];
    afterEach(() => {
      if (tz === undefined) delete process.env['TZ'];
      else process.env['TZ'] = tz;
    });

    it.each(['Asia/Tokyo', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'])('%s', (zona) => {
      process.env['TZ'] = zona;
      const r = calcularCarencia(con({ carencia: '3', reentrada: '12' }));
      expect(r.cosechar).toMatchObject({ texto: '13/12' });
      expect(r.entrar).toMatchObject({ texto: '10/12/2026 19:00' });
      // 23:30 del 31/12 en Colombia ya es 1/1 en UTC: el día por defecto es el de Colombia.
      expect(ahoraEnColombia(Date.parse('2027-01-01T04:30:00Z'))).toEqual({
        fecha: '2026-12-31',
        hora: '23:30',
      });
    });
  });
});
