/**
 * HU-T5.4: el carrito de la vitrina. El código de Crockford una vez por carrito, los topes dichos,
 * lo guardado con otro formato que se lee o se descarta diciéndolo, y ningún saneamiento con un
 * cobro en pantalla (CA3).
 */
import { LIMITES } from '@ed1/dinero';
import { describe, expect, it } from 'vitest';
import {
  ALFABETO_CROCKFORD,
  agregar,
  type Carrito,
  cambiarCantidad,
  carritoVacio,
  codigoNuevo,
  esCodigo,
  leerCarrito,
  sanear,
  TOPES,
  unidades,
  vaciar,
} from './carrito.ts';

/** Un azar fijo: devuelve los bytes dados, en ciclo. */
const azarDe =
  (...bytes: number[]) =>
  (n: number) =>
    Uint8Array.from({ length: n }, (_, i) => bytes[i % bytes.length] ?? 0);
const azar = azarDe(1, 2, 3, 4, 5, 6);

describe('el código del pedido (CA1 y CA3)', () => {
  it('son 6 caracteres de Crockford, y el mismo mientras el carrito siga', () => {
    const c = carritoVacio(azar);
    expect(c.codigo).toBe('123456');
    const { carrito } = agregar(c, 'v1');
    expect(carrito.codigo).toBe('123456');
    expect(leerCarrito(JSON.stringify(carrito), null, azarDe(9)).carrito.codigo).toBe('123456');
  });

  it('❌ nunca lleva I, L, O ni U, con cualquier byte', () => {
    expect(ALFABETO_CROCKFORD).toHaveLength(32);
    for (let b = 0; b < 256; b++) {
      const codigo = codigoNuevo(azarDe(b));
      expect(codigo).not.toMatch(/[ILOU]/);
      expect(esCodigo(codigo)).toBe(true);
    }
  });

  it('enviar el pedido deja un carrito vacío con otro código', () => {
    const nuevo = vaciar(azarDe(31));
    expect(nuevo).toEqual({ v: 1, codigo: 'ZZZZZZ', lineas: [] });
  });
});

describe('los topes (CA2)', () => {
  it('son los de @ed1/dinero: una sola fuente (P2)', () => {
    expect(TOPES).toEqual({ lineas: LIMITES.lineas, unidadesPorLinea: LIMITES.unidadesPorLinea });
  });

  it('❌ la línea 31 no entra, y lo dice', () => {
    let c: Carrito = carritoVacio(azar);
    for (let i = 0; i < 30; i++) c = agregar(c, `v${i}`).carrito;
    const r = agregar(c, 'v30');
    expect(r.tope).toBe('lineas');
    expect(r.carrito.lineas).toHaveLength(30);
  });

  it('❌ una línea no pasa de 200 unidades, y lo dice', () => {
    const c = agregar(carritoVacio(azar), 'v1', 199).carrito;
    const r = agregar(c, 'v1', 5);
    expect(r.tope).toBe('unidades');
    expect(unidades(r.carrito)).toBe(200);
    expect(cambiarCantidad(r.carrito, 'v1', 900).lineas[0]?.cantidad).toBe(200);
  });

  it('la edad confirmada queda en la línea (Ley 1480 art. 52)', () => {
    const c = agregar(carritoVacio(azar), 'vino', 1, { mayorDeEdad: true }).carrito;
    expect(c.lineas).toEqual([{ variante: 'vino', cantidad: 1, mayorDeEdad: true }]);
  });

  it('cambiar la cantidad a 0 quita la línea', () => {
    const c = agregar(carritoVacio(azar), 'v1', 2).carrito;
    expect(cambiarCantidad(c, 'v1', 0).lineas).toEqual([]);
  });
});

describe('lo guardado (P10)', () => {
  it('sin nada guardado: un carrito nuevo, sin aviso', () => {
    expect(leerCarrito(null, null, azar)).toEqual({ carrito: carritoVacio(azar) });
  });

  it('el formato de T3 se lee, con código nuevo, y lo dice', () => {
    const r = leerCarrito(null, JSON.stringify([{ variante: 'v1', cantidad: 2 }]), azar);
    expect(r.aviso).toBe('formato-anterior');
    expect(r.carrito).toEqual({
      v: 1,
      codigo: '123456',
      lineas: [{ variante: 'v1', cantidad: 2 }],
    });
  });

  it.each([
    ['texto que no es JSON', '{roto'],
    ['otra versión', JSON.stringify({ v: 2, codigo: '123456', lineas: [] })],
    ['un código con I', JSON.stringify({ v: 1, codigo: 'ABCDEI', lineas: [] })],
    [
      'una cantidad rara',
      JSON.stringify({ v: 1, codigo: '123456', lineas: [{ variante: 'v', cantidad: 1.5 }] }),
    ],
  ])('❌ %s: se descarta diciéndolo, nunca rompe la página', (_caso, texto) => {
    const r = leerCarrito(texto, null, azar);
    expect(r.aviso).toBe('ilegible');
    expect(r.carrito.lineas).toEqual([]);
  });

  it('❌ uno que pasa los topes se recorta y lo dice', () => {
    const lineas = Array.from({ length: 35 }, (_, i) => ({ variante: `v${i}`, cantidad: 300 }));
    const r = leerCarrito(JSON.stringify({ v: 1, codigo: '123456', lineas }), null, azar);
    expect(r.aviso).toBe('recortado');
    expect(r.carrito.lineas).toHaveLength(30);
    expect(r.carrito.lineas.every((l) => l.cantidad === 200)).toBe(true);
  });
});

describe('sanear', () => {
  const c = [
    ['v-sigue', 2],
    ['v-agotada', 1],
    ['v-poca', 5],
    ['v-borrada', 1],
  ].reduce((x, [v, n]) => agregar(x, v as string, n as number).carrito, carritoVacio(azar));
  const existencias = new Map<string, number | null>([
    ['v-sigue', null],
    ['v-agotada', 0],
    ['v-poca', 3],
  ]);

  it('quita lo que ya no existe o se agotó, y baja lo que no alcanza', () => {
    const r = sanear(c, existencias);
    expect(r.carrito.lineas).toEqual([
      { variante: 'v-sigue', cantidad: 2 },
      { variante: 'v-poca', cantidad: 3 },
    ]);
    expect(r.cambios).toEqual(['v-agotada', 'v-poca', 'v-borrada']);
  });

  it('❌ con un cobro en pantalla no cambia nada (CA3, bitácora ecommerce 47)', () => {
    const conCobro = { ...c, cobro: '2026-10-14T15:00:00.000Z' };
    const r = sanear(conCobro, existencias);
    expect(r.bloqueado).toBe(true);
    expect(r.carrito).toBe(conCobro);
  });
});
