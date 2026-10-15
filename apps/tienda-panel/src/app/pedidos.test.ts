/**
 * HU-T9.1: los filtros de la bandeja trabajan sobre lo que ya llegó (CA1), y el turno deja pintar
 * solo la última lectura (CA3).
 */
import { describe, expect, it } from 'vitest';
import {
  crearTurno,
  FALTA_GUIA,
  FALTA_TRANSPORTADORA,
  type FilaDePedido,
  filtrar,
  revisarAnotado,
  revisarDespacho,
  unir,
} from './pedidos.ts';

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

describe('despachar (HU-T9.4)', () => {
  const vacio = { transportadora: '', guia: '', comision: '', fleteIda: '' };

  it('❌ CA2: contra entrega dice cuál falta, todo en la misma vuelta', () => {
    expect(revisarDespacho(vacio, true).errores).toEqual([
      { campo: 'transportadora', mensaje: FALTA_TRANSPORTADORA },
      { campo: 'guia', mensaje: FALTA_GUIA },
    ]);
    expect(
      revisarDespacho({ ...vacio, transportadora: 'Transportadora Ensayo' }, true).errores,
    ).toEqual([{ campo: 'guia', mensaje: FALTA_GUIA }]);
  });

  it('una transferencia sale sin guía, y sin comisión ni flete', () => {
    expect(revisarDespacho({ ...vacio, comision: 'x' }, false)).toEqual({
      errores: [],
      cuerpo: { transportadora: '', guia: '' },
    });
  });

  it('la comisión y el flete van en pesos; vacíos son «no lo sé», nunca 0', () => {
    const f = { transportadora: ' T ', guia: ' GE-1 ', comision: '3.500', fleteIda: '' };
    expect(revisarDespacho(f, true)).toEqual({
      errores: [],
      cuerpo: { transportadora: 'T', guia: 'GE-1', comisionCop: 3500, fleteIdaCop: null },
    });
    expect(revisarDespacho({ ...f, fleteIda: 'doce mil' }, true).errores).toEqual([
      { campo: 'fleteIdaCop', mensaje: 'Escribe el valor en pesos, como 12.000, o déjalo vacío.' },
    ]);
  });
});

describe('anotar un pedido (HU-T9.6)', () => {
  const vacio = {
    cantidades: { 'v-m': '', 'v-s': '' },
    formaPago: '',
    envio: '',
    nombre: '',
    celular: '',
    direccion: '',
    ciudad: '',
    notas: '',
  };

  it('❌ sin productos ni forma de pago, lo dice todo en la misma vuelta', () => {
    expect(revisarAnotado(vacio).errores.map((e) => e.campo)).toEqual(['productos', 'formaPago']);
    expect(
      revisarAnotado({ ...vacio, cantidades: { 'v-m': '1,5' }, formaPago: 'efectivo' }).errores,
    ).toEqual([{ campo: 'cantidad-v-m', mensaje: 'Escribe cuántas, de 1 a 999.' }]);
  });

  it('manda solo lo que lleva, el envío en pesos y el comprador si lo hay', () => {
    const r = revisarAnotado({
      ...vacio,
      cantidades: { 'v-m': '2', 'v-s': '0' },
      formaPago: 'contraentrega',
      envio: '8.000',
      nombre: ' Ensayo Dos Compradora ',
      ciudad: 'Medellín',
    });
    expect(r).toEqual({
      errores: [],
      cuerpo: {
        lineas: [{ variante: 'v-m', cantidad: 2 }],
        formaPago: 'contraentrega',
        envioCop: 8000,
        ciudad: 'Medellín',
        contacto: { nombre: 'Ensayo Dos Compradora', ciudad: 'Medellín' },
      },
    });
    expect(
      revisarAnotado({ ...vacio, cantidades: { 'v-m': '1' }, formaPago: 'efectivo' }).cuerpo,
    ).toEqual({ lineas: [{ variante: 'v-m', cantidad: 1 }], formaPago: 'efectivo', envioCop: 0 });
  });
});
