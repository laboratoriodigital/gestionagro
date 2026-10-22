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
  legalDeEnsayo,
} from '@ed1/tienda-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { compuerta } from './compuerta.ts';
import {
  EN_LA_PORTADA,
  hornear,
  jsonEstable,
  manifiesto,
  POR_PAGINA,
  presente,
  type TiendaParaHornear,
} from './horno.ts';
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
    legal: legalDeEnsayo(c),
    productos: c.productos.map((p) => ({
      slug: p.slug,
      nombre: p.nombre,
      descripcion: uno
        ? 'Lino **lavado**, fresco para el calor.\n\n- Talla real\n- Se lava a mano'
        : 'Recién horneado. Pídelo antes de las 10 a. m.',
      opciones: p.opciones,
      variantes: p.variantes,
      actualizado: '2026-10-13T15:00:00.000Z',
      // HU-T5.2: Ensayo Uno con su foto y sus derivadas; Ensayo Dos sin fotos (el marco vacío).
      ...(uno
        ? {
            fotos: [
              {
                huella: 'a'.repeat(64),
                alt: 'Camisa de lino arena',
                ancho: 1600,
                alto: 2000,
                anchos: [400, 800, 1600],
              },
            ],
          }
        : {
            retracto: { aplica: false as const, motivo: 'Alimento perecedero (Ley 1480, art. 47)' },
          }),
    })),
    ...(uno ? { org: c.org, medios: 'img--staging.laboratorio-digital.app' } : {}),
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

describe('HU-T3.7 · una tienda llena, en páginas que caben en un teléfono', () => {
  const muchos = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      slug: `producto-${i + 1}`,
      nombre: `Producto ${i + 1}`,
      opciones: [],
      variantes: [{ id: `v-${i + 1}`, clave: '', precioCop: 10000 + i, stock: null }],
      actualizado: '2026-10-13T15:00:00.000Z',
      fotos: [
        {
          huella: (i % 16).toString(16).repeat(64),
          alt: `Producto ${i + 1}`,
          ancho: 1600,
          alto: 2000,
          anchos: [400, 800, 1600],
        },
      ],
    }));
  const tienda = (n: number, portada: 'catalogo' | 'editorial' | 'colecciones') => {
    const productos = muchos(n);
    const base = paraHornear(ENSAYO_UNO);
    return hornear({
      ...base,
      apariencia: { ...base.apariencia, portada },
      productos,
      colecciones: [{ slug: 'todo', nombre: 'Todo', productos: productos.map((p) => p.slug) }],
    });
  };
  const texto = (a: Map<string, { contenido: string }>, ruta: string) =>
    a.get(ruta)?.contenido ?? '';

  it.each(['catalogo', 'editorial', 'colecciones'] as const)(
    'portada %s: los primeros 24 y «Ver los 100 productos»; las listas, de a 48 con su navegación',
    async (portada) => {
      const a = await tienda(100, portada);
      const inicio = texto(a, '/index.html');
      // La editorial pone el primero en grande y los demás en tarjetas: 24 en total.
      expect(inicio.match(/class="tarjeta"/g)).toHaveLength(
        portada === 'editorial' ? EN_LA_PORTADA - 1 : EN_LA_PORTADA,
      );
      expect(inicio).toContain('<a href="/productos/">Ver los 100 productos</a>');
      expect(texto(a, '/index.md')).toContain('[Ver los 100 productos](/productos/index.md)');
      for (const base of ['/productos/', '/c/todo/']) {
        const paginas = [base, `${base}2/`, `${base}3/`].map((r) => texto(a, `${r}index.html`));
        expect(paginas.map((p) => p.match(/class="tarjeta"/g)?.length)).toEqual([
          POR_PAGINA,
          POR_PAGINA,
          100 - 2 * POR_PAGINA,
        ]);
        expect(paginas[0]).toContain(`<a href="${base}2/" rel="next">Siguientes</a>`);
        expect(paginas[1]).toContain(`<a href="${base}" rel="prev">Anteriores</a>`);
        expect(paginas[2]).toContain('Página 3 de 3');
        expect(a.has(`${base}4/index.html`)).toBe(false);
        expect(texto(a, `${base}2/index.md`)).toContain(`[Siguientes](${base}3/index.md)`);
      }
      const mapa = texto(a, '/sitemap.xml');
      for (const r of ['/productos/', '/productos/3/', '/c/todo/2/'])
        expect(mapa).toContain(`mitiendapro.co${r}</loc>`);
    },
  );

  it('❌ con 2.000 productos con foto, ninguna página pasa su presupuesto', async () => {
    const a = await tienda(2000, 'catalogo');
    const r = compuerta({ ajustes: ENSAYO_UNO.ajustes, productos: [], archivos: a });
    expect(r.fallas.filter((f) => f.codigo === 'peso')).toEqual([]);
  });

  it('con pocos productos no hay páginas de más: todo cabe en la portada', async () => {
    const a = await tienda(EN_LA_PORTADA, 'catalogo');
    expect(texto(a, '/index.html').match(/class="tarjeta"/g)).toHaveLength(EN_LA_PORTADA);
    expect(texto(a, '/index.html')).not.toContain('Ver los');
    expect(a.has('/productos/index.html')).toBe(false);
    expect(texto(a, '/c/todo/index.html')).not.toContain('class="paginas"');
  });
});

describe('HU-T11.3 CA2 · una tienda que cobra en pruebas lo dice en todas sus páginas', () => {
  const FRANJA =
    '<p class="en-pruebas" role="note">Tienda en pruebas: los pagos en línea de esta tienda todavía no cobran de verdad.</p>';

  it('cada página horneada la trae, antes que la franja de arriba', async () => {
    const a = await hornear(paraHornear(ENSAYO_UNO, { cobroEnLinea: true, cobroEnPruebas: true }));
    const paginas = [...a].filter(([r]) => r.endsWith('.html'));
    expect(paginas.length).toBeGreaterThan(5);
    for (const [ruta, { contenido }] of paginas) {
      expect(contenido, ruta).toContain(`<body>\n${FRANJA}\n<header class="franja">`);
    }
  });

  it('❌ cobrando de verdad, o sin pago en línea, no la trae', async () => {
    for (const t of [{ cobroEnLinea: true }, { cobroEnPruebas: true }, {}]) {
      const a = await hornear(paraHornear(ENSAYO_UNO, t));
      for (const [ruta, { contenido }] of a) expect(contenido, ruta).not.toContain('en-pruebas');
    }
  });
});

describe('HU-T11.4 · el carrito de una tienda que cobra en línea', () => {
  const texto = (a: Map<string, { contenido: string }>, ruta: string) =>
    a.get(ruta)?.contenido ?? '';

  it('ofrece pagar en línea primero, pide la entrega y hornea la vuelta de Bold', async () => {
    const a = await hornear(paraHornear(ENSAYO_UNO, { cobroEnLinea: true }));
    const carrito = texto(a, '/carrito/index.html');
    const formas = [...carrito.matchAll(/name="forma" value="([a-z_]+)"/g)].map((m) => m[1]);
    expect(formas[0]).toBe('en_linea');
    expect(carrito).toContain('<fieldset class="grupo" data-entrega hidden>');
    expect(carrito).toContain('autocomplete="tel"');
    expect(carrito).toContain('"enLinea":true');
    expect(a.has('/pedido/pago/index.html')).toBe(true);
  });

  it('❌ una que vende solo por WhatsApp no ofrece pagar en línea ni pide datos de entrega', async () => {
    const a = await hornear(paraHornear(ENSAYO_UNO));
    const carrito = texto(a, '/carrito/index.html');
    expect(carrito).not.toContain('value="en_linea"');
    expect(carrito).not.toContain('data-entrega');
    expect(a.has('/pedido/pago/index.html')).toBe(false);
  });
});
