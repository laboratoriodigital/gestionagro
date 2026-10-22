/**
 * HU-T14.5: los feeds de Google, Meta y agentes. Cada fila se revisa contra los campos obligatorios
 * de su destino (CA2), y lo que no se puede anunciar queda fuera con su motivo. Ningún dato real.
 */
import { describe, expect, it } from 'vitest';
import {
  CAMPOS_OBLIGATORIOS,
  feedDeAgentes,
  feedDeGoogle,
  feedDeMeta,
  fueraDeLosFeeds,
} from './feeds.ts';
import { hornear, type TiendaParaHornear } from './horno.ts';
import { ACENTOS_DE_LA_VITRINA } from './tema.ts';

const foto = {
  huella: 'b'.repeat(64),
  alt: 'Camisa',
  ancho: 1600,
  alto: 2000,
  anchos: [400, 800, 1600],
};

const tienda = (extra: Partial<TiendaParaHornear> = {}): TiendaParaHornear => ({
  dominio: 'ensayo-uno--staging.mitiendapro.co',
  release: 'r1',
  org: 'org-ensayo',
  medios: 'img--staging.laboratorio-digital.app',
  nombre: 'Comercio Ensayo Uno',
  frase: 'Ropa de lino, "hecha" despacio, & a mano.',
  apariencia: {
    acento: ACENTOS_DE_LA_VITRINA.cobre,
    tinta: 'azul',
    estilo: 'editorial',
    portada: 'editorial',
    proporcion: '4:5',
    modo: 'telefono',
  },
  agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
  productos: [
    {
      slug: 'camisa-de-lino',
      nombre: 'Camisa de lino',
      descripcion: 'Lino lavado, fresco.\nTalla real, y "cómoda".',
      opciones: [{ nombre: 'Talla', valores: ['S', 'M'] }],
      variantes: [
        { id: 'v-camisa-m', clave: 'M', precioCop: 129000, stock: 0 },
        { id: 'v-camisa-s', clave: 'S', precioCop: 129000, stock: 3 },
      ],
      actualizado: '2026-10-20T15:00:00.000Z',
      fotos: [foto],
    },
    {
      slug: 'pan-de-bono',
      nombre: 'Pan de bono',
      opciones: [],
      variantes: [{ id: 'v-pan', clave: '', precioCop: 1500, stock: null }],
      actualizado: '2026-10-20T15:00:00.000Z',
      fotos: [{ ...foto, huella: 'c'.repeat(64), anchos: [400], formato: 'jpeg' }],
    },
    {
      slug: 'sin-foto',
      nombre: 'Gorra sin foto',
      opciones: [],
      variantes: [{ id: 'v-gorra', clave: '', precioCop: 40000, stock: 5 }],
      actualizado: '2026-10-20T15:00:00.000Z',
    },
    {
      slug: 'sin-precio',
      nombre: 'Muestra gratis',
      opciones: [],
      variantes: [{ id: 'v-muestra', clave: '', precioCop: 0, stock: 5 }],
      actualizado: '2026-10-20T15:00:00.000Z',
      fotos: [foto],
    },
  ],
  ...extra,
});

/** Las filas de un CSV, respetando las comillas. */
function leerCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entre = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entre) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') entre = false;
      else campo += c;
    } else if (c === '"') entre = true;
    else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n') {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  return filas;
}

describe('lo que no se puede anunciar queda fuera (HU-T14.5 CA2)', () => {
  it('sin foto o sin precio, con su motivo para el panel', () => {
    expect(fueraDeLosFeeds(tienda())).toEqual([
      { slug: 'sin-foto', nombre: 'Gorra sin foto', motivo: 'no tiene foto' },
      { slug: 'sin-precio', nombre: 'Muestra gratis', motivo: 'no tiene precio' },
    ]);
    // ❌ Sin el host de las fotos, ninguna foto se puede enlazar: todo queda fuera.
    expect(fueraDeLosFeeds(tienda({ medios: undefined as unknown as string })).length).toBe(4);
  });
});

describe('Google Merchant Center', () => {
  it('un item por combinación, con cada campo obligatorio y el XML escapado', () => {
    const xml = feedDeGoogle(tienda());
    const items = xml.match(/<item>.*?<\/item>/g) ?? [];
    expect(items).toHaveLength(3);
    for (const item of items) {
      for (const campo of CAMPOS_OBLIGATORIOS.google) {
        expect(item, campo).toMatch(new RegExp(`<${campo}>[^<]+</${campo}>`));
      }
    }
    expect(items[0]).toContain('<g:availability>out_of_stock</g:availability>');
    expect(items[0]).toContain('<g:price>129000 COP</g:price>');
    expect(items[0]).toContain('<g:item_group_id>camisa-de-lino</g:item_group_id>');
    expect(items[0]).toContain(
      '<g:image_link>https://img--staging.laboratorio-digital.app/org-ensayo/' +
        `${'b'.repeat(64)}/800.webp</g:image_link>`,
    );
    // El pan no lleva inventario: hay. Su foto solo tiene 400 px, en JPEG.
    expect(items[2]).toContain('<g:availability>in_stock</g:availability>');
    expect(items[2]).toContain(`${'c'.repeat(64)}/400.jpeg`);
    expect(xml).toContain('&quot;hecha&quot; despacio, &amp; a mano');
    expect(xml).not.toContain('sin-foto');
  });
});

describe('el catálogo de Meta', () => {
  it('CSV con las columnas obligatorias, las comillas dobladas y los saltos dentro del campo', () => {
    const [encabezado, ...filas] = leerCsv(feedDeMeta(tienda()));
    expect(encabezado).toEqual([...CAMPOS_OBLIGATORIOS.meta, 'item_group_id']);
    expect(filas).toHaveLength(3);
    for (const f of filas) {
      expect(f).toHaveLength(encabezado?.length ?? 0);
      expect(f.every((v) => v.length > 0)).toBe(true);
    }
    const camisa = Object.fromEntries((encabezado ?? []).map((k, i) => [k, filas[1]?.[i]]));
    expect(camisa).toMatchObject({
      id: 'v-camisa-s',
      title: 'Camisa de lino · S',
      availability: 'in stock',
      price: '129000 COP',
      brand: 'Comercio Ensayo Uno',
    });
    expect(camisa['description']).toBe('Lino lavado, fresco. Talla real, y "cómoda".');
  });
});

describe('el feed para agentes (ACP)', () => {
  it('una línea JSON por combinación, con los obligatorios y sin vender por el agente todavía', () => {
    const lineas = feedDeAgentes(tienda()).trim().split('\n');
    expect(lineas).toHaveLength(3);
    for (const l of lineas) {
      const o = JSON.parse(l) as Record<string, unknown>;
      for (const campo of CAMPOS_OBLIGATORIOS.agentes) expect(o, campo).toHaveProperty(campo);
      expect(o['enable_checkout']).toBe(false);
    }
    expect(JSON.parse(lineas[0] ?? '{}')).toMatchObject({
      inventory_quantity: 0,
      availability: 'out_of_stock',
    });
    expect(JSON.parse(lineas[2] ?? '{}')).toMatchObject({
      inventory_quantity: 1,
      title: 'Pan de bono',
    });
  });
});

describe('en el horno', () => {
  it('solo los encendidos, y ninguno si el comercio no dijo nada', async () => {
    const sinFeeds = await hornear(tienda());
    expect([...sinFeeds.keys()].filter((r) => r.startsWith('/feeds/'))).toEqual([]);
    const conDos = await hornear(tienda({ feeds: { google: true, meta: false, agentes: true } }));
    expect([...conDos.keys()].filter((r) => r.startsWith('/feeds/')).sort()).toEqual([
      '/feeds/google.xml',
      '/feeds/productos.jsonl',
    ]);
    expect(conDos.get('/feeds/google.xml')?.tipo).toBe('application/xml');
  });
});
