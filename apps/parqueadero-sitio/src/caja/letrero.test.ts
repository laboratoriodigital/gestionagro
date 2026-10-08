/**
 * El aviso de tarifas y derechos (HU-Q11.3): sale de los datos de la sede (CA1) y no sale sin los
 * datos legales completos (CA3 ❌). Con Ensayo Uno, con póliza, y Ensayo Dos, sin ella (P4).
 */
import { lineasDeTarifa } from '@ed1/parqueadero-recibos';
import {
  AJUSTE_ENSAYO,
  SEDE_ENSAYO_DOS,
  SEDE_ENSAYO_UNO,
  TARIFA_CARRO,
  TARIFA_MOTO,
} from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import plantilla from '../../../../content/parqueadero/aviso-tarifas.json' with { type: 'json' };
import { LETRA_MINIMA, letraQueCabe, letreroDeLaSede } from './letrero.ts';

const UNO = { sede: SEDE_ENSAYO_UNO, tarifas: [TARIFA_MOTO, TARIFA_CARRO], ajuste: AJUSTE_ENSAYO };

const armado = (r: ReturnType<typeof letreroDeLaSede>) => {
  if (!r.ok) throw new Error(`Faltan: ${r.faltan.join(', ')}`);
  return r.letrero;
};

describe('CA1 · el letrero sale de los datos de la sede', () => {
  it('Ensayo Uno: datos legales, tarifas como en el recibo, medios marcados, póliza y derechos', () => {
    const l = armado(letreroDeLaSede(UNO, ['transferencia', 'efectivo']));
    expect(l.sede).toEqual({
      nombre: 'Parqueadero Ensayo Uno',
      lineas: ['NIT 900.000.000-0', 'Calle 1 # 2-3, Bogotá', 'Teléfono 3000000000'],
    });
    expect(l.pie).toBe('Lunes a viernes 5:30 a 20:00');
    // El orden es el de los vehículos, no el del almacén.
    expect(l.tarifas.vehiculos.map((v) => v.nombre)).toEqual(['Carro', 'Moto']);
    expect(l.tarifas.vehiculos[0]?.lineas).toEqual([
      'Tarifa: $230 por minuto',
      'Gracia: 5 min',
      'Tope por día: $30.000',
      'Tope legal: $230 por minuto',
      'Tiquete perdido: $5.000',
    ]);
    // Las mismas líneas que el recibo de entrada (ADR-33), más el tiquete perdido.
    expect(l.tarifas.vehiculos[1]?.lineas.slice(0, -1)).toEqual(lineasDeTarifa(TARIFA_MOTO));
    expect(l.medios.lista).toEqual(['Efectivo', 'QR o transferencia']);
    expect(l.poliza).toBe('Póliza de responsabilidad: Aseguradora 0000000');
    expect(l.derechos.lista).toEqual(plantilla.derechos);
    expect(l.whatsapp).toBe('Pida su recibo por WhatsApp.');
    expect(l.responsabilidad).toContain('Ley 1480');
  });

  it('Ensayo Dos: sin póliza no hay línea de póliza, y el texto de responsabilidad es el suyo', () => {
    const propio = 'Pasados 45 días el parqueadero no responde por el vehículo.';
    const l = armado(
      letreroDeLaSede(
        {
          sede: SEDE_ENSAYO_DOS,
          tarifas: [{ ...TARIFA_CARRO, perdido: null }],
          ajuste: { ...AJUSTE_ENSAYO, pie: null, responsabilidad: propio },
        },
        ['datafono'],
      ),
    );
    expect(l.poliza).toBe(null);
    expect(l.pie).toBe(null);
    expect(l.responsabilidad).toBe(propio);
    expect(l.medios.lista).toEqual(['Datáfono']);
    expect(l.tarifas.vehiculos).toHaveLength(1);
    expect(l.tarifas.vehiculos[0]?.lineas.join(' ')).not.toContain('perdido');
  });
});

describe('CA3 ❌ · sin los datos legales completos no se genera', () => {
  it.each([
    ['sin sede', { ...UNO, sede: null }, 'el nombre'],
    ['sin NIT', { ...UNO, sede: { ...SEDE_ENSAYO_UNO, nit: ' ' } }, 'el NIT'],
    [
      'sin decir si hay póliza',
      { ...UNO, sede: { ...SEDE_ENSAYO_UNO, poliza: undefined } },
      'la póliza',
    ],
    ['sin ninguna tarifa', { ...UNO, tarifas: [] }, 'la tarifa de carro'],
  ] as const)('%s dice qué falta, como «Nueva entrada»', (_, ajustes, falta) => {
    const r = letreroDeLaSede(ajustes as Parameters<typeof letreroDeLaSede>[0], ['efectivo']);
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.faltan).toContain(falta);
  });
});

describe('una sola hoja: la letra baja si el aviso no cabe', () => {
  it('si cabe, la letra de siempre', () => {
    expect(letraQueCabe(14, 900, 900)).toBe(14);
  });

  it('si no cabe, baja en proporción, en medios puntos', () => {
    // 1.000 px en 900: 14 × 0,9 = 12,6 → 12,5.
    expect(letraQueCabe(14, 1_000, 900)).toBe(12.5);
    // Apenas pasado: baja medio punto, no se queda igual.
    expect(letraQueCabe(14, 901, 900)).toBe(13.5);
  });

  it('nunca baja de la letra mínima', () => {
    expect(letraQueCabe(14, 10_000, 900)).toBe(LETRA_MINIMA);
  });
});
