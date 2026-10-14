/**
 * El horno (HU-T4.1, TIENDA-3.0 §10.1, §10.4 y §11.7): la tienda entera en archivos estáticos que se
 * leen sin ejecutar JavaScript. Funciones puras: los mismos datos dan los mismos bytes en Node y en
 * workerd, sin reloj, ni azar, ni `Intl` (P17). El `lastmod` del sitemap sale del dato.
 *
 * Lo que produce, por tienda: la portada, una ficha por producto y una página por colección, cada
 * una con su gemelo `.md`; `catalogo.json` y `catalogo.md`; `sitemap.xml`; `robots.txt` con las
 * señales para agentes; y el tema (`tema-<huella>.css`, HU-T3.2). En el HTML van el JSON-LD
 * (`Product` con un `Offer` por variante, `BreadcrumbList`, `Organization` y `WebSite` con
 * `SearchAction`), Open Graph y, si el comercio la configuró, la verificación de Google (HU-T14.8).
 *
 * Un dato vacío, entre corchetes o `undefined` no llega al HTML ni al JSON-LD: se omite (bitácora
 * ecommerce 31). Todo texto con el nombre del comercio sale de sus datos.
 */
import { formatearPesos } from '@ed1/dinero';
import { etiquetaDeVerificacionGoogle } from '@ed1/tienda-schema';
import { llmsTxt, manifiestoWeb, robotsDeLaTienda } from './agentes.ts';
import { escaparHtml, markdownPlano, markdownSeguro } from './escapar.ts';
import { type DatosLegales, TEXTOS_LEGALES, textosLegales } from './legal.ts';
import { type Apariencia, coloresDelTema, cssDelTema, fondoDelTema } from './tema.ts';
import { estadoDeLaEleccion } from './vitrina/seleccion.ts';

export interface VarianteParaHornear {
  id: string;
  clave: string;
  precioCop: number;
  stock: number | null;
}

export interface ProductoParaHornear {
  slug: string;
  nombre: string;
  descripcion?: string;
  opciones: { nombre: string; valores: string[] }[];
  variantes: VarianteParaHornear[];
  /** ISO 8601: el `lastmod` del sitemap. */
  actualizado: string;
}

export interface ColeccionParaHornear {
  slug: string;
  nombre: string;
  productos: string[];
}

export interface TiendaParaHornear {
  /** La dirección canónica, sin esquema: `ensayo-uno.laboratorio-digital.app`. */
  dominio: string;
  /** La versión de los archivos comunes de la vitrina (`/_t/<release>/`). */
  release: string;
  nombre: string;
  frase?: string;
  whatsapp?: string;
  correo?: string;
  apariencia: Apariencia;
  agentes: { search: 'yes' | 'no'; aiInput: 'yes' | 'no'; aiTrain: 'yes' | 'no' };
  googleVerificacion?: string;
  /** La ficha legal y lo que dicen los textos legales (HU-T7.1). Sin ella no hay textos: la compuerta no publica. */
  legal?: DatosLegales;
  productos: ProductoParaHornear[];
  colecciones?: ColeccionParaHornear[];
}

export interface ArchivoHorneado {
  tipo: string;
  contenido: string;
}

const TIPOS = {
  html: 'text/html; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  json: 'application/json',
  xml: 'application/xml',
  txt: 'text/plain; charset=utf-8',
  css: 'text/css; charset=utf-8',
  webmanifest: 'application/manifest+json',
} as const;

/** Los enlaces legales del pie, cortos para el teléfono (HU-T7.1). */
const ENLACE_DEL_PIE: Record<string, string> = {
  terminos: 'Términos',
  privacidad: 'Privacidad',
  envios: 'Envíos y devoluciones',
  retracto: 'Retracto',
  garantia: 'Garantía',
  solicitud: 'Solicitudes',
};
const SIGLA_DEL_DOCUMENTO = { NIT: 'NIT', CC: 'C.C.', CE: 'C.E.' } as const;

/** Un dato que se puede mostrar: ni vacío, ni entre corchetes, ni `undefined` (bitácora ecommerce 31). */
export function presente(valor: string | undefined | null): valor is string {
  if (valor === undefined || valor === null) return false;
  const t = valor.trim();
  return t !== '' && !/^\[.*\]$/.test(t) && t !== 'undefined' && t !== 'null';
}

/** JSON con las claves en orden y sin lo que no está: los mismos bytes siempre. */
export function jsonEstable(valor: unknown): string {
  const ordenar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(ordenar);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .flatMap((k) => {
            const x = (v as Record<string, unknown>)[k];
            if (x === undefined || (typeof x === 'string' && !presente(x))) return [];
            return [[k, ordenar(x)]];
          }),
      );
    }
    return v;
  };
  return JSON.stringify(ordenar(valor));
}

/** JSON-LD dentro de `<script>`: sin `<`, para que nada cierre la etiqueta. */
const jsonLd = (datos: unknown) =>
  `<script type="application/ld+json">${jsonEstable(datos).replace(/</g, '\\u003c')}</script>`;

/** La huella SHA-256 de un texto, en hexadecimal (WebCrypto: la misma en Node y en workerd). */
export async function huella(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const digesto = new Uint8Array(await crypto.subtle.digest('SHA-256', datos));
  return [...digesto].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const precioDesde = (p: ProductoParaHornear) => Math.min(...p.variantes.map((v) => v.precioCop));
/** «Desde» solo cuando las variantes cuestan distinto. */
const variaElPrecio = (p: ProductoParaHornear) =>
  new Set(p.variantes.map((v) => v.precioCop)).size > 1;
const disponible = (v: VarianteParaHornear) => v.stock === null || v.stock > 0;
const fecha = (iso: string) => iso.slice(0, 10);

interface Pagina {
  ruta: string;
  titulo: string;
  descripcion?: string;
  cuerpo: string;
  ld: unknown[];
  gemelo: string;
}

export async function hornear(t: TiendaParaHornear): Promise<Map<string, ArchivoHorneado>> {
  const url = (ruta: string) => `https://${t.dominio}${ruta}`;
  const productos = [...t.productos].sort((a, b) =>
    a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0,
  );
  const tema = cssDelTema(t.apariencia);
  const rutaTema = `/tema-${(await huella(tema)).slice(0, 16)}.css`;

  const organizacion = {
    '@type': 'Organization',
    name: t.nombre,
    url: url('/'),
    email: t.correo,
    telephone: t.whatsapp,
  };
  const migas = (items: [string, string][]) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([nombre, ruta], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: nombre,
      item: url(ruta),
    })),
  });

  // La identidad del comercio, siempre visible en el pie (Ley 1480 art. 50 lit. a; HU-T7.1).
  const ficha = t.legal;
  const datosDeIdentidad = [
    ficha?.razonSocial,
    ficha?.documento
      ? `${SIGLA_DEL_DOCUMENTO[ficha.documento.tipo]} ${ficha.documento.numero}`
      : undefined,
    ficha?.ciudad,
  ].filter(presente);
  const identidad =
    datosDeIdentidad.length > 0
      ? `\n<p class="pie__identidad">${datosDeIdentidad.map(escaparHtml).join(' · ')}</p>`
      : '';

  const documento = (p: Pagina) => {
    const verificacion =
      p.ruta === '/' && t.googleVerificacion
        ? `\n${etiquetaDeVerificacionGoogle(t.googleVerificacion)}`
        : '';
    const descripcion = presente(p.descripcion)
      ? `\n<meta name="description" content="${escaparHtml(p.descripcion)}">\n<meta property="og:description" content="${escaparHtml(p.descripcion)}">`
      : '';
    const gemelo = p.ruta === '/' ? '/index.md' : `${p.ruta}index.md`;
    return `<!doctype html>
<html lang="es-CO" data-estilo="${t.apariencia.estilo}" data-portada="${t.apariencia.portada}" data-modo="${t.apariencia.modo}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escaparHtml(p.titulo)}</title>${descripcion}
<link rel="canonical" href="${escaparHtml(url(p.ruta))}">
<link rel="alternate" type="text/markdown" href="${escaparHtml(gemelo)}">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escaparHtml(t.nombre)}">
<meta property="og:title" content="${escaparHtml(p.titulo)}">
<meta property="og:url" content="${escaparHtml(url(p.ruta))}">
<link rel="stylesheet" href="/_t/${escaparHtml(t.release)}/vitrina.css">
<link rel="stylesheet" href="${rutaTema}">${verificacion}
${p.ld.map(jsonLd).join('\n')}
</head>
<body>
<header class="franja"><a class="marca" href="/">${escaparHtml(t.nombre)}</a><a class="franja__buscar" href="/buscar/">Buscar</a></header>
<main>
${p.cuerpo}
</main>
<footer class="pie">
<p class="pie__nombre">${escaparHtml(t.nombre)}</p>${identidad}
<nav class="pie__enlaces" aria-label="Información legal">${TEXTOS_LEGALES.map((l) => `<a href="${l.ruta}">${escaparHtml(ENLACE_DEL_PIE[l.id] ?? l.titulo)}</a>`).join('')}</nav>
<p><a href="https://www.sic.gov.co" rel="nofollow">Superintendencia de Industria y Comercio</a></p>
<p><a href="mailto:abuse@laboratorio-digital.app">Reportar esta tienda</a></p>
</footer>
<a class="barra-pedido" href="/pedido/" data-pedido hidden>Tu pedido <span class="cifra" data-cantidad>0</span></a>
<script type="module" src="/_t/${escaparHtml(t.release)}/vitrina.js"></script>
</body>
</html>
`;
  };

  const archivos = new Map<string, ArchivoHorneado>();
  const poner = (ruta: string, tipo: keyof typeof TIPOS, contenido: string) =>
    archivos.set(ruta, { tipo: TIPOS[tipo], contenido });
  const pagina = (p: Pagina) => {
    const base = p.ruta === '/' ? '/index' : `${p.ruta}index`;
    poner(`${base}.html`, 'html', documento(p));
    poner(`${base}.md`, 'md', p.gemelo);
  };
  const tarjeta = (p: ProductoParaHornear) =>
    `<li class="tarjeta"><a href="/p/${escaparHtml(p.slug)}/"><span class="tarjeta__foto" aria-hidden="true"></span><span class="tarjeta__nombre">${escaparHtml(p.nombre)}</span><span class="precio">${variaElPrecio(p) ? 'Desde ' : ''}${formatearPesos(precioDesde(p))}</span></a></li>`;
  const lineaMd = (p: ProductoParaHornear) =>
    `- [${markdownPlano(p.nombre)}](/p/${p.slug}/): ${variaElPrecio(p) ? 'desde ' : ''}${formatearPesos(precioDesde(p))}`;

  // La portada.
  pagina({
    ruta: '/',
    titulo: t.nombre,
    ...(presente(t.frase) ? { descripcion: t.frase } : {}),
    cuerpo: [
      `<h1>${escaparHtml(t.nombre)}</h1>`,
      presente(t.frase) ? `<p class="frase">${escaparHtml(t.frase)}</p>` : '',
      productos.length > 0
        ? `<ul class="productos">${productos.map(tarjeta).join('')}</ul>`
        : '<p class="estado">Esta tienda todavía no tiene productos.</p>',
    ]
      .filter(Boolean)
      .join('\n'),
    ld: [
      { '@context': 'https://schema.org', ...organizacion },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: t.nombre,
        url: url('/'),
        potentialAction: {
          '@type': 'SearchAction',
          target: `${url('/buscar')}?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
    gemelo: [
      `# ${markdownPlano(t.nombre)}`,
      presente(t.frase) ? `\n${markdownPlano(t.frase)}` : '',
      '\n## Productos\n',
      ...productos.map(lineaMd),
      '',
    ]
      .filter((l) => l !== '')
      .join('\n')
      .concat('\n'),
  });

  /**
   * La ficha (HU-T3.4): la foto, el precio y la elección de la variante. Sin JavaScript se lee
   * entera; con él, el botón dice qué falta (`vitrina.ts`). Las variantes van como datos, no como
   * código: `<script type="application/json">` no se ejecuta.
   */
  const fichaHtml = (p: ProductoParaHornear, opcionesLista: string) => {
    const variantes = [...p.variantes]
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((v) => ({
        id: v.id,
        clave: v.clave,
        precioCop: v.precioCop,
        disponible: disponible(v),
      }));
    const inicial = estadoDeLaEleccion(p.opciones, variantes, {});
    const grupos = p.opciones
      .map(
        (o) =>
          `<fieldset class="opcion"><legend>${escaparHtml(o.nombre)}</legend><div class="pildoras">${o.valores
            .map(
              (v) =>
                `<label class="pildora"><input type="radio" name="${escaparHtml(o.nombre)}" value="${escaparHtml(v)}"><span>${escaparHtml(v)}</span></label>`,
            )
            .join('')}</div></fieldset>`,
      )
      .join('');
    return [
      '<article class="ficha">',
      '<div class="ficha__foto" aria-hidden="true"></div>',
      '<div class="ficha__datos">',
      `<h1>${escaparHtml(p.nombre)}</h1>`,
      `<p class="precio" data-precio>${variaElPrecio(p) ? 'Desde ' : ''}${formatearPesos(precioDesde(p))}</p>`,
      `<form class="eleccion" data-eleccion>${grupos}<p class="avisame" data-avisame hidden>Esta combinación está agotada.</p><button class="boton boton--principal" type="submit" data-boton aria-disabled="${inicial.tipo !== 'lista'}">${escaparHtml(inicial.texto)}</button></form>`,
      opcionesLista ? `<ul class="opciones">${opcionesLista}</ul>` : '',
      presente(p.descripcion)
        ? `<div class="descripcion">${markdownSeguro(p.descripcion)}</div>`
        : '',
      '</div>',
      `<script type="application/json" id="variantes">${jsonEstable({ opciones: p.opciones, variantes }).replace(/</g, '\\u003c')}</script>`,
      '</article>',
    ]
      .filter(Boolean)
      .join('\n');
  };

  // Una ficha por producto, con un Offer por variante.
  for (const p of productos) {
    const ruta = `/p/${p.slug}/`;
    const opciones = p.opciones
      .map((o) => `<li>${escaparHtml(o.nombre)}: ${o.valores.map(escaparHtml).join(', ')}</li>`)
      .join('');
    pagina({
      ruta,
      titulo: `${p.nombre} · ${t.nombre}`,
      ...(presente(p.descripcion)
        ? { descripcion: markdownPlano(p.descripcion).slice(0, 160) }
        : {}),
      cuerpo: fichaHtml(p, opciones),
      ld: [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: p.nombre,
          description: presente(p.descripcion) ? markdownPlano(p.descripcion) : undefined,
          url: url(ruta),
          brand: { '@type': 'Brand', name: t.nombre },
          offers: [...p.variantes]
            .sort((a, b) => (a.id < b.id ? -1 : 1))
            .map((v) => ({
              '@type': 'Offer',
              sku: v.id,
              name: presente(v.clave) ? v.clave.replaceAll('|', ' · ') : undefined,
              price: String(v.precioCop),
              priceCurrency: 'COP',
              availability: `https://schema.org/${disponible(v) ? 'InStock' : 'OutOfStock'}`,
              url: url(ruta),
            })),
        },
        migas([
          [t.nombre, '/'],
          [p.nombre, ruta],
        ]),
      ],
      gemelo: [
        `# ${markdownPlano(p.nombre)}`,
        '',
        `Precio: ${variaElPrecio(p) ? 'desde ' : ''}${formatearPesos(precioDesde(p))}`,
        ...(p.opciones.length > 0
          ? ['', ...p.opciones.map((o) => `- ${o.nombre}: ${o.valores.join(', ')}`)]
          : []),
        ...(presente(p.descripcion) ? ['', markdownPlano(p.descripcion)] : []),
        '',
      ].join('\n'),
    });
  }

  // Las colecciones.
  for (const c of [...(t.colecciones ?? [])].sort((a, b) => (a.slug < b.slug ? -1 : 1))) {
    const suyos = productos.filter((p) => c.productos.includes(p.slug));
    pagina({
      ruta: `/c/${c.slug}/`,
      titulo: `${c.nombre} · ${t.nombre}`,
      cuerpo: `<h1>${escaparHtml(c.nombre)}</h1>\n<ul class="productos">${suyos.map(tarjeta).join('')}</ul>`,
      ld: [
        migas([
          [t.nombre, '/'],
          [c.nombre, `/c/${c.slug}/`],
        ]),
      ],
      gemelo: `# ${markdownPlano(c.nombre)}\n\n${suyos.map(lineaMd).join('\n')}\n`,
    });
  }

  // Los textos legales (HU-T7.1), cada uno con su gemelo.
  const legales = t.legal ? textosLegales(t.legal) : [];
  for (const texto of legales) {
    pagina({
      ruta: texto.ruta,
      titulo: `${texto.titulo} · ${t.nombre}`,
      cuerpo: texto.html,
      ld: [
        migas([
          [t.nombre, '/'],
          [texto.titulo, texto.ruta],
        ]),
      ],
      gemelo: texto.markdown,
    });
  }

  // La búsqueda (HU-T5.3): la página está horneada; buscar ocurre en el teléfono, sobre el catálogo.
  const colecciones = [...(t.colecciones ?? [])].sort((a, b) => (a.slug < b.slug ? -1 : 1));
  pagina({
    ruta: '/buscar/',
    titulo: `Buscar · ${t.nombre}`,
    cuerpo: [
      '<h1>Buscar</h1>',
      '<form class="buscar" role="search" data-buscar><label for="q">¿Qué buscas?</label><input id="q" name="q" type="search" autocomplete="off"></form>',
      '<ul class="productos" data-resultados></ul>',
      `<div class="estado" data-sin-resultados hidden><p>No encontramos eso. Prueba con otra palabra, o sin tildes ni plurales.</p>${
        colecciones.length > 0
          ? `<ul>${colecciones.map((c) => `<li><a href="/c/${escaparHtml(c.slug)}/">${escaparHtml(c.nombre)}</a></li>`).join('')}</ul>`
          : ''
      }</div>`,
    ].join('\n'),
    ld: [],
    gemelo: `# Buscar en ${markdownPlano(t.nombre)}\n\nEl catálogo completo está en [/catalogo.md](/catalogo.md).\n`,
  });

  // El catálogo para agentes, el sitemap, robots y el tema.
  poner(
    '/catalogo.json',
    'json',
    `${jsonEstable({
      tienda: { nombre: t.nombre, url: url('/') },
      productos: productos.map((p) => ({
        slug: p.slug,
        nombre: p.nombre,
        url: url(`/p/${p.slug}/`),
        variantes: [...p.variantes]
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .map((v) => ({
            id: v.id,
            opciones: v.clave,
            precioCop: v.precioCop,
            disponible: disponible(v),
          })),
      })),
    })}\n`,
  );
  poner(
    '/catalogo.md',
    'md',
    `# Catálogo de ${markdownPlano(t.nombre)}\n\n${productos.map(lineaMd).join('\n')}\n`,
  );
  const ultima = productos
    .map((p) => p.actualizado)
    .sort()
    .at(-1);
  const urls = [
    ['/', ultima],
    ...productos.map((p) => [`/p/${p.slug}/`, p.actualizado] as const),
    ...[...(t.colecciones ?? [])]
      .sort((a, b) => (a.slug < b.slug ? -1 : 1))
      .map((c) => [`/c/${c.slug}/`, ultima] as const),
    ...legales.map((x) => [x.ruta, undefined] as const),
  ] as const;
  poner(
    '/sitemap.xml',
    'xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map(
        ([ruta, lastmod]) =>
          `<url><loc>${escaparHtml(url(ruta))}</loc>${lastmod ? `<lastmod>${fecha(lastmod)}</lastmod>` : ''}</url>`,
      )
      .join('\n')}\n</urlset>\n`,
  );
  // La capa para agentes (HU-T15.1): robots con las familias del ecosistema y las señales de esta
  // tienda, llms.txt con los gemelos y el manifiesto de la app web.
  poner('/robots.txt', 'txt', robotsDeLaTienda(t.agentes, url('').replace(/\/$/, '')));
  poner(
    '/llms.txt',
    'txt',
    llmsTxt({
      nombre: markdownPlano(t.nombre),
      ...(presente(t.frase) ? { frase: markdownPlano(t.frase) } : {}),
      secciones: [
        {
          titulo: 'Productos',
          enlaces: productos.map((p) => ({
            titulo: markdownPlano(p.nombre),
            ruta: `/p/${p.slug}/index.md`,
            nota: `${variaElPrecio(p) ? 'desde ' : ''}${formatearPesos(precioDesde(p))}`,
          })),
        },
        {
          titulo: 'Colecciones',
          enlaces: colecciones.map((c) => ({
            titulo: markdownPlano(c.nombre),
            ruta: `/c/${c.slug}/index.md`,
          })),
        },
        {
          titulo: 'Políticas',
          enlaces: legales.map((x) => ({ titulo: x.titulo, ruta: `${x.ruta}index.md` })),
        },
        {
          titulo: 'Opcional',
          enlaces: [
            { titulo: 'Catálogo completo', ruta: '/catalogo.md', nota: 'precios y variantes' },
          ],
        },
      ],
    }),
  );
  const colores = coloresDelTema(t.apariencia);
  poner(
    '/manifest.webmanifest',
    'webmanifest',
    manifiestoWeb({
      nombre: t.nombre,
      ...(presente(t.frase) ? { frase: t.frase } : {}),
      color: t.apariencia.modo === 'oscuro' ? colores.oscuro.acento : colores.claro.acento,
      fondo: fondoDelTema(t.apariencia),
    }),
  );
  poner(rutaTema, 'css', tema);
  return archivos;
}

/**
 * El manifiesto de una versión (TIENDA §5.6): la huella, el tipo y los bytes de cada archivo, y la
 * huella del conjunto. Un archivo idéntico tiene la misma huella en todas las versiones.
 */
export async function manifiesto(archivos: Map<string, ArchivoHorneado>): Promise<{
  archivos: Record<string, { huella: string; tipo: string; bytes: number }>;
  huella: string;
}> {
  const entradas: [string, { huella: string; tipo: string; bytes: number }][] = [];
  for (const ruta of [...archivos.keys()].sort()) {
    const a = archivos.get(ruta) as ArchivoHorneado;
    entradas.push([
      ruta,
      {
        huella: await huella(a.contenido),
        tipo: a.tipo,
        bytes: new TextEncoder().encode(a.contenido).length,
      },
    ]);
  }
  return {
    archivos: Object.fromEntries(entradas),
    huella: await huella(entradas.map(([r, e]) => `${r} ${e.huella}`).join('\n')),
  };
}
