/**
 * HU-T5.2: la portada, la colección y la ficha con el diseño de la vitrina. Las tres portadas de
 * `apariencia` (CA1); lo que la ley pide decir antes de comprar (CA2); las fotos con sus derivadas,
 * sus medidas y una sola con prioridad (CA3); y sin JavaScript, la ficha se lee entera (CA4).
 */
import { describe, expect, it } from 'vitest';
import { crearDespacho, type Env } from '../../apps/tienda-sitio/src/worker.ts';
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

const foto = (letra: string, anchos: number[] = [400, 800, 1600]): FotoParaHornear => ({
  huella: letra.repeat(64),
  alt: '',
  ancho: 1600,
  alto: 1600,
  anchos,
});

const producto = (slug: string, extra: Partial<ProductoParaHornear> = {}): ProductoParaHornear => ({
  slug,
  nombre: `Producto ${slug}`,
  opciones: [],
  variantes: [{ id: `v-${slug}`, clave: '', precioCop: 50000, stock: 3 }],
  actualizado: '2026-10-14T15:00:00.000Z',
  fotos: [foto('a'), foto('b')],
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
  colecciones: [{ slug: 'verano', nombre: 'Verano', productos: ['tres'] }],
  ...extra,
});
const html = async (t: TiendaParaHornear, ruta: string) =>
  (await hornear(t)).get(ruta)?.contenido ?? '';
const main = (h: string) => h.slice(h.indexOf('<main>'), h.indexOf('</main>'));

describe('las tres portadas (CA1)', () => {
  it('catálogo: el nombre y todos los productos; la primera foto con prioridad', async () => {
    const h = main(await html(tienda(), '/index.html'));
    expect(h).toContain('<h1>Comercio Ensayo Uno</h1>');
    expect(h.match(/class="tarjeta"/g)).toHaveLength(3);
    expect(h.match(/fetchpriority="high"/g)).toHaveLength(1);
  });

  it('editorial: el destacado grande arriba, con prioridad, y los demás debajo', async () => {
    const t = tienda();
    const h = main(
      await html({ ...t, apariencia: { ...t.apariencia, portada: 'editorial' } }, '/index.html'),
    );
    expect(h).toMatch(/portada-editorial__producto" href="\/p\/dos\/"/);
    expect(h).toContain('Ver Producto dos');
    expect(h.match(/class="tarjeta"/g)).toHaveLength(2);
    expect(h.match(/fetchpriority="high"/g)).toHaveLength(1);
  });

  it('colecciones: primero las colecciones; sin colecciones, es la de catálogo', async () => {
    const t = tienda();
    const conColecciones = {
      ...t,
      apariencia: { ...t.apariencia, portada: 'colecciones' as const },
    };
    const h = main(await html(conColecciones, '/index.html'));
    expect(h.indexOf('class="colecciones"')).toBeLessThan(h.indexOf('class="productos"'));
    expect(h).toContain('<a href="/c/verano/">');
    const sin = main(await html({ ...conColecciones, colecciones: [] }, '/index.html'));
    expect(sin).not.toContain('class="colecciones"');
    expect(sin.match(/class="tarjeta"/g)).toHaveLength(3);
  });
});

describe('la ficha dice lo que la ley pide antes de comprar (CA2)', () => {
  it('el precio final, cada envío con su plazo y el retracto', async () => {
    const legal = {
      ...legalDeEnsayo(ENSAYO_UNO),
      responsableIva: true,
      envios: [
        { nombre: 'Medellín', precioCop: 8000, gratisDesdeCop: 150000, diasMin: 1, diasMax: 2 },
        { nombre: 'Nacional', precioCop: 15000, gratisDesdeCop: null, diasMin: null, diasMax: 5 },
      ],
    };
    const h = await html(tienda({ legal }), '/p/uno/index.html');
    expect(h).toContain('<p class="precio__nota">Precio final, con IVA incluido.</p>');
    expect(h).toContain('Envío Medellín: $8.000, gratis desde $150.000; llega en 1 a 2 días.');
    expect(h).toContain('Envío Nacional: $15.000; llega en 5 días.');
    expect(h).toContain('Puedes retractarte de la compra en los 5 días hábiles siguientes');
    const md = (await hornear(tienda({ legal }))).get('/p/uno/index.md')?.contenido ?? '';
    expect(md).toContain('## Antes de comprar');
    expect(md).toContain('- Envío Nacional: $15.000; llega en 5 días.');
  });

  it('❌ un envío de más de 30 días calendario lo dice en la ficha y en «Envíos» (HU-T10.1 CA1)', async () => {
    const legal = {
      ...legalDeEnsayo(ENSAYO_UNO),
      envios: [
        { nombre: 'Medellín', precioCop: 8000, gratisDesdeCop: null, diasMin: 1, diasMax: 2 },
        { nombre: 'Bodega', precioCop: 40000, gratisDesdeCop: null, diasMin: 35, diasMax: 45 },
      ],
    };
    const largo =
      'llega en 35 a 45 días calendario: más que los 30 de la ley, y es el plazo que aceptas al pedir.';
    const h = await html(tienda({ legal }), '/p/uno/index.html');
    expect(h).toContain(`Envío Bodega: $40.000; ${largo}`);
    expect(h).toContain('Envío Medellín: $8.000; llega en 1 a 2 días.');
    const envios =
      (await hornear(tienda({ legal }))).get('/legal/envios/index.md')?.contenido ?? '';
    expect(envios).toContain(`- Bodega: $40.000; ${largo}`);
    // Antes decía «llega en de 1 a 2 días».
    expect(envios).toContain('- Medellín: $8.000; llega en 1 a 2 días.');
  });

  it('❌ sin IVA declarado no promete «IVA incluido»; sin retracto, dice por qué', async () => {
    const t = tienda({
      productos: [producto('pan', { retracto: { aplica: false, motivo: 'Es perecedero' } })],
    });
    const h = await html(t, '/p/pan/index.html');
    expect(h).toContain('<p class="precio__nota">Precio final.</p>');
    expect(h).toContain('No admite retracto: Es perecedero.');
    expect(h).not.toContain('Puedes retractarte');
  });

  it('un producto solo para mayores pide confirmar la edad en la ficha', async () => {
    const t = tienda({ productos: [producto('vino', { soloMayores: true })] });
    const h = await html(t, '/p/vino/index.html');
    expect(h).toContain('<article class="ficha" data-solo-mayores>');
    expect(h).toContain('<input type="checkbox" name="mayor-de-edad" data-mayoria>');
    expect(h).toContain('Solo para mayores de edad.');
  });
});

describe('las fotos (CA3) y la ficha sin JavaScript (CA4)', () => {
  it('srcset de 400, 800 y 1600, medidas explícitas, y carga diferida salvo la primera', async () => {
    const todo = main(await html(tienda(), '/p/uno/index.html'));
    // Las miniaturas van aparte (validación del 20 oct 2026): sin texto propio, las nombra su enlace.
    const [h = '', miniaturas = ''] = todo.split('<nav class="ficha__miniaturas"');
    for (const img of miniaturas.match(/<img [^>]+>/g) ?? []) {
      expect(img).toContain('alt=""');
      expect(img).toContain('loading="lazy"');
    }
    expect(miniaturas.match(/aria-label="Foto \d de 2"/g)).toHaveLength(2);
    const imgs = h.match(/<img [^>]+>/g) ?? [];
    expect(imgs).toHaveLength(2);
    const base = `https://img.laboratorio-digital.app/${ENSAYO_UNO.org}/${'a'.repeat(64)}`;
    expect(imgs[0]).toContain(`src="${base}/800.webp"`);
    expect(imgs[0]).toContain(
      `srcset="${base}/400.webp 400w, ${base}/800.webp 800w, ${base}/1600.webp 1600w"`,
    );
    expect(imgs[0]).toContain('fetchpriority="high"');
    expect(imgs[1]).toContain('loading="lazy"');
    for (const img of imgs) {
      expect(img).toMatch(/ width="\d+" height="\d+"/);
      expect(img).toContain('alt="Producto uno"');
    }
  });

  it('una foto pequeña ofrece solo los anchos que tiene', async () => {
    const t = tienda({ productos: [producto('chica', { fotos: [foto('c', [400])] })] });
    const img = (await html(t, '/p/chica/index.html')).match(/<img [^>]+>/)?.[0] ?? '';
    expect(img).toContain('/400.webp" srcset="');
    expect(img).not.toContain('800w');
  });

  it('❌ sin host de fotos, el marco vacío: nunca una URL a medias', async () => {
    const { medios: _, ...sinHost } = tienda();
    const h = await html(sinHost, '/p/uno/index.html');
    expect(h).not.toContain('<img');
    expect(h).toContain('<div class="ficha__foto" aria-hidden="true"></div>');
  });

  it('❌ sin JavaScript la ficha se lee entera: nombre, precio, opciones y condiciones están en el HTML', async () => {
    const h = main(await html(tienda(), '/p/uno/index.html'));
    const visible = h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
    for (const texto of ['Producto uno', '$50.000', 'Precio final.', 'retractarte']) {
      expect(visible).toContain(texto);
    }
  });
});

describe('la CSP del despacho permite solo las fotos de su destino', () => {
  it('img-src lleva el host de MEDIOS, y nada más de afuera', async () => {
    const env: Env = {
      MEDIOS: 'img--staging.laboratorio-digital.app',
      TIENDA_HOSTS: { get: async () => null },
    };
    const r = await crearDespacho().fetch(
      new Request(`https://${hostDeStaging(ENSAYO_UNO.slug)}/.well-known/security.txt`),
      {
        ...env,
        TIENDA_HOSTS: {
          get: async () =>
            JSON.stringify({ org: 'o', celda: 'c1', shard: 'tienda_c1_s1', version: 1 }),
        },
      },
    );
    const csp = r.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("img-src 'self' https://img--staging.laboratorio-digital.app data:");
    expect(csp).not.toContain('https://img.laboratorio-digital.app');
  });
});
