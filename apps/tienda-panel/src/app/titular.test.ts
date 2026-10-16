import { describe, expect, it } from 'vitest';
import { celularDe, correccionDe, hechoEnPalabras, nombreDeLaDescarga } from './titular.ts';

describe('los datos de un comprador (HU-T7.3)', () => {
  it('el celular, como lo escribe la gente; lo que no es de Colombia no se busca', () => {
    expect(celularDe('300 123 4567')).toBe('3001234567');
    expect(celularDe('+57 300-123-4567')).toBe('3001234567');
    expect(celularDe('6041234567')).toBeNull();
    expect(celularDe('300123')).toBeNull();
  });

  it('corregir manda solo lo escrito, y un celular nuevo en sus 10 dígitos', () => {
    expect(correccionDe({ direccion: ' Calle de prueba 100 ', nombre: '  ' })).toEqual({
      contacto: { direccion: 'Calle de prueba 100' },
    });
    expect(correccionDe({ celular: '+57 300 555 0101' })).toEqual({
      contacto: { celular: '3005550101' },
    });
    expect(correccionDe({ celular: '123' })).toEqual({
      error: 'El celular nuevo debe tener 10 dígitos y empezar por 3.',
    });
    expect(correccionDe({})).toEqual({ error: 'Escribe lo que hay que corregir.' });
  });

  it('borrar dice cuántos se borraron y cuántos esperan por estar en curso', () => {
    expect(hechoEnPalabras('suprimir', { estado: 'guardado', pedidos: 2, enCurso: 1 })).toBe(
      'Se borraron los datos de 2 pedidos; los pedidos quedan, sin ellos, como prueba de la venta. Un pedido en curso guarda los suyos hasta terminar: bórralos cuando lleguen.',
    );
    expect(hechoEnPalabras('suprimir', { estado: 'guardado', pedidos: 0, enCurso: 2 })).toBe(
      'No se borró ningún dato. 2 pedidos en curso guardan los suyos hasta terminar: bórralos cuando lleguen.',
    );
    expect(hechoEnPalabras('corregir', { estado: 'guardado', pedidos: 1, enCurso: 0 })).toBe(
      'Se corrigieron los datos de 1 pedido.',
    );
  });

  it('el archivo no lleva el celular en el nombre', () => {
    expect(nombreDeLaDescarga({ exportada: '2026-10-15T15:00:00.000Z' })).toBe(
      'datos-del-comprador-2026-10-15.json',
    );
  });
});
