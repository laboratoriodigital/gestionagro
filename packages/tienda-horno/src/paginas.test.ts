/**
 * HU-T10.2: las páginas propias en la vitrina. Markdown seguro, su enlace en el pie de cada página
 * y en el sitemap (CA1); y ninguna puede tomar una dirección que la tienda ya usa (CA2), atado a lo
 * que de verdad hornea el horno (P2). Ningún dato real.
 */
import { DIRECCIONES_DEL_SISTEMA, leerDireccionDePagina } from '@ed1/tienda-schema';
import { ENSAYO_UNO, legalDeEnsayo } from '@ed1/tienda-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { hornear, type TiendaParaHornear } from './horno.ts';
import { ACENTOS_DE_LA_VITRINA } from './tema.ts';

const tienda = (extra: Partial<TiendaParaHornear> = {}): TiendaParaHornear => ({
  dominio: 'ensayo-uno--staging.mitiendapro.co',
  release: 'r1',
  nombre: ENSAYO_UNO.nombre,
  whatsapp: '+573000000001',
  apariencia: {
    acento: ACENTOS_DE_LA_VITRINA.cobre,
    tinta: 'azul',
    estilo: 'editorial',
    portada: 'editorial',
    proporcion: '4:5',
    modo: 'telefono',
  },
  agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
  legal: legalDeEnsayo(ENSAYO_UNO),
  productos: ENSAYO_UNO.productos.map((p) => ({
    slug: p.slug,
    nombre: p.nombre,
    opciones: p.opciones,
    variantes: p.variantes,
    actualizado: '2026-10-20T15:00:00.000Z',
  })),
  colecciones: [{ slug: 'lino', nombre: 'Lino', productos: [] }],
  feeds: { google: true, meta: true, agentes: true },
  ...extra,
});

const QUIENES = {
  slug: 'quienes-somos',
  titulo: 'Quiénes somos',
  cuerpo:
    'Somos un taller **familiar** de Medellín.\n\n- Lino lavado\n- Hecho a mano\n\n<script>alert(1)</script>',
};

describe('las páginas propias en la vitrina (HU-T10.2)', () => {
  it('CA1: cada una en /<dirección>/, en Markdown seguro, con su gemelo, en el sitemap y en el pie', async () => {
    const a = await hornear(tienda({ paginas: [QUIENES] }));
    const html = a.get('/quienes-somos/index.html')?.contenido ?? '';
    expect(html).toContain('<h1>Quiénes somos</h1>');
    expect(html).toContain('<strong>familiar</strong>');
    expect(html).toContain('<li>Hecho a mano</li>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(a.get('/quienes-somos/index.md')?.contenido).toContain('# Quiénes somos');
    expect(a.get('/sitemap.xml')?.contenido).toContain(
      '<loc>https://ensayo-uno--staging.mitiendapro.co/quienes-somos/</loc>',
    );
    // El enlace va en el pie de toda página, también en la portada.
    expect(a.get('/index.html')?.contenido).toContain(
      '<nav class="pie__enlaces" aria-label="Sobre la tienda"><a href="/quienes-somos/">Quiénes somos</a></nav>',
    );
  });

  it('sin páginas, la tienda no cambia', async () => {
    const sin = await hornear(tienda());
    const vacia = await hornear(tienda({ paginas: [] }));
    expect([...vacia]).toEqual([...sin]);
    expect(sin.get('/index.html')?.contenido).not.toContain('Sobre la tienda');
  });

  it('❌ CA2: ninguna dirección que hornea la vitrina se puede tomar para una página', async () => {
    // Una tienda con todo: textos legales, colecciones, feeds y más productos de los que caben.
    const muchos = Array.from({ length: 30 }, (_, i) => ({
      slug: `producto-${i}`,
      nombre: `Producto ${i}`,
      opciones: [],
      variantes: [{ id: `v-${i}`, clave: '', precioCop: 1000, stock: null }],
      actualizado: '2026-10-20T15:00:00.000Z',
    }));
    const a = await hornear(tienda({ productos: muchos, paginas: [QUIENES] }));
    const tramos = new Set(
      [...a.keys()]
        .map((ruta) => ruta.split('/')[1] ?? '')
        .map((tramo) => tramo.replace(/\.[a-z]+$/, ''))
        .filter((tramo) => tramo !== '' && tramo !== QUIENES.slug && !tramo.startsWith('tema-')),
    );
    for (const tramo of tramos) {
      expect(DIRECCIONES_DEL_SISTEMA.has(tramo), `«${tramo}» no está reservado`).toBe(true);
      expect(leerDireccionDePagina(tramo).ok).toBe(false);
    }
    // Y las del despacho y la API, que no se hornean.
    for (const tramo of ['api', 'mcp']) expect(leerDireccionDePagina(tramo).ok).toBe(false);
  });

  it('❌ la dirección: minúsculas sin tildes, un guion entre palabras, de 2 a 40 letras', () => {
    expect(leerDireccionDePagina(' Quienes-Somos ')).toEqual({ ok: true, slug: 'quienes-somos' });
    for (const mala of ['quiénes', 'quienes somos', 'a', '-x', 'x--y', '_t', 'x'.repeat(41)])
      expect(leerDireccionDePagina(mala).ok).toBe(false);
    expect(leerDireccionDePagina('legal')).toMatchObject({
      ok: false,
      motivo: expect.stringMatching(/la usa la tienda/),
    });
  });
});
