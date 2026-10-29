/**
 * HU-P4.2 (sprint PF3): la bienvenida con dos o tres imágenes. Se deslizan con CSS, sin librería
 * (CA1); solo la primera carga de entrada y la portada sigue por debajo de 50 KB (CA2); cada una
 * lleva a su dirección; y sin el plan que lo incluye, sale solo la primera. Ningún dato real.
 */
import { type LimitesDelPlan, limitesDelPlan } from '@ed1/tienda-schema';
import { describe, expect, it } from 'vitest';
import funciones from '../../../content/tienda/funciones.json' with { type: 'json' };
import { type FotoParaHornear, hornear, type TiendaParaHornear } from './horno.ts';
import { ACENTOS_DE_LA_VITRINA } from './tema.ts';

const foto = (letra: string): FotoParaHornear => ({
  huella: letra.repeat(64),
  alt: '',
  ancho: 1600,
  alto: 1000,
  anchos: [400, 800, 1600],
});
const plan = (p: string): LimitesDelPlan => limitesDelPlan(funciones as never, p, 'gratis');

const tienda = (extra: Partial<TiendaParaHornear> = {}): TiendaParaHornear => ({
  dominio: 'ensayo-uno--staging.mitiendapro.co',
  release: 'r1',
  org: 'org-ensayo',
  medios: 'img--staging.laboratorio-digital.app',
  nombre: 'Comercio Ensayo Uno',
  apariencia: {
    acento: ACENTOS_DE_LA_VITRINA.cobre,
    tinta: 'negra',
    estilo: 'precision',
    portada: 'catalogo',
    proporcion: '1:1',
    modo: 'claro',
  },
  agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
  productos: [
    {
      slug: 'bolsa-de-tela',
      nombre: 'Bolsa de tela',
      opciones: [],
      variantes: [{ id: 'v-bolsa', clave: '', precioCop: 35000, stock: 2 }],
      actualizado: '2026-10-20T15:00:00.000Z',
    },
  ],
  hero: {
    titulo: 'Lino de Medellín',
    imagen: foto('a'),
    mas: [
      { imagen: foto('b'), texto: 'Nueva colección', enlace: '/c/lino/' },
      { imagen: foto('c') },
    ],
  },
  ...extra,
});

const portada = async (t: TiendaParaHornear) =>
  (await hornear(t)).get('/index.html')?.contenido ?? '';

describe('HU-P4.2 · varias imágenes en la bienvenida', () => {
  it('CA1: tres diapositivas, cada una con su enlace, sin un solo script nuevo', async () => {
    const html = await portada(tienda({ plan: plan('pro') }));
    expect(html).toContain('<section class="hero hero--con-foto hero--carrusel"');
    expect(html.match(/class="hero__diapositiva"/g)).toHaveLength(3);
    expect(html).toContain('href="/c/lino/" aria-label="2 de 3: Nueva colección"');
    expect(html).toContain('<span class="hero__leyenda">Nueva colección</span>');
    // Sin enlace, a los productos.
    expect(html).toContain('href="#productos" aria-label="3 de 3: Lino de Medellín, imagen 3"');
    expect(html).toContain('<a class="boton hero__boton" href="#productos">');
  });

  it('CA2: solo la primera carga de entrada; la portada sigue por debajo de 50 KB', async () => {
    const html = await portada(tienda({ plan: plan('pro') }));
    const seccion = html.slice(html.indexOf('<section class="hero'), html.indexOf('</section>'));
    expect(seccion.match(/fetchpriority="high"/g)).toHaveLength(1);
    expect(seccion.match(/loading="lazy"/g)).toHaveLength(2);
    expect(seccion.indexOf('fetchpriority="high"')).toBeLessThan(seccion.indexOf('loading="lazy"'));
    // Cada imagen dice su tamaño: nada salta al cargar (CLS).
    expect(seccion.match(/width="1600" height="1000"/g)).toHaveLength(3);
    expect(new TextEncoder().encode(html).length).toBeLessThan(50_000);
  });

  it('con el plan Gratis, sale solo la primera, como antes', async () => {
    const html = await portada(tienda({ plan: plan('gratis') }));
    expect(html).toContain('<section class="hero hero--con-foto">');
    expect(html).not.toContain('hero__diapositiva');
  });

  it('sin la primera imagen, las demás no salen: la bienvenida empieza por su foto', async () => {
    const html = await portada(
      tienda({ plan: plan('pro'), hero: { titulo: 'Hola', mas: [{ imagen: foto('b') }] } }),
    );
    expect(html).toContain('<section class="hero">');
    expect(html).not.toContain('hero__diapositiva');
  });
});
