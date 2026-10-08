/**
 * El recibo del generador gratuito (HU-Q11.4): el mismo modelo y las mismas salidas que la caja,
 * con el número del talonario y un pie que dice de dónde salió. Control negativo (CA3): no se
 * puede leer como un recibo de caja, y sin un dato legal no sale.
 */
import { describe, expect, it } from 'vitest';
import {
  type DatosDelGenerador,
  EnlaceInvalido,
  enlaceCompleto,
  leerEnlace,
  PIE_DEL_GENERADOR,
  pantalla,
  papel,
  ReciboIncompleto,
  reciboDelGenerador,
  textoWhatsApp,
} from './index.ts';

const DATOS: DatosDelGenerador = {
  sede: {
    nombre: 'Parqueadero Ensayo Tres',
    nit: '900123456-1',
    direccion: 'Calle 1 # 2-3',
    ciudad: 'Tunja',
    telefono: '310 000 0000',
    poliza: null,
  },
  numero: '0457',
  placa: 'abc 123',
  vehiculo: 'carro',
  entrada: Date.UTC(2026, 9, 8, 14, 30, 12, 345),
  estado: ['rayón puerta derecha', ' '],
  tarifa: { modo: 'minuto', valor: 70, fraccion_min: 99 },
};

describe('el recibo del generador (HU-Q11.4)', () => {
  it('es un recibo de entrada con los datos del parqueadero y el número de su talonario', () => {
    const r = reciboDelGenerador(DATOS);
    expect(r).toMatchObject({
      clase: 'entrada',
      numero: '0457',
      placa: 'ABC123',
      entrada: Date.UTC(2026, 9, 8, 14, 30, 12),
      estado: ['rayón puerta derecha'],
      tarifa: { modo: 'minuto', valor: 70, fraccion_min: null, gracia_min: 0 },
      pie: PIE_DEL_GENERADOR,
      prueba: false,
    });
    expect(pantalla(r).titulo).toBe('Recibo de entrada 0457');
  });

  it('la hoja, el papel y el WhatsApp dicen que salió del generador (CA3)', () => {
    const r = reciboDelGenerador(DATOS);
    const texto = textoWhatsApp(r, null);
    expect(texto).toContain(PIE_DEL_GENERADOR);
    expect(texto).not.toContain('Su recibo:');
    expect(texto).not.toContain('/r/');
    expect(
      JSON.stringify(papel(r, { columnas: 32, paginaDeCodigos: 'cp850', qr: null })),
    ).toContain('generador gratuito');
  });

  it('por fracción lleva sus minutos', () => {
    const r = reciboDelGenerador({
      ...DATOS,
      tarifa: { modo: 'fraccion', valor: 1000, fraccion_min: 15 },
    });
    expect(pantalla(r).grupos.flat()).toContainEqual(['Tarifa', '$1.000 cada 15 min']);
  });

  it('❌ no se confunde con un recibo de caja: sin serie, no hay enlace que lo lea como tal', async () => {
    const r = reciboDelGenerador(DATOS);
    expect(r.numero).not.toMatch(/^[A-Z0-9]{1,3}-/);
    await expect(async () => leerEnlace(await enlaceCompleto(r))).rejects.toBeInstanceOf(
      EnlaceInvalido,
    );
  });

  it('❌ sin un dato legal, el número, la placa o la tarifa no sale, y dice qué falta', () => {
    const incompleto = {
      ...DATOS,
      sede: { nombre: 'Parqueadero Ensayo Tres' },
      numero: 'A-12',
      placa: '',
      tarifa: { modo: 'fraccion', valor: 1000, fraccion_min: null },
    } as const;
    try {
      reciboDelGenerador(incompleto);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ReciboIncompleto);
      expect((e as ReciboIncompleto).faltan).toEqual([
        'el NIT',
        'la dirección',
        'la ciudad',
        'el teléfono',
        'el número del recibo',
        'la placa',
        'la tarifa',
      ]);
    }
    expect(() => reciboDelGenerador({ ...DATOS, tarifa: { ...DATOS.tarifa, valor: 0 } })).toThrow(
      ReciboIncompleto,
    );
  });
});
