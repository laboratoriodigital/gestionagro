import { describe, expect, it } from 'vitest';
import {
  comparacion,
  cuadreEnPalabras,
  enPorcentaje,
  margen,
  mesAnteriorEnPalabras,
  pendientesEnOrden,
  type Tablero,
} from './tablero.ts';

const nada: Tablero['pendientes'] = {
  porConfirmar: 0,
  porDespachar: 0,
  recaudosAtrasados: 0,
  solicitudesPorVencer: 0,
  solicitudesVencidas: 0,
  pagosSinExistencias: 0,
  cobrosARevisar: 0,
  agotados: 0,
};

describe('el tablero en palabras (HU-T14.2)', () => {
  it('❌ CA3: el 31 contra febrero dice «febrero entero»; si existe, el mismo día', () => {
    expect(mesAnteriorEnPalabras({ altura: '2028-02-29', anteriorCompleto: true })).toBe(
      'febrero entero',
    );
    expect(mesAnteriorEnPalabras({ altura: '2028-02-29', anteriorCompleto: false })).toBe(
      'febrero hasta el 29',
    );
    expect(mesAnteriorEnPalabras({ altura: '2027-12-01', anteriorCompleto: false })).toBe(
      'diciembre hasta el 1',
    );
  });

  it('sube, baja o igual; sin ventas antes no hay porcentaje', () => {
    expect(comparacion(440000, 120000)).toEqual({ texto: 'Sube 267 %', tono: 'bien' });
    expect(comparacion(90000, 100000)).toEqual({ texto: 'Baja 10 %', tono: 'mal' });
    expect(comparacion(100000, 100000)).toEqual({ texto: 'Igual', tono: 'neutro' });
    expect(comparacion(5000, 0)).toEqual({ texto: 'Sin ventas antes', tono: 'neutro' });
    expect(enPorcentaje(5 / 8)).toBe('63 %');
    expect(enPorcentaje(null)).toBe('Sin pedidos');
  });

  it('lo urgente arriba y en rojo; lo que está en cero no se dice', () => {
    const p = pendientesEnOrden({
      ...nada,
      porConfirmar: 1,
      porDespachar: 4,
      solicitudesVencidas: 1,
      recaudosAtrasados: 2,
      agotados: 1,
    });
    expect(p.map((x) => [x.texto, x.urgente, x.href])).toEqual([
      ['1 solicitud vencida sin respuesta', true, '/pedidos/solicitudes/'],
      ['2 recaudos sin liquidar hace más de 3 días hábiles', true, '/pedidos/recaudos/'],
      ['1 pedido por confirmar', false, '/pedidos/'],
      ['4 pedidos por despachar', false, '/pedidos/'],
      ['1 combinación agotada', false, '/productos/inventario/'],
    ]);
    expect(pendientesEnOrden(nada)).toEqual([]);
  });

  it('el margen es lo que queda de lo cobrado', () => {
    const ce = {
      cerrados: 3,
      devueltos: 1,
      cobradoCop: 190000,
      costosCop: 43500,
      netoCop: 146500,
      sinCostos: 1,
      enCamino: 1,
    };
    expect(margen(ce)).toBe(77);
    expect(margen({ ...ce, cobradoCop: 0, netoCop: -18000 })).toBeNull();
  });
});

describe('el cuadre de las métricas (HU-T14.6)', () => {
  it('CA1: la diferencia en los dos sentidos, en palabras', () => {
    expect(cuadreEnPalabras('pedidos', { base: 4, eventos: 4 })).toBe(
      'Cuadran: 4 pedidos en tu tienda y en tus métricas.',
    );
    expect(cuadreEnPalabras('pedidos', { base: 4, eventos: 3 })).toBe(
      '4 pedidos en tu tienda y 3 en tus métricas: 1 pedido sin medir, de compradores que bloquean la medición o cierran la página muy rápido.',
    );
    expect(cuadreEnPalabras('pagos', { base: 1, eventos: 2 })).toBe(
      '1 pago en tu tienda y 2 en tus métricas: 1 de más en tus métricas, intentos que no terminaron.',
    );
  });
});
