/**
 * Sprint T17b (validación de la vitrina del 20 oct 2026): el precio agrupado (HU-T5.8), compartir
 * y la foto de cada combinación (HU-T5.9), destacado y nuevo (HU-T5.10), las categorías (HU-T5.11),
 * buscar y el pedido en la franja con «Ordenar por» (HU-T5.12), el logo y el ícono (HU-T5.13) y la
 * bienvenida de la portada (HU-T5.14).
 */
import { describe, expect, it } from 'vitest';
import {
  type FotoParaHornear,
  hornear,
  type ProductoParaHornear,
  type TiendaParaHornear,
} from '../../packages/tienda-horno/src/index.ts';
import {
  ENSAYO_UNO,
  hostDeStaging,
  legalDeEnsayo,
} from '../../packages/tienda-schema/src/ensayos.ts';

const foto = (letra: string, extra: Partial<FotoParaHornear> = {}): FotoParaHornear => ({
  huella: letra.repeat(64),
  alt: '',
  ancho: 1600,
  alto: 1600,
  anchos: [400, 800, 1600],
  ...extra,
});

const producto = (slug: string, extra: Partial<ProductoParaHornear> = {}): ProductoParaHornear => ({
  slug,
  nombre: `Producto ${slug}`,
  opciones: [],
  variantes: [{ id: `v-${slug}`, clave: '', precioCop: 50000, stock: 3 }],
  actualizado: '2026-10-14T15:00:00.000Z',
  fotos: [foto('a')],
  ...extra,
});

const tienda = (extra: Partial<TiendaParaHornear> = {}): TiendaParaHornear => ({
  dominio: hostDeStaging(ENSAYO_UNO.slug),
  release: 'r1',
  org: ENSAYO_UNO.org,
  medios: 'img.laboratorio-digital.app',
  nombre: ENSAYO_UNO.nombre,
  apariencia: {
    acento: '#9c4a1a',
    tinta: 'negra',
    estilo: 'precision',
    portada: 'catalogo',
    proporcion: '1:1',
    modo: 'claro',
  },
  agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
  legal: legalDeEnsayo(ENSAYO_UNO),
  productos: [producto('uno'), producto('dos', { destacado: true }), producto('tres')],
  colecciones: [{ slug: 'verano', nombre: 'Verano', productos: ['tres', 'uno'] }],
  ...extra,
});
const html = async (t: TiendaParaHornear, ruta: string) =>
  (await hornear(t)).get(ruta)?.contenido ?? '';
const main = (h: string) => h.slice(h.indexOf('<main>'), h.indexOf('</main>'));
const slugsDe = (h: string) =>
  [...h.matchAll(/<li class="tarjeta"[^>]*><a href="\/p\/([^/]+)\//g)].map((m) => m[1]);

describe('la ficha: el precio, compartir y la foto de la combinación (HU-T5.8 y HU-T5.9)', () => {
  it('el precio, el de antes y su nota van en un bloque, antes de lo que queda', async () => {
    const p = producto('uno', {
      variantes: [{ id: 'v-uno', clave: '', precioCop: 50000, precioAntesCop: 70000, stock: 2 }],
    });
    const h = main(await html(tienda({ productos: [p] }), '/p/uno/index.html'));
    const bloque = h.slice(h.indexOf('<div class="ficha__precio">'));
    expect(bloque.indexOf('$50.000')).toBeLessThan(bloque.indexOf('</div>'));
    expect(bloque.indexOf('$70.000')).toBeLessThan(bloque.indexOf('</div>'));
    expect(bloque.indexOf('precio__nota')).toBeLessThan(bloque.indexOf('</div>'));
  });

  it('compartir: sin JavaScript abre WhatsApp con el nombre y la dirección del producto', async () => {
    const h = await html(tienda(), '/p/uno/index.html');
    const url = `https://${hostDeStaging(ENSAYO_UNO.slug)}/p/uno/`;
    expect(h).toContain(`href="https://wa.me/?text=${encodeURIComponent(`Producto uno ${url}`)}"`);
    expect(h).toContain(`data-compartir="${url}"`);
    expect(h).toContain('data-compartir-titulo="Producto uno"');
  });

  it('cada combinación lleva el lugar de su foto en la galería; sin foto propia, no', async () => {
    const p = producto('camisa', {
      opciones: [{ nombre: 'Color', valores: ['Azul', 'Rojo'] }],
      variantes: [
        { id: 'v-azul', clave: 'Azul', precioCop: 50000, stock: 3 },
        { id: 'v-rojo', clave: 'Rojo', precioCop: 50000, stock: 3 },
      ],
      fotos: [foto('a'), foto('b', { variante: 'v-rojo' })],
    });
    const h = await html(tienda({ productos: [p] }), '/p/camisa/index.html');
    const datos = h.match(/<script type="application\/json" id="variantes">([^<]+)<\/script>/)?.[1];
    const { variantes } = JSON.parse(datos ?? '{}') as {
      variantes: { id: string; foto?: number }[];
    };
    expect(variantes.find((v) => v.id === 'v-rojo')?.foto).toBe(1);
    expect(variantes.find((v) => v.id === 'v-azul')).not.toHaveProperty('foto');
  });
});

describe('destacado, nuevo y el orden (HU-T5.10 y HU-T5.12)', () => {
  it('lo destacado va primero en la portada y en su categoría', async () => {
    const t = tienda({
      productos: [producto('uno'), producto('dos'), producto('tres', { destacado: true })],
    });
    const archivos = await hornear(t);
    expect(slugsDe(main(archivos.get('/index.html')?.contenido ?? ''))).toEqual([
      'tres',
      'uno',
      'dos',
    ]);
    expect(slugsDe(main(archivos.get('/c/verano/index.html')?.contenido ?? ''))).toEqual([
      'tres',
      'uno',
    ]);
  });

  it('con más de los que caben en la portada, «Todos los productos» también empieza por lo destacado', async () => {
    const muchos = Array.from({ length: 30 }, (_, i) =>
      producto(`p${String(i).padStart(2, '0')}`, i === 29 ? { destacado: true } : {}),
    );
    const archivos = await hornear(tienda({ productos: muchos, colecciones: [] }));
    expect(slugsDe(main(archivos.get('/productos/index.html')?.contenido ?? ''))[0]).toBe('p29');
  });

  it('nuevo lleva su etiqueta en la tarjeta y en la ficha', async () => {
    const t = tienda({ productos: [producto('uno', { nuevo: true }), producto('dos')] });
    const archivos = await hornear(t);
    const portada = main(archivos.get('/index.html')?.contenido ?? '');
    expect(portada.match(/<span class="etiqueta-nuevo">Nuevo<\/span>/g)).toHaveLength(1);
    expect(portada).toMatch(/data-nuevo><a href="\/p\/uno\/"/);
    expect(archivos.get('/p/uno/index.html')?.contenido).toContain(
      '<p class="etiqueta-nuevo">Nuevo</p>',
    );
    expect(archivos.get('/p/dos/index.html')?.contenido).not.toContain('etiqueta-nuevo');
  });

  it('«Ordenar por» con sus cinco opciones, y cada tarjeta con lo que se ordena', async () => {
    const h = main(await html(tienda(), '/index.html'));
    expect(h).toContain('<label class="ordenar" data-ordenar hidden>');
    for (const o of ['recomendado', 'nuevo', 'nombre', 'menor', 'mayor']) {
      expect(h).toContain(`<option value="${o}">`);
    }
    expect(h).toMatch(
      /<li class="tarjeta" data-orden="0" data-nombre="producto dos" data-precio="50000" data-fecha="2026-10-14T15:00:00.000Z">/,
    );
  });

  it('❌ con un solo producto no hay nada que ordenar', async () => {
    const h = main(await html(tienda({ productos: [producto('uno')] }), '/index.html'));
    expect(h).not.toContain('data-ordenar');
  });
});

describe('las categorías, buscar y el pedido (HU-T5.11 y HU-T5.12)', () => {
  it('la portada ofrece «Todo» y cada categoría; la de la página va marcada', async () => {
    const archivos = await hornear(tienda());
    const portada = archivos.get('/index.html')?.contenido ?? '';
    expect(portada).toContain(
      '<nav class="categorias" aria-label="Categorías"><a href="/" aria-current="page">Todo</a><a href="/c/verano/">Verano</a></nav>',
    );
    expect(archivos.get('/c/verano/index.html')?.contenido).toContain(
      '<a href="/c/verano/" aria-current="page">Verano</a>',
    );
  });

  it('❌ sin categorías no hay barra de categorías', async () => {
    expect(await html(tienda({ colecciones: [] }), '/index.html')).not.toContain(
      'class="categorias"',
    );
  });

  it('buscar y el pedido van arriba en la franja; la barra de abajo ya no está', async () => {
    const h = await html(tienda(), '/p/uno/index.html');
    const franja = h.slice(h.indexOf('<header class="franja">'), h.indexOf('</header>'));
    expect(franja).toContain('<form class="franja__buscar" action="/buscar/" role="search">');
    expect(franja).toContain('<input id="q-franja" name="q" type="search"');
    expect(franja).toContain('<a class="franja__pedido" href="/carrito/" data-pedido hidden>');
    expect(h).not.toContain('barra-pedido');
  });
});

describe('el logo, el ícono y la bienvenida (HU-T5.13 y HU-T5.14)', () => {
  const base = `https://img.laboratorio-digital.app/${ENSAYO_UNO.org}`;

  it('el logo reemplaza el nombre en la franja, con su nombre como texto y sus medidas', async () => {
    const logo = foto('c', { ancho: 800, alto: 200, anchos: [400, 800] });
    const h = await html(tienda({ logo }), '/index.html');
    expect(h).toContain(
      `<a class="marca" href="/"><img class="marca__logo" src="${base}/${'c'.repeat(64)}/400.webp" alt="Comercio Ensayo Uno" width="160" height="40"></a>`,
    );
  });

  it('el ícono va en la pestaña, al guardar en el teléfono y en el manifiesto', async () => {
    const icono = foto('d', { ancho: 512, alto: 512, anchos: [400] });
    const archivos = await hornear(tienda({ icono }));
    const src = `${base}/${'d'.repeat(64)}/400.webp`;
    const h = archivos.get('/index.html')?.contenido ?? '';
    expect(h).toContain(`<link rel="icon" href="${src}">`);
    expect(h).toContain(`<link rel="apple-touch-icon" href="${src}">`);
    const manifiesto = JSON.parse(archivos.get('/manifest.webmanifest')?.contenido ?? '{}') as {
      icons?: { src: string; sizes: string; type: string }[];
    };
    expect(manifiesto.icons).toEqual([{ src, sizes: '400x400', type: 'image/webp' }]);
  });

  it('❌ sin logo ni ícono: el nombre, y ningún ícono inventado', async () => {
    const archivos = await hornear(tienda());
    const h = archivos.get('/index.html')?.contenido ?? '';
    expect(h).toContain('<a class="marca" href="/">Comercio Ensayo Uno</a>');
    expect(h).not.toContain('rel="icon"');
    expect(archivos.get('/manifest.webmanifest')?.contenido).not.toContain('"icons"');
  });

  it('la bienvenida abre la portada: su imagen con prioridad, su título y su botón', async () => {
    const hero = {
      titulo: 'Ropa de lino',
      texto: 'Hecha en Medellín.',
      imagen: foto('e', { ancho: 1600, alto: 900 }),
    };
    const h = main(await html(tienda({ hero }), '/index.html'));
    expect(h.indexOf('<section class="hero">')).toBeLessThan(h.indexOf('class="productos"'));
    expect(h).toContain('<h1>Ropa de lino</h1>');
    expect(h).toContain('<p>Hecha en Medellín.</p>');
    expect(h).toContain(
      '<a class="boton boton--principal" href="#productos">Ver los productos</a>',
    );
    expect(h).toContain('<h2 id="productos">Productos</h2>');
    expect(h.match(/fetchpriority="high"/g)).toHaveLength(1);
    // La que tiene prioridad es la del hero, que va antes que las tarjetas.
    expect(h.indexOf('fetchpriority="high"')).toBeLessThan(h.indexOf('class="productos"'));
    expect(h.match(/<h1>/g)).toHaveLength(1);
  });

  it('❌ una bienvenida vacía no se muestra; sin título, lleva el nombre de la tienda', async () => {
    const vacia = main(await html(tienda({ hero: { boton: 'Entrar' } }), '/index.html'));
    expect(vacia).not.toContain('class="hero"');
    const sinTitulo = main(await html(tienda({ hero: { texto: 'Hola' } }), '/index.html'));
    expect(sinTitulo).toContain('<h1>Comercio Ensayo Uno</h1>');
    expect(sinTitulo).not.toContain('hero__foto');
  });
});
