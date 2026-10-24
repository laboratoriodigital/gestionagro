/**
 * «Anotar» (HU-E0.11): el orden de la hoja y el pedido que lleva a Registrar.
 */
import { describe, expect, it } from 'vitest';
import { pedirAnotar, porUso, TIPOS, tomarPedido } from './anotar.ts';

describe('porUso', () => {
  it('un cuaderno vacío deja el orden de siempre', () => {
    expect(porUso([]).map((t) => t.id)).toEqual(TIPOS.map((t) => t.id));
  });

  it('lo más anotado sale primero y los empates conservan el orden de siempre', () => {
    const recientes = [
      { tipo: 'cosecha' },
      { tipo: 'riego' },
      { tipo: 'cosecha' },
      { tipo: 'monitoreo' },
      { tipo: 'riego' },
      { tipo: 'cosecha' },
    ];
    expect(porUso(recientes).map((t) => t.id)).toEqual([
      'cosecha',
      'riego',
      'monitoreo',
      'clima',
      'labor',
      'aplicacion',
    ]);
  });
});

describe('tomarPedido', () => {
  it('toma el pedido de la barra una sola vez', () => {
    globalThis.window ??= new EventTarget() as unknown as Window & typeof globalThis;
    pedirAnotar('riego');
    expect(tomarPedido('')).toBe('riego');
    expect(tomarPedido('')).toBeNull();
  });

  it('lee `#tipo=` de un enlace, y ❌ no acepta un tipo que no existe', () => {
    expect(tomarPedido('#tipo=cosecha')).toBe('cosecha');
    expect(tomarPedido('#tipo=borrar')).toBeNull();
  });
});
