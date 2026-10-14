/**
 * Las horas de reloj (HU-Q13.1) y la tarifa de domingos y festivos (HU-Q13.2) en lo que se lee:
 * el papel, el mensaje y la pantalla salen del mismo recibo.
 */
import { TARIFA_CARRO } from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { conceptoDeLinea, fechaHora, lineasDeTarifa, soloHora } from './recibo.ts';

/** Un instante de Bogotá (UTC−5) en milisegundos. */
const bogota = (h: number, m: number) => Date.UTC(2026, 9, 12, h + 5, m);

describe('las horas, militares o de reloj (HU-Q13.1)', () => {
  it('militares por omisión, como siempre', () => {
    expect(soloHora(bogota(18, 5))).toBe('18:05');
    expect(fechaHora(bogota(7, 0))).toBe('12/10/2026 07:00');
  });

  it('de reloj: la medianoche y el mediodía son las 12, con «a. m.» y «p. m.»', () => {
    expect(soloHora(bogota(0, 5), -300, true)).toBe('12:05 a. m.');
    expect(soloHora(bogota(11, 59), -300, true)).toBe('11:59 a. m.');
    expect(soloHora(bogota(12, 0), -300, true)).toBe('12:00 p. m.');
    expect(soloHora(bogota(18, 5), -300, true)).toBe('6:05 p. m.');
    expect(fechaHora(bogota(18, 5), -300, true)).toBe('12/10/2026 6:05 p. m.');
  });
});

describe('la tarifa de domingos y festivos en el recibo (HU-Q13.2)', () => {
  const t = {
    ...TARIFA_CARRO,
    modo: 'minuto' as const,
    valor: 100,
    festivo: { valor: 150, plena: { desde_min: 240, valor: 20_000 } },
  };

  it('las líneas de la tarifa dicen el valor y la plena de festivo', () => {
    const lineas = lineasDeTarifa(t);
    expect(lineas).toContain('Domingos y festivos: $150 por minuto');
    expect(lineas).toContain('Domingo o festivo, desde 241 min: $20.000');
  });

  it('❌ sin tarifa de festivo, el recibo no la nombra', () => {
    expect(lineasDeTarifa({ ...t, festivo: undefined }).join(' ')).not.toContain('festivo');
  });

  it('las líneas de la liquidación dicen cuándo hubo domingo o festivo', () => {
    const linea = { minutos: 30, base: 4_500, valor: 4_500 };
    expect(conceptoDeLinea({ ...linea, concepto: 'tiempo_festivo' }, t)).toBe(
      'Por 30 min, con domingo o festivo',
    );
    expect(conceptoDeLinea({ ...linea, concepto: 'plena_festivo' }, t)).toBe(
      'Tarifa plena de domingo o festivo',
    );
  });
});
