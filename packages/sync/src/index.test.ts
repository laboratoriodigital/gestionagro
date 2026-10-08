import { describe, expect, it } from 'vitest';
import {
  type CatalogoValido,
  compararVersiones,
  crearPermisos,
  crearValidador,
  pedidoDeActualizar,
  proximoReinicioDeCuota,
} from './index.ts';

const MOTIVO = 'Esta versión de la app ya es vieja.';

describe('reinicio de la cuota diaria (P8)', () => {
  it('es a las 00:00 UTC: las 19:00 en Bogotá, también en fin de mes y de año', () => {
    // 18:59 en Bogotá (23:59 UTC) → el reinicio es en un minuto.
    expect(proximoReinicioDeCuota(Date.UTC(2026, 9, 1, 23, 59))).toBe(Date.UTC(2026, 9, 2));
    // 19:01 en Bogotá (00:01 UTC del día siguiente) → el reinicio es el otro día.
    expect(proximoReinicioDeCuota(Date.UTC(2026, 9, 2, 0, 1))).toBe(Date.UTC(2026, 9, 3));
    expect(proximoReinicioDeCuota(Date.UTC(2026, 11, 31, 12))).toBe(Date.UTC(2027, 0, 1));
    expect(proximoReinicioDeCuota(Date.UTC(2028, 1, 28, 12))).toBe(Date.UTC(2028, 1, 29));
  });
});

describe('versión mínima de la app (HU-E5.5)', () => {
  it('compara X.Y.Z como números, no como texto', () => {
    expect(compararVersiones('0.10.0', '0.9.9')).toBe(1);
    expect(compararVersiones('0.1.0', '0.1.0')).toBe(0);
    expect(compararVersiones('0.1.0', '0.2.0')).toBe(-1);
  });

  it('una app más vieja que la mínima recibe el pedido de actualizar; una ilegible, también', () => {
    expect(pedidoDeActualizar('0.1.0', '0.2.0', MOTIVO)).toEqual({
      minima: '0.2.0',
      motivo: MOTIVO,
    });
    expect(pedidoDeActualizar('0.2.0', '0.2.0', MOTIVO)).toBeUndefined();
    expect(pedidoDeActualizar('0.3.1', '0.2.0', MOTIVO)).toBeUndefined();
    expect(pedidoDeActualizar(undefined, '0.2.0', MOTIVO)).toMatchObject({ minima: '0.2.0' });
    expect(pedidoDeActualizar('basura', '0.2.0', MOTIVO)).toMatchObject({ minima: '0.2.0' });
  });
});

/**
 * El protocolo sin ningún producto (HU-Q7.3): una biblioteca de juguete con un catálogo `libro`.
 * Si el paquete supiera de fincas o de parqueaderos, esto no compilaría o no pasaría.
 */
describe('el protocolo con las entidades como parámetro (HU-Q7.3)', () => {
  class DatoMalo extends Error {}
  const validar = crearValidador<{ id: string; titulo: string }, 'libro'>({
    catalogos: ['libro'],
    validarRegistro: (d) => {
      const r = d as { id?: unknown; titulo?: unknown };
      if (typeof r.id !== 'string' || typeof r.titulo !== 'string') {
        throw new DatoMalo('Préstamo inválido: «titulo» falta');
      }
      if (r.titulo === 'defecto') throw new TypeError('un defecto del código');
      return { id: r.id, titulo: r.titulo };
    },
    validarCatalogo: (_e, d) => d as CatalogoValido,
    esErrorDeValidacion: (e): e is Error => e instanceof DatoMalo,
  });
  const op = { id: 'p1', entidad: 'registro', entidad_id: 'p1', version: 1 };

  it('acepta un registro y un catálogo del producto, y no conoce otras entidades', () => {
    expect(validar({ ...op, datos: { id: 'p1', titulo: 'Ensayo' } })).toMatchObject({ ok: true });
    const libro = { id: 'l1', org_id: null, version: 2, actualizado: '2026-10-08T00:00:00.000Z' };
    expect(
      validar({ id: 'l1@v2', entidad: 'libro', entidad_id: 'l1', version: 2, datos: libro }),
    ).toMatchObject({ ok: true, op: { entidad: 'libro', version: 2 } });
    expect(validar({ ...op, entidad: 'finca', datos: {} })).toEqual({
      ok: false,
      id: 'p1',
      motivo: 'Entidad desconocida: finca',
    });
  });

  it('un dato malo va a cuarentena con su motivo; un defecto del código se lanza', () => {
    expect(validar({ ...op, datos: { id: 'p1' } })).toEqual({
      ok: false,
      id: 'p1',
      motivo: 'Préstamo inválido: «titulo» falta',
    });
    expect(() => validar({ ...op, datos: { id: 'p1', titulo: 'defecto' } })).toThrow(TypeError);
  });

  it('los permisos niegan lo que no está en la matriz, y el motivo usa las palabras del producto', () => {
    const { puede, puedeRegistro, entidadesQuePuede, motivoSinPermiso } = crearPermisos<
      'bibliotecario' | 'lector',
      'libro'
    >({
      matriz: {
        registro: { leer: ['bibliotecario', 'lector'], escribir: ['bibliotecario'] },
        libro: { leer: ['bibliotecario', 'lector'], escribir: ['bibliotecario'] },
      },
      matrizDeRegistros: { multa: { leer: ['bibliotecario'], escribir: ['bibliotecario'] } },
      nombreDeRol: { bibliotecario: 'bibliotecario', lector: 'lector' },
      nombreDeEntidad: { registro: 'préstamos', libro: 'libros' },
      nombreDeTipo: { multa: 'las multas' },
      aQuienPedir: 'Pídeselo a la biblioteca.',
    });
    expect(puede('lector', 'leer', 'libro')).toBe(true);
    expect(puede('lector', 'escribir', 'libro')).toBe(false);
    expect(puede('intruso', 'leer', 'libro')).toBe(false);
    expect(puedeRegistro('lector', 'leer', 'multa')).toBe(false);
    expect(puedeRegistro('lector', 'leer', 'prestamo')).toBe(true);
    expect(entidadesQuePuede('lector', 'escribir')).toEqual([]);
    expect(motivoSinPermiso('lector', 'registro', 'multa')).toBe(
      'Con el rol de lector no se pueden cambiar las multas. Pídeselo a la biblioteca.',
    );
  });
});
