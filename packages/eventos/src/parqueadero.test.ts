import { describe, expect, it } from 'vitest';
import {
  armarLoteDeLaCaja,
  claveDeEvento,
  contar,
  descontar,
  EVENTOS_DE_LA_CAJA,
  leerClave,
  motivoDeRechazoDeLaCaja,
} from './index.ts';

describe('los eventos de la caja del parqueadero (HU-Q5.3)', () => {
  it('la lista es la de CA1, y cada evento vuelve de su clave', () => {
    expect(EVENTOS_DE_LA_CAJA).toEqual([
      'recibo.papel',
      'recibo.whatsapp',
      'recibo.pantalla',
      'recibo.copia',
      'impresion.fallida',
      'respaldo.hecho',
      'turno.cerrado',
    ]);
    const fallo = { evento: 'impresion.fallida', adaptador: 'bluetooth', causa: 'tiempo' } as const;
    expect(claveDeEvento(fallo)).toBe('impresion.fallida/bluetooth/tiempo');
    expect(leerClave('impresion.fallida/bluetooth/tiempo')).toEqual(fallo);
    expect(leerClave('recibo.papel')).toEqual({ evento: 'recibo.papel' });
  });

  it('una clave fuera de las listas no se lee (CA3)', () => {
    for (const clave of [
      'recibo.fax',
      'recibo.papel/ABC123',
      'impresion.fallida',
      'impresion.fallida/bluetooth',
      'impresion.fallida/paloma/tiempo',
      'impresion.fallida/bluetooth/se cayó',
      'impresion.fallida/bluetooth/tiempo/3001234567',
    ]) {
      expect(leerClave(clave), clave).toBeNull();
    }
  });

  it('cuenta, arma el lote y descuenta lo enviado sin perder lo que llegó mientras viajaba', () => {
    let c = contar({}, { evento: 'recibo.papel' });
    c = contar(c, { evento: 'recibo.papel' });
    c = contar(c, { evento: 'turno.cerrado' });
    const lote = armarLoteDeLaCaja(c);
    expect(lote).toEqual({
      v: 2,
      producto: 'parqueadero-caja',
      conteos: { 'recibo.papel': 2, 'turno.cerrado': 1 },
    });
    c = contar(c, { evento: 'recibo.papel' });
    expect(descontar(c, lote?.conteos ?? {})).toEqual({ 'recibo.papel': 1 });
    expect(armarLoteDeLaCaja({})).toBeNull();
  });

  it('un conteo guardado con una clave rara no sale en el lote', () => {
    expect(armarLoteDeLaCaja({ 'recibo.papel': 1, 'placa/ABC123': 4 })?.conteos).toEqual({
      'recibo.papel': 1,
    });
  });

  it('el Worker rechaza lo que no es un lote de la caja', () => {
    const bueno = { v: 2, producto: 'parqueadero-caja', conteos: { 'recibo.whatsapp': 3 } };
    expect(motivoDeRechazoDeLaCaja(bueno)).toBeNull();
    expect(motivoDeRechazoDeLaCaja({ ...bueno, placa: 'ABC123' })).toMatch(/campos desconocidos/);
    expect(motivoDeRechazoDeLaCaja({ ...bueno, v: 1 })).toMatch(/versión/);
    expect(motivoDeRechazoDeLaCaja({ ...bueno, producto: 'agro' })).toMatch(/producto/);
    expect(motivoDeRechazoDeLaCaja({ ...bueno, conteos: {} })).toMatch(/no trae/);
    expect(motivoDeRechazoDeLaCaja({ ...bueno, conteos: { 'recibo.papel': 0 } })).toMatch(
      /cuenta inválida/,
    );
    expect(motivoDeRechazoDeLaCaja({ ...bueno, conteos: { 'Parqueadero Ensayo Uno': 1 } })).toMatch(
      /evento desconocido/,
    );
    expect(motivoDeRechazoDeLaCaja([])).toMatch(/no es un objeto/);
  });
});
