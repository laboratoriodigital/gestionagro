import { describe, expect, it } from 'vitest';
import { cargarProductos, type Producto } from '../../../../scripts/lib/productos.ts';
import { SITIO, segmentoDe, seoDeProducto } from './seo.ts';
import { sitemapXml, urlsDelSitemap } from './sitemap.ts';

const productos = cargarProductos();
const dpv = productos.find((p) => p.id === 'agro-calculadora-dpv');
if (!dpv) throw new Error('falta el contrato de la DPV');

const con = (cambios: Partial<Producto>): Producto => ({ ...dpv, ...cambios });

describe('SEO derivado del contrato (HU-E1.6, CA1)', () => {
  it('sale todo del product.yaml, sin escribirlo a mano', () => {
    const seo = seoDeProducto(dpv);
    expect(seo.title).toBe(`${dpv.seo.title} | CultivoPro`);
    expect(seo.description).toBe(dpv.seo.description);
    expect(seo.canonical).toBe(`${SITIO}/herramientas/agro/calculadora-dpv/`);
    expect(seo.og).toMatchObject({ url: seo.canonical, title: dpv.seo.title, locale: 'es_CO' });
    expect(seo.migas.map((m) => m.nombre)).toEqual([
      'Inicio',
      'Herramientas agro',
      'Calculadora de DPV',
    ]);
    expect(seo.jsonLd).toMatchObject({ '@type': 'BreadcrumbList' });
  });

  it('el host es el de ADR-19', () => {
    expect(SITIO).toBe('https://cultivopro.co');
  });

  it('un borrador no se indexa; uno activo sí', () => {
    expect(seoDeProducto(con({ estado: 'borrador' })).indexable).toBe(false);
    expect(seoDeProducto(con({ estado: 'activo' })).indexable).toBe(true);
  });

  it('el segmento de ruta sale del slug', () => {
    expect(segmentoDe(dpv)).toBe('calculadora-dpv');
  });
});

describe('sitemap (CA1)', () => {
  it('no incluye borradores: con solo borradores queda la landing de la raíz (HU-E0.10)', () => {
    expect(urlsDelSitemap([con({ estado: 'borrador' })])).toEqual([`${SITIO}/`]);
    expect(sitemapXml([con({ estado: 'borrador' })])).not.toContain('calculadora-dpv');
  });

  it('incluye la landing, las herramientas activas y el índice', () => {
    expect(urlsDelSitemap([con({ estado: 'activo' })])).toEqual([
      `${SITIO}/`,
      `${SITIO}/herramientas/agro/`,
      `${SITIO}/herramientas/agro/calculadora-dpv/`,
    ]);
  });

  it('no incluye el cuaderno (no es herramienta pública)', () => {
    const cuaderno = productos.find((p) => p.id === 'agro-cuaderno');
    expect(cuaderno).toBeDefined();
    expect(urlsDelSitemap([{ ...(cuaderno as Producto), estado: 'activo' }])).toEqual([
      `${SITIO}/`,
    ]);
  });
});
