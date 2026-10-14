/**
 * HU-T3.4 y HU-T5.3: la lógica de la isla de la vitrina, sin navegador. El botón dice qué falta,
 * lo agotado se tacha, y buscar no distingue tildes ni mayúsculas.
 */
import { ENSAYO_DOS, ENSAYO_UNO } from '@ed1/tienda-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { buscar, normalizar } from './buscar.ts';
import { estadoDeLaEleccion, type VarianteDeLaFicha, valorAgotado } from './seleccion.ts';

const camisa = ENSAYO_UNO.productos[0];
const pan = ENSAYO_DOS.productos[0];
if (!camisa || !pan) throw new Error('el fixture cambió');
const variantes = (p: typeof camisa): VarianteDeLaFicha[] =>
  p.variantes.map((v) => ({
    id: v.id,
    clave: v.clave,
    precioCop: v.precioCop,
    disponible: v.stock === null || v.stock > 0,
  }));

describe('el botón dice qué falta (HU-T3.4 CA2)', () => {
  it('sin elegir nada, pide la primera opción; con una, la siguiente', () => {
    expect(estadoDeLaEleccion(camisa.opciones, variantes(camisa), {})).toMatchObject({
      tipo: 'falta',
      texto: 'Elige talla',
    });
    expect(estadoDeLaEleccion(camisa.opciones, variantes(camisa), { Talla: 'S' })).toMatchObject({
      tipo: 'falta',
      opcion: 'Color',
      texto: 'Elige color',
    });
  });

  it('con todo elegido y en existencia, se puede agregar', () => {
    expect(
      estadoDeLaEleccion(camisa.opciones, variantes(camisa), { Talla: 'M', Color: 'Arena' }),
    ).toMatchObject({
      tipo: 'lista',
      texto: 'Agregar al pedido',
      variante: { id: 'v-camisa-m-arena' },
    });
  });

  it('❌ una combinación agotada o que no existe nunca queda como «lista»', () => {
    expect(
      estadoDeLaEleccion(camisa.opciones, variantes(camisa), { Talla: 'L', Color: 'Azul' }).tipo,
    ).toBe('agotada');
    expect(
      estadoDeLaEleccion(camisa.opciones, variantes(camisa), { Talla: 'S', Color: 'Azul' }).tipo,
    ).toBe('no-existe');
  });

  it('un producto sin opciones se agrega de una', () => {
    expect(estadoDeLaEleccion(pan.opciones, variantes(pan), {}).tipo).toBe('lista');
  });

  it('un valor que ya no lleva a nada que se pueda pedir sale tachado', () => {
    expect(valorAgotado(camisa.opciones, variantes(camisa), {}, 'Talla', 'L')).toBe(true);
    expect(valorAgotado(camisa.opciones, variantes(camisa), {}, 'Talla', 'S')).toBe(false);
    expect(valorAgotado(camisa.opciones, variantes(camisa), { Talla: 'S' }, 'Color', 'Azul')).toBe(
      true,
    );
  });
});

describe('buscar sin red (HU-T5.3)', () => {
  const catalogo = [
    { slug: 'vestido-rosa', nombre: 'Vestido rosa', url: 'https://x.test/p/vestido-rosa/' },
    { slug: 'camisa-de-lino', nombre: 'Camisa de lino', url: 'https://x.test/p/camisa-de-lino/' },
    { slug: 'jabon', nombre: 'Jabón de avena', url: 'https://x.test/p/jabon/' },
  ];

  it('sin tildes ni mayúsculas, con todas las palabras', () => {
    expect(buscar(catalogo, 'VESTIDO rosá').map((p) => p.slug)).toEqual(['vestido-rosa']);
    expect(buscar(catalogo, 'jabon').map((p) => p.slug)).toEqual(['jabon']);
    expect(normalizar('  Camisa   DE Lino ')).toBe('camisa de lino');
  });

  it('❌ sin resultados o sin consulta, nada', () => {
    expect(buscar(catalogo, 'zapatos')).toEqual([]);
    expect(buscar(catalogo, '   ')).toEqual([]);
  });
});
