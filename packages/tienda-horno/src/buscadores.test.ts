/**
 * HU-P4.4 (sprint PF3): el título y la descripción para buscadores. Con ellos, la página los usa
 * en `<title>` y en su descripción, escapados; sin ellos, el nombre con el de la tienda y la
 * descripción, como antes (CA1). Ningún dato real.
 */
import { ENSAYO_UNO, legalDeEnsayo } from '@ed1/tienda-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { hornear, type ProductoParaHornear, type TiendaParaHornear } from './horno.ts';
import { ACENTOS_DE_LA_VITRINA } from './tema.ts';

const producto = ENSAYO_UNO.productos[0];
if (!producto) throw new Error('el ensayo no tiene productos');

const tienda = (p: Partial<ProductoParaHornear>, extra: Partial<TiendaParaHornear> = {}) =>
  hornear({
    dominio: 'ensayo-uno--staging.mitiendapro.co',
    release: 'r1',
    nombre: ENSAYO_UNO.nombre,
    whatsapp: '+573000000001',
    apariencia: {
      acento: ACENTOS_DE_LA_VITRINA.cobre,
      tinta: 'negra',
      estilo: 'precision',
      portada: 'catalogo',
      proporcion: '1:1',
      modo: 'claro',
    },
    agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
    legal: legalDeEnsayo(ENSAYO_UNO),
    productos: [
      {
        slug: producto.slug,
        nombre: producto.nombre,
        descripcion: 'Camisa de **lino** lavado, fresca para el calor.',
        opciones: producto.opciones,
        variantes: producto.variantes,
        actualizado: '2026-10-20T15:00:00.000Z',
        ...p,
      },
    ],
    feeds: { google: true, meta: true, agentes: true },
    ...extra,
  });

const cabeza = (html: string) => html.slice(0, html.indexOf('</head>'));

describe('HU-P4.4 · cómo sale en Google', () => {
  it('sin nada escrito, el nombre con el de la tienda y la descripción, como antes', async () => {
    const a = await tienda({});
    const html = cabeza(a.get(`/p/${producto.slug}/index.html`)?.contenido ?? '');
    expect(html).toContain(`<title>${producto.nombre} · ${ENSAYO_UNO.nombre}</title>`);
    expect(html).toContain(
      '<meta name="description" content="Camisa de **lino** lavado, fresca para el calor.">',
    );
  });

  it('con lo escrito, ese título y esa descripción, escapados', async () => {
    const a = await tienda({
      buscadores: {
        titulo: 'Camisa de lino para hombre <b>en Medellín</b>',
        descripcion: 'Envíos a todo el país & pago contra entrega.',
      },
    });
    const html = cabeza(a.get(`/p/${producto.slug}/index.html`)?.contenido ?? '');
    expect(html).toContain(
      '<title>Camisa de lino para hombre &lt;b&gt;en Medellín&lt;/b&gt;</title>',
    );
    expect(html).toContain(
      '<meta name="description" content="Envíos a todo el país &amp; pago contra entrega.">',
    );
    expect(html).toContain('<meta property="og:title" content="Camisa de lino para hombre');
  });

  it('una página propia también; sin ellos, su título y ninguna descripción, como antes', async () => {
    const a = await tienda(
      {},
      {
        paginas: [
          {
            slug: 'quienes-somos',
            titulo: 'Quiénes somos',
            cuerpo: 'Somos un **taller** familiar.',
          },
          {
            slug: 'envios',
            titulo: 'Envíos',
            cuerpo: 'Enviamos a todo el país.',
            buscadores: {
              titulo: 'Envíos a toda Colombia',
              descripcion: 'Cuánto tarda tu pedido.',
            },
          },
        ],
      },
    );
    const quienes = cabeza(a.get('/quienes-somos/index.html')?.contenido ?? '');
    expect(quienes).toContain(`<title>Quiénes somos · ${ENSAYO_UNO.nombre}</title>`);
    expect(quienes).not.toContain('<meta name="description"');
    const envios = cabeza(a.get('/envios/index.html')?.contenido ?? '');
    expect(envios).toContain('<title>Envíos a toda Colombia</title>');
    expect(envios).toContain('<meta name="description" content="Cuánto tarda tu pedido.">');
  });
});
