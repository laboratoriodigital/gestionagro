/**
 * HU-T4.1: la tienda en bytes deterministas. Archivos dorados de los dos comercios de prueba (P4):
 * si el horno cambia lo que produce, la diferencia se ve aquí y se acepta a propósito con
 * `ACTUALIZAR_DORADOS=1`. Los mismos datos dan los mismos bytes, y nada vacío, entre corchetes o de
 * otro comercio llega al HTML.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  type ComercioDeEnsayo,
  ENSAYO_DOS,
  ENSAYO_UNO,
  hostDeStaging,
} from '@ed1/tienda-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { hornear, jsonEstable, manifiesto, presente, type TiendaParaHornear } from './horno.ts';
import { ACENTOS_DE_LA_VITRINA } from './tema.ts';

const DORADOS = join(import.meta.dirname, '..', 'dorados');
const ACTUALIZAR = process.env['ACTUALIZAR_DORADOS'] === '1';

/** La tienda de un comercio de prueba, como la armaría la API desde su shard y sus ajustes. */
function paraHornear(
  c: ComercioDeEnsayo,
  extra: Partial<TiendaParaHornear> = {},
): TiendaParaHornear {
  const uno = c.slug === ENSAYO_UNO.slug;
  return {
    dominio: hostDeStaging(c.slug),
    release: 'r1',
    nombre: c.nombre,
    frase: uno ? 'Ropa de lino hecha en Medellín.' : 'Pan de la casa, todas las mañanas.',
    whatsapp: uno ? '+573000000001' : '+573000000002',
    apariencia: {
      acento: uno ? ACENTOS_DE_LA_VITRINA.cobre : ACENTOS_DE_LA_VITRINA.oliva,
      tinta: uno ? 'azul' : 'negra',
      estilo: uno ? 'editorial' : 'precision',
      portada: uno ? 'editorial' : 'catalogo',
      proporcion: uno ? '4:5' : '1:1',
      modo: 'telefono',
    },
    agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
    ...(uno ? { googleVerificacion: 'PruebaDeVerificacion_ensayo-uno-0123456789Ab' } : {}),
    productos: c.productos.map((p) => ({
      slug: p.slug,
      nombre: p.nombre,
      descripcion: uno
        ? 'Lino **lavado**, fresco para el calor.\n\n- Talla real\n- Se lava a mano'
        : 'Recién horneado. Pídelo antes de las 10 a. m.',
      opciones: p.opciones,
      variantes: p.variantes,
      actualizado: '2026-10-13T15:00:00.000Z',
    })),
    ...(uno
      ? { colecciones: [{ slug: 'lino', nombre: 'Lino', productos: ['camisa-de-lino'] }] }
      : {}),
    ...extra,
  };
}

describe.each([ENSAYO_UNO, ENSAYO_DOS])('los archivos dorados de $nombre (HU-T4.1 CA3)', (c) => {
  it('el horno produce exactamente los dorados', async () => {
    const archivos = await hornear(paraHornear(c));
    const dir = join(DORADOS, c.slug);
    const lista = [...archivos.keys()].sort();
    if (ACTUALIZAR) {
      for (const [ruta, a] of archivos) {
        const destino = join(dir, ruta.slice(1));
        mkdirSync(dirname(destino), { recursive: true });
        writeFileSync(destino, a.contenido);
      }
      writeFileSync(join(dir, '.lista'), `${lista.join('\n')}\n`);
    }
    expect(lista).toEqual(readFileSync(join(dir, '.lista'), 'utf8').trim().split('\n'));
    for (const [ruta, a] of archivos) {
      expect(a.contenido, ruta).toBe(readFileSync(join(dir, ruta.slice(1)), 'utf8'));
    }
  });
});

describe('determinismo y lo que nunca llega al HTML', () => {
  it('los mismos datos dan los mismos bytes y el mismo manifiesto (CA2)', async () => {
    const a = await manifiesto(await hornear(paraHornear(ENSAYO_UNO)));
    const b = await manifiesto(await hornear(paraHornear(ENSAYO_UNO)));
    expect(a).toEqual(b);
    expect(a.huella).toMatch(/^[0-9a-f]{64}$/);
  });

  it('el lastmod del sitemap sale del dato, no del reloj', async () => {
    const sitemap = (await hornear(paraHornear(ENSAYO_DOS))).get('/sitemap.xml')?.contenido ?? '';
    expect(sitemap).toContain('<lastmod>2026-10-13</lastmod>');
  });

  it('❌ un dato vacío, entre corchetes o «undefined» no llega al HTML ni al JSON-LD (CA4)', async () => {
    const t = paraHornear(ENSAYO_DOS, { frase: '[frase de la tienda]' });
    const producto = t.productos[0];
    if (!producto) throw new Error('sin producto');
    t.productos = [{ ...producto, descripcion: 'undefined' }];
    const portada = (await hornear(t)).get('/index.html')?.contenido ?? '';
    const ficha = (await hornear(t)).get('/p/pan-de-bono/index.html')?.contenido ?? '';
    for (const html of [portada, ficha]) {
      expect(html).not.toMatch(/\[frase de la tienda\]|undefined|"description":""/);
    }
    expect(presente('  ')).toBe(false);
    expect(jsonEstable({ b: 1, a: '', c: undefined, d: '[x]' })).toBe('{"b":1}');
  });

  it('❌ un nombre con una etiqueta sale escapado, también dentro del JSON-LD', async () => {
    const html =
      (
        await hornear(paraHornear(ENSAYO_DOS, { nombre: 'Pan </script><script>alert(1)</script>' }))
      ).get('/index.html')?.contenido ?? '';
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('\\u003c/script>');
  });

  it('cada tienda dice su nombre, nunca el de otra (bitácora ecommerce, crítico)', async () => {
    const dos = [...(await hornear(paraHornear(ENSAYO_DOS))).values()].map((a) => a.contenido);
    expect(dos.join('\n')).not.toContain(ENSAYO_UNO.nombre);
  });

  it('la verificación de Google va solo en la portada de quien la configuró (HU-T14.8)', async () => {
    const uno = await hornear(paraHornear(ENSAYO_UNO));
    expect(uno.get('/index.html')?.contenido).toContain('name="google-site-verification"');
    expect(uno.get('/p/camisa-de-lino/index.html')?.contenido).not.toContain(
      'google-site-verification',
    );
    const dos = await hornear(paraHornear(ENSAYO_DOS));
    expect(dos.get('/index.html')?.contenido).not.toContain('google-site-verification');
  });

  it('un producto agotado sale como OutOfStock y uno sin inventario como InStock', async () => {
    const uno =
      (await hornear(paraHornear(ENSAYO_UNO))).get('/p/camisa-de-lino/index.html')?.contenido ?? '';
    expect(uno).toContain('"sku":"v-camisa-l-azul"');
    expect(uno).toMatch(/OutOfStock/);
    const dos =
      (await hornear(paraHornear(ENSAYO_DOS))).get('/p/pan-de-bono/index.html')?.contenido ?? '';
    expect(dos).toContain('https://schema.org/InStock');
  });
});
