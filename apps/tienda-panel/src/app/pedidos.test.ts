/**
 * HU-T9.1: los filtros de la bandeja trabajan sobre lo que ya llegó (CA1), y el turno deja pintar
 * solo la última lectura (CA3).
 */
import { describe, expect, it } from 'vitest';
import { crearTurno, type FilaDePedido, filtrar, unir } from './pedidos.ts';

const pedido = (numero: number, extra: Partial<FilaDePedido> = {}): FilaDePedido => ({
  id: `ped-${numero}`,
  numero,
  estado: 'pendiente',
  formaPago: 'transferencia',
  totalCop: 129000,
  creado: '2026-10-15T15:00:00.000Z',
  ciudad: 'Medellín',
  articulos: 1,
  atencion: null,
  comprador: { nombre: 'Ensayo D.', celular: '300 ••• 4567' },
  version: 1,
  ...extra,
});

describe('filtrar (HU-T9.1 CA1)', () => {
  const pedidos = [
    pedido(1045),
    pedido(1046, { estado: 'confirmado', formaPago: 'contraentrega', ciudad: 'Bogotá' }),
    pedido(1047, { comprador: { nombre: 'Ensayo U.', celular: null } }),
  ];
  const todos = { estado: '', forma: '', texto: '' };

  it('por estado, por forma de pago y los dos a la vez', () => {
    expect(filtrar(pedidos, { ...todos, estado: 'pendiente' }).map((p) => p.numero)).toEqual([
      1045, 1047,
    ]);
    expect(filtrar(pedidos, { ...todos, forma: 'contraentrega' }).map((p) => p.numero)).toEqual([
      1046,
    ]);
    expect(filtrar(pedidos, { ...todos, estado: 'pendiente', forma: 'contraentrega' })).toEqual([]);
  });

  it('por número, con o sin «#», y por lo que se ve del comprador, sin tildes ni mayúsculas', () => {
    expect(filtrar(pedidos, { ...todos, texto: '#1046' }).map((p) => p.numero)).toEqual([1046]);
    expect(filtrar(pedidos, { ...todos, texto: 'ensayo u' }).map((p) => p.numero)).toEqual([1047]);
    expect(filtrar(pedidos, { ...todos, texto: 'bogota' }).map((p) => p.numero)).toEqual([1046]);
    expect(filtrar(pedidos, { ...todos, texto: '4567' }).map((p) => p.numero)).toEqual([
      1045, 1046,
    ]);
  });
});

describe('el turno de las lecturas (HU-T9.1 CA3)', () => {
  it('❌ una respuesta vieja no está vigente cuando ya salió otra lectura', () => {
    const turno = crearTurno();
    const primera = turno.tomar();
    const segunda = turno.tomar();
    expect(turno.vigente(primera)).toBe(false);
    expect(turno.vigente(segunda)).toBe(true);
  });

  it('unir una página no repite un pedido que llegó dos veces', () => {
    expect(unir([pedido(1), pedido(2)], [pedido(2), pedido(3)]).map((p) => p.numero)).toEqual([
      1, 2, 3,
    ]);
  });
});
