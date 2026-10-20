/**
 * Los feeds de productos (HU-T14.5, TIENDA-3.0 §10.1 y §11): `/feeds/google.xml` (listados
 * gratuitos de Google Merchant Center), `/feeds/meta.csv` (el catálogo de Meta para Instagram,
 * Facebook y WhatsApp) y `/feeds/productos.jsonl` (el feed de productos para agentes, con los campos
 * del Agentic Commerce Protocol). Cada uno solo si el comercio lo enciende en Ajustes › Agentes.
 *
 * - Una fila por combinación, agrupadas por producto (`item_group_id`), con la disponibilidad del
 *   inventario de ahora: el re-horneado de existencias (HU-T4.5) los vuelve a escribir.
 * - **Lo que no se puede anunciar no sale (CA2):** un producto sin foto, o una combinación sin
 *   precio, queda fuera, y `fueraDeLosFeeds` dice por qué para el panel.
 * - Los campos obligatorios de cada destino están en `CAMPOS_OBLIGATORIOS`, y la prueba revisa cada
 *   fila contra ellos.
 *
 * Puro: sin red, sin reloj. Los mismos datos dan los mismos bytes (HU-T4.1).
 */
import { escaparHtml } from './escapar.ts';
import type { ProductoParaHornear, TiendaParaHornear, VarianteParaHornear } from './horno.ts';

export interface FeedsEncendidos {
  google: boolean;
  meta: boolean;
  agentes: boolean;
}

/**
 * Los campos que cada destino exige en cada fila:
 * - Google: la especificación de datos de productos de Merchant Center (`g:` en RSS 2.0);
 * - Meta: los campos obligatorios del archivo de catálogo de Commerce Manager;
 * - agentes: los obligatorios del Product Feed Spec del Agentic Commerce Protocol.
 */
export const CAMPOS_OBLIGATORIOS = {
  google: [
    'g:id',
    'g:title',
    'g:description',
    'g:link',
    'g:image_link',
    'g:availability',
    'g:price',
    'g:condition',
    'g:brand',
  ],
  meta: [
    'id',
    'title',
    'description',
    'availability',
    'condition',
    'price',
    'link',
    'image_link',
    'brand',
  ],
  agentes: [
    'enable_search',
    'enable_checkout',
    'id',
    'title',
    'description',
    'link',
    'image_link',
    'price',
    'availability',
    'inventory_quantity',
    'seller_name',
    'seller_url',
  ],
} as const;

/** Por qué un producto o una combinación no sale en los feeds, en palabras del panel. */
export interface FueraDelFeed {
  slug: string;
  nombre: string;
  motivo: string;
}

const ANCHO_DE_LA_FOTO = 800;

/** Lo que de este catálogo no sale en los feeds, y por qué (CA2). */
export function fueraDeLosFeeds(
  t: Pick<TiendaParaHornear, 'productos' | 'medios' | 'org'>,
): FueraDelFeed[] {
  const fuera: FueraDelFeed[] = [];
  for (const p of [...t.productos].sort((a, b) => (a.slug < b.slug ? -1 : 1))) {
    if (!fotoDe(t, p)) fuera.push({ slug: p.slug, nombre: p.nombre, motivo: 'no tiene foto' });
    else if (p.variantes.every((v) => !(v.precioCop > 0)))
      fuera.push({ slug: p.slug, nombre: p.nombre, motivo: 'no tiene precio' });
  }
  return fuera;
}

function fotoDe(
  t: Pick<TiendaParaHornear, 'medios' | 'org'>,
  p: ProductoParaHornear,
): string | null {
  const f = p.fotos?.[0];
  if (!f || !t.medios || !t.org || f.anchos.length === 0) return null;
  const ancho = f.anchos.includes(ANCHO_DE_LA_FOTO) ? ANCHO_DE_LA_FOTO : Math.max(...f.anchos);
  return `https://${t.medios}/${t.org}/${f.huella}/${ancho}.${f.formato ?? 'webp'}`;
}

interface Fila {
  id: string;
  grupo: string;
  titulo: string;
  descripcion: string;
  enlace: string;
  imagen: string;
  disponible: boolean;
  cantidad: number;
  precioCop: number;
}

/** Las filas que salen: una por combinación con precio, de un producto con foto. */
function filas(t: TiendaParaHornear): Fila[] {
  const url = (ruta: string) => `https://${t.dominio}${ruta}`;
  const fuera = new Set(fueraDeLosFeeds(t).map((f) => f.slug));
  return [...t.productos]
    .sort((a, b) => (a.slug < b.slug ? -1 : 1))
    .filter((p) => !fuera.has(p.slug))
    .flatMap((p) => {
      const imagen = fotoDe(t, p) ?? '';
      const descripcion = (p.descripcion?.trim() || p.nombre).replace(/\s+/g, ' ').slice(0, 4900);
      return [...p.variantes]
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .filter((v) => v.precioCop > 0)
        .map((v: VarianteParaHornear) => ({
          id: v.id,
          grupo: p.slug,
          titulo: (v.clave ? `${p.nombre} · ${v.clave.replaceAll('|', ' · ')}` : p.nombre).slice(
            0,
            150,
          ),
          descripcion,
          enlace: url(`/p/${p.slug}/`),
          imagen,
          disponible: v.stock === null || v.stock > 0,
          // Sin inventario llevado, una unidad: el agente sabe que hay, no cuántas.
          cantidad: v.stock === null ? 1 : Math.max(0, v.stock),
          precioCop: v.precioCop,
        }));
    });
}

const precio = (cop: number) => `${cop} COP`;

/** Google Merchant Center: RSS 2.0 con el espacio de nombres `g:`. */
export function feedDeGoogle(t: TiendaParaHornear): string {
  const items = filas(t).map((f) =>
    [
      '<item>',
      `<g:id>${escaparHtml(f.id)}</g:id>`,
      `<g:item_group_id>${escaparHtml(f.grupo)}</g:item_group_id>`,
      `<g:title>${escaparHtml(f.titulo)}</g:title>`,
      `<g:description>${escaparHtml(f.descripcion)}</g:description>`,
      `<g:link>${escaparHtml(f.enlace)}</g:link>`,
      `<g:image_link>${escaparHtml(f.imagen)}</g:image_link>`,
      `<g:availability>${f.disponible ? 'in_stock' : 'out_of_stock'}</g:availability>`,
      `<g:price>${precio(f.precioCop)}</g:price>`,
      '<g:condition>new</g:condition>',
      `<g:brand>${escaparHtml(t.nombre)}</g:brand>`,
      '<g:identifier_exists>no</g:identifier_exists>',
      '</item>',
    ].join(''),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n<title>${escaparHtml(t.nombre)}</title>\n<link>${escaparHtml(`https://${t.dominio}/`)}</link>\n<description>${escaparHtml(t.frase ?? t.nombre)}</description>\n${items.join('\n')}${items.length ? '\n' : ''}</channel>\n</rss>\n`;
}

/** Un campo de CSV: entre comillas si lleva coma, comilla o salto, con las comillas dobladas. */
const csv = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

/** El archivo de catálogo de Meta (Commerce Manager), en CSV. */
export function feedDeMeta(t: TiendaParaHornear): string {
  const columnas = [...CAMPOS_OBLIGATORIOS.meta, 'item_group_id'] as const;
  const lineas = filas(t).map((f) =>
    [
      f.id,
      f.titulo,
      f.descripcion,
      f.disponible ? 'in stock' : 'out of stock',
      'new',
      precio(f.precioCop),
      f.enlace,
      f.imagen,
      t.nombre,
      f.grupo,
    ]
      .map(csv)
      .join(','),
  );
  return `${[columnas.join(','), ...lineas].join('\n')}\n`;
}

/** El feed para agentes: una línea JSON por combinación, con los campos del ACP. */
export function feedDeAgentes(t: TiendaParaHornear): string {
  const tienda = `https://${t.dominio}/`;
  return filas(t)
    .map((f) =>
      JSON.stringify({
        enable_search: true,
        // Comprar por el agente llega con el MCP del comercio (M7): hoy, solo se encuentra.
        enable_checkout: false,
        id: f.id,
        item_group_id: f.grupo,
        title: f.titulo,
        description: f.descripcion,
        link: f.enlace,
        image_link: f.imagen,
        price: precio(f.precioCop),
        availability: f.disponible ? 'in_stock' : 'out_of_stock',
        inventory_quantity: f.cantidad,
        condition: 'new',
        brand: t.nombre,
        seller_name: t.nombre,
        seller_url: tienda,
        return_policy: `${tienda}legal/retracto/`,
      }),
    )
    .map((l) => `${l}\n`)
    .join('');
}

/** Los archivos de los feeds encendidos, con su ruta y su tipo. */
export function archivosDeLosFeeds(
  t: TiendaParaHornear,
  encendidos: FeedsEncendidos | undefined,
): { ruta: string; tipo: 'xml' | 'csv' | 'jsonl'; contenido: string }[] {
  if (!encendidos) return [];
  return [
    ...(encendidos.google
      ? [{ ruta: '/feeds/google.xml', tipo: 'xml' as const, contenido: feedDeGoogle(t) }]
      : []),
    ...(encendidos.meta
      ? [{ ruta: '/feeds/meta.csv', tipo: 'csv' as const, contenido: feedDeMeta(t) }]
      : []),
    ...(encendidos.agentes
      ? [{ ruta: '/feeds/productos.jsonl', tipo: 'jsonl' as const, contenido: feedDeAgentes(t) }]
      : []),
  ];
}
