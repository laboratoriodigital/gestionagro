/**
 * HU-T13.5 CA2 y CA3: lo que se hornea según el plan. Lo que pasa del límite queda oculto, nunca
 * borrado; sin el plan que lo incluye no se ofrece pagar en línea, la contraentrega ni los feeds, y
 * la tienda sigue recibiendo por WhatsApp. Ningún dato real.
 */
import {
  formasDelPlan,
  type LimitesDelPlan,
  limitesDelPlan,
  limitesMasEstrictos,
} from '@ed1/tienda-schema';
import { ENSAYO_DOS as DOS, legalDeEnsayo as legalDe } from '@ed1/tienda-schema/ensayos';
import { describe, expect, it } from 'vitest';
import funciones from '../../../content/tienda/funciones.json' with { type: 'json' };
import { hornear, type ProductoParaHornear, type TiendaParaHornear } from './horno.ts';
import { alPlan } from './plan.ts';
import { ACENTOS_DE_LA_VITRINA } from './tema.ts';

const GRATIS: LimitesDelPlan = {
  productos: 2,
  usuarios: 1,
  cobroEnLinea: false,
  contraentrega: false,
  dominioPropio: false,
  feeds: false,
};
const PAGO: LimitesDelPlan = {
  productos: null,
  usuarios: null,
  cobroEnLinea: true,
  contraentrega: true,
  dominioPropio: true,
  feeds: true,
};

const producto = (slug: string, nombre: string): ProductoParaHornear => ({
  slug,
  nombre,
  opciones: [],
  variantes: [{ id: `v-${slug}`, clave: '', precioCop: 1500, stock: null }],
  actualizado: '2026-10-20T15:00:00.000Z',
});

const tienda = (extra: Partial<TiendaParaHornear> = {}): TiendaParaHornear => ({
  dominio: 'ensayo-dos--staging.laboratorio-digital.app',
  release: 'r1',
  nombre: DOS.nombre,
  whatsapp: '+573000000002',
  apariencia: {
    acento: ACENTOS_DE_LA_VITRINA.oliva,
    tinta: 'negra',
    estilo: 'precision',
    portada: 'catalogo',
    proporcion: '1:1',
    modo: 'telefono',
  },
  agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
  legal: {
    ...legalDe(DOS),
    formas: [{ forma: 'a_convenir' }, { forma: 'contraentrega' }],
    sinRetracto: [{ nombre: 'Torta', motivo: 'Alimento perecedero' }],
  },
  // En el orden del comercio: los primeros se muestran.
  productos: [
    producto('pan-de-bono', 'Pan de bono'),
    producto('almojabana', 'Almojábana'),
    producto('torta', 'Torta'),
  ],
  colecciones: [{ slug: 'todo', nombre: 'Todo', productos: ['torta', 'pan-de-bono'] }],
  cobroEnLinea: true,
  cobroEnPruebas: true,
  feeds: { google: true, meta: true, agentes: true },
  ...extra,
});

describe('alPlan (HU-T13.5)', () => {
  it('CA3: lo que pasa del límite queda oculto, en el orden del comercio, y sus colecciones no lo nombran', () => {
    const r = alPlan(tienda({ plan: GRATIS }));
    expect(r.ocultos).toEqual(['torta']);
    expect(r.tienda.productos.map((p) => p.slug)).toEqual(['pan-de-bono', 'almojabana']);
    expect(r.tienda.colecciones).toEqual([
      { slug: 'todo', nombre: 'Todo', productos: ['pan-de-bono'] },
    ]);
    expect(r.tienda.legal?.sinRetracto).toEqual([]);
  });

  it('CA3: sin el plan, no se ofrece pagar en línea, la contraentrega ni los feeds', () => {
    const { tienda: t } = alPlan(tienda({ plan: GRATIS }));
    expect(t.cobroEnLinea).toBeUndefined();
    expect(t.cobroEnPruebas).toBeUndefined();
    expect(t.feeds).toBeUndefined();
    expect(t.legal?.formas).toEqual([{ forma: 'a_convenir' }]);
  });

  it('con un plan pago, o sin plan (las versiones de antes), todo queda como se publicó', () => {
    const pago = alPlan(tienda({ plan: PAGO }));
    expect(pago.ocultos).toEqual([]);
    expect(pago.tienda).toEqual(tienda({ plan: PAGO }));
    expect(alPlan(tienda()).tienda).toEqual(tienda());
  });

  it('el horno hornea lo que el plan deja: ni la ficha oculta, ni el pago en línea, ni los feeds', async () => {
    const a = await hornear(tienda({ plan: GRATIS }));
    expect(a.has('/p/pan-de-bono/index.html')).toBe(true);
    expect(a.has('/p/torta/index.html')).toBe(false);
    expect([...a.keys()].some((r) => r.startsWith('/feeds/'))).toBe(false);
    const carrito = a.get('/carrito/index.html')?.contenido ?? '';
    expect(carrito).toContain('value="a_convenir"');
    expect(carrito).not.toContain('value="en_linea"');
    expect(carrito).not.toContain('value="contraentrega"');
    const b = await hornear(tienda({ plan: PAGO }));
    expect(b.has('/p/torta/index.html')).toBe(true);
    expect(b.get('/carrito/index.html')?.contenido).toContain('value="en_linea"');
  });
});

describe('los límites de funciones.json (HU-T13.5 CA2)', () => {
  it('el gratuito: 15 productos, una persona, sin cobro en línea, contraentrega, dominio propio ni feeds', () => {
    expect(limitesDelPlan(funciones as never, 'gratis', 'gratis')).toEqual({
      productos: 15,
      usuarios: 1,
      cobroEnLinea: false,
      contraentrega: false,
      dominioPropio: false,
      feeds: false,
    });
    expect(limitesDelPlan(funciones as never, 'intermedio', 'gratis')).toMatchObject({
      productos: null,
      usuarios: 4,
      cobroEnLinea: true,
      dominioPropio: true,
    });
  });

  it('❌ un plan que el archivo no nombra tiene los límites del gratuito, nunca «todo encendido» (P1)', () => {
    expect(limitesDelPlan(funciones as never, 'de-otro-producto', 'gratis')).toEqual(
      limitesDelPlan(funciones as never, 'gratis', 'gratis'),
    );
  });

  it('el más estricto de dos planes: el menor límite y solo lo que los dos encienden', () => {
    expect(limitesMasEstrictos(PAGO, GRATIS)).toEqual(GRATIS);
    expect(limitesMasEstrictos(PAGO, { ...PAGO, productos: 30 })).toEqual({
      ...PAGO,
      productos: 30,
    });
  });

  it('CA3: si el plan quita la única forma de pedir, queda «a convenir»; si no quita nada, nada cambia', () => {
    expect(formasDelPlan([{ forma: 'en_linea' }], GRATIS)).toEqual([{ forma: 'a_convenir' }]);
    expect(formasDelPlan([{ forma: 'contraentrega' }], GRATIS)).toEqual([{ forma: 'a_convenir' }]);
    expect(formasDelPlan([], GRATIS, true)).toEqual([{ forma: 'a_convenir' }]);
    expect(formasDelPlan([{ forma: 'en_linea' }, { forma: 'transferencia' }], GRATIS)).toEqual([
      { forma: 'transferencia' },
    ]);
    expect(formasDelPlan([{ forma: 'en_linea' }], PAGO, true)).toEqual([{ forma: 'en_linea' }]);
    expect(formasDelPlan([], GRATIS)).toEqual([]);
  });
});
