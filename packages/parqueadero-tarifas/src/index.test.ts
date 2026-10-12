import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MontoIlegible } from '@ed1/dinero';
import { TARIFA_CARRO, TARIFA_MOTO } from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { bogota, CASOS } from './casos.fixture.ts';
import { liquidar, type ReglasDeTarifa, TarifaInvalida, validarTarifa } from './index.ts';

describe('la tabla de casos de PARQUEADERO §9.3 (HU-Q1.1 CA2)', () => {
  it.each(CASOS.map((c) => [c.nombre, c] as const))('%s', (_, c) => {
    const l = liquidar(
      c.entrada,
      c.salida,
      c.tarifa,
      c.tope,
      c.abonado ?? null,
      c.perdido ?? false,
    );
    expect(l.minutos).toBe(c.minutos);
    expect(l.total).toBe(c.total);
    expect(l.lineas.map((x) => x.concepto)).toEqual(c.conceptos);
    expect(l.subtotal - l.redondeo).toBe(l.total);
    expect(l.lineas.reduce((a, x) => a + x.valor, 0)).toBe(l.subtotal);
  });

  it('la noche se lleva exactamente su franja: 60 + 570 + 90 minutos', () => {
    const l = liquidar(bogota(2026, 10, 6, 19, 0), bogota(2026, 10, 7, 7, 0), TARIFA_MOTO, 161);
    expect(l.lineas.map((x) => x.minutos)).toEqual([60, 570, 90]);
  });

  it('con segundos en la entrada, la noche sigue en minutos enteros y nada se cuenta dos veces', () => {
    const l = liquidar(
      bogota(2026, 10, 6, 19, 0, 37),
      bogota(2026, 10, 7, 7, 0, 12),
      TARIFA_MOTO,
      161,
    );
    expect(l.minutos).toBe(720);
    expect(l.lineas.reduce((a, x) => a + x.minutos, 0)).toBe(720);
  });

  it('sin tope declarado lo dice', () => {
    const l = liquidar(0, 60_000, TARIFA_CARRO, null);
    expect(l.avisos).toContain('sin_tope');
  });

  it('una salida anterior a la entrada es un reloj corrido, no un cobro', () => {
    expect(() => liquidar(120_000, 60_000, TARIFA_CARRO, 230)).toThrow(
      'La salida es anterior a la entrada',
    );
  });
});

/** Un generador con semilla: la misma corrida siempre (P8). */
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (Math.imul(s, 1_664_525) + 1_013_904_223) >>> 0;
    return s / 2 ** 32;
  };
}

/** La regla 1 de §9.2 sobre `n` estadías de 1 minuto a 30 días. Devuelve las que la rompen. */
function violacionesDelTope(tarifa: ReglasDeTarifa, tope: number, n = 3_000): string[] {
  const r = azar(20261007);
  const malas: string[] = [];
  for (let i = 0; i < n; i++) {
    const entrada = bogota(2026, 1, 1, 0, 0) + Math.floor(r() * 400 * 86_400_000);
    // La mitad de las veces, minutos exactos; la otra mitad, con segundos.
    const minutos = 1 + Math.floor(r() * 30 * 1_440);
    const salida = entrada + minutos * 60_000 - (i % 2 ? Math.floor(r() * 59_000) : 0);
    const l = liquidar(entrada, salida, tarifa, tope);
    if (l.total > l.minutos * tope)
      malas.push(`${l.minutos} min: ${l.total} > ${l.minutos * tope}`);
  }
  return malas;
}

describe('propiedad: el total nunca pasa minutos × tope (§9.2 regla 1)', () => {
  it.each([
    ['carro por minuto con tope diario', TARIFA_CARRO, 230],
    ['moto con plena y noche', TARIFA_MOTO, 161],
    ['carro en el tope, sin tope diario', { ...TARIFA_CARRO, tope_dia: null }, 230],
    [
      'fracción de 15 minutos en el tope',
      { ...TARIFA_CARRO, modo: 'fraccion', fraccion_min: 15, tope_dia: null } as const,
      230,
    ],
    [
      'plena y noche en su máximo',
      {
        ...TARIFA_MOTO,
        plena: { desde_min: 180, valor: 181 * 161 },
        nocturna: { desde: '20:00', hasta: '05:30', valor: 570 * 161 },
      },
      161,
    ],
  ])('%s', (_, tarifa, tope) => {
    expect(violacionesDelTope(tarifa as ReglasDeTarifa, tope)).toEqual([]);
  });

  // HU-Q1.1 CA3 ❌: una tarifa por encima del tope pone en rojo la propiedad: no se liquida.
  it.each([
    ['un peso más por minuto', { ...TARIFA_CARRO, valor: 231 }, 230, 'valor'],
    [
      'una plena que pasa el tope',
      { ...TARIFA_MOTO, plena: { desde_min: 180, valor: 181 * 161 + 1 } },
      161,
      'plena.valor',
    ],
    [
      'una noche que pasa el tope',
      { ...TARIFA_MOTO, nocturna: { desde: '20:00', hasta: '05:30', valor: 570 * 161 + 1 } },
      161,
      'nocturna.valor',
    ],
    ['una hora de $1.000', { ...TARIFA_CARRO, modo: 'hora', valor: 1_000 }, 230, 'valor'],
  ] as const)('control: %s no se guarda ni se liquida', (_, tarifa, tope, campo) => {
    expect(validarTarifa(tarifa as ReglasDeTarifa, tope).map((p) => p.campo)).toContain(campo);
    expect(() => violacionesDelTope(tarifa as ReglasDeTarifa, tope)).toThrow(TarifaInvalida);
  });
});

describe('montos y redondeo (HU-Q1.1 CA3)', () => {
  it.each([
    ['valor', { ...TARIFA_CARRO, valor: 230.5 }],
    ['tope_dia', { ...TARIFA_CARRO, tope_dia: Number.NaN }],
    ['perdido', { ...TARIFA_CARRO, perdido: '5000' as unknown as number }],
    ['plena.valor', { ...TARIFA_MOTO, plena: { desde_min: 180, valor: -1 } }],
  ])('un monto ilegible en «%s» lanza MontoIlegible con su campo, nunca vale 0', (campo, t) => {
    try {
      liquidar(0, 600_000, t, 230);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(MontoIlegible);
      expect((e as MontoIlegible).campo).toBe(campo);
    }
  });

  it('el tiquete perdido sin valor configurado no se cobra como 0', () => {
    expect(() => liquidar(0, 600_000, { ...TARIFA_CARRO, perdido: null }, 230, null, true)).toThrow(
      'la tarifa no tiene valor del tiquete perdido',
    );
  });

  it('el redondeo solo baja', () => {
    for (let m = 1; m <= 200; m++) {
      const l = liquidar(0, m * 60_000, { ...TARIFA_MOTO, redondeo: 'abajo_100' }, 161);
      expect(l.total).toBeLessThanOrEqual(l.subtotal);
      expect(l.total % 100).toBe(0);
    }
  });
});

describe('el reloj de la máquina no cambia nada (P8, P17)', () => {
  const script = fileURLToPath(new URL('./husos.fixture.ts', import.meta.url));
  const correr = (tz: string) =>
    execFileSync(process.execPath, [script], { env: { ...process.env, TZ: tz }, encoding: 'utf8' });

  it('la tabla da lo mismo con TZ=America/Bogota, TZ=Pacific/Kiritimati y TZ=UTC', () => {
    const bogotaTz = correr('America/Bogota');
    expect(JSON.parse(bogotaTz)).toHaveLength(CASOS.length);
    expect(correr('Pacific/Kiritimati')).toBe(bogotaTz);
    expect(correr('UTC')).toBe(bogotaTz);
  });
});
