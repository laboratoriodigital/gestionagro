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
import {
  etiquetaDeVerificacionGoogle,
  NOMBRE_DEL_TIPO,
  TIPOS_DE_SOLICITUD,
} from '@ed1/tienda-schema';
import { llmsTxt, manifiestoWeb, robotsDeLaTienda } from './agentes.ts';
import { escaparHtml, markdownPlano, markdownSeguro } from './escapar.ts';
import { type DatosLegales, type FormaDePago, TEXTOS_LEGALES, textosLegales } from './legal.ts';
import { type Apariencia, coloresDelTema, cssDelTema, fondoDelTema } from './tema.ts';
import { estadoDeLaEleccion } from './vitrina/seleccion.ts';

export interface VarianteParaHornear {
  id: string;
  clave: string;
  precioCop: number;
  stock: number | null;
}

/** Una foto ya subida (HU-T8.3): sus derivadas viven en el bucket público de las fotos (HU-T5.6). */
export interface FotoParaHornear {
  /** SHA-256 del original: la carpeta de sus derivadas. */
  huella: string;
  alt: string;
  ancho: number;
  alto: number;
  /** Los anchos de sus derivadas: 400, 800 y 1600 (los que no alcanza su original, no). */
  anchos: readonly number[];
  /** HU-T8.3 CA2: `jpeg` si el teléfono no pudo hacer WebP (Safari). Sin decirlo, WebP. */
  formato?: 'webp' | 'jpeg';
}

export interface ProductoParaHornear {
  slug: string;
  nombre: string;
  descripcion?: string;
  opciones: { nombre: string; valores: string[] }[];
  variantes: VarianteParaHornear[];
  /** ISO 8601: el `lastmod` del sitemap. */
  actualizado: string;
  /** En su orden: la primera es la de la tarjeta (HU-T5.2). */
  fotos?: readonly FotoParaHornear[];
  /** Si admite retracto, y si no, por qué (Ley 1480 art. 47). Sin el dato: aplica. */
  retracto?: { aplica: true } | { aplica: false; motivo: string };
  /** Solo para mayores de edad (art. 52): se confirma la edad antes de agregarlo. */
  soloMayores?: boolean;
  destacado?: boolean;
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
  /** La organización: la carpeta de sus fotos en el bucket público. */
  org?: string;
  /** El host de las fotos, sin esquema: `img.laboratorio-digital.app` (HU-T5.6). */
  medios?: string;
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

/** Las formas de pago en el carrito (HU-T6.1): su nombre y qué pasa después, sin datos de cuentas. */
export const NOMBRE_DE_LA_FORMA: Record<FormaDePago, string> = {
  a_convenir: 'Lo acordamos por WhatsApp',
  en_linea: 'En línea',
  contraentrega: 'Contra entrega',
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
};
const NOTA_DE_LA_FORMA: Record<FormaDePago, string> = {
  a_convenir: 'La tienda te dice cómo pagar al confirmar tu pedido.',
  en_linea: 'En la página de pago segura.',
  contraentrega: 'Pagas cuando recibes tu pedido.',
  transferencia: 'La tienda te manda sus datos al confirmar tu pedido.',
  efectivo: 'Al recibir o recoger tu pedido.',
};

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

/** Los anchos de las derivadas de una foto (TIENDA §5.6). */
export const ANCHOS_DE_FOTO: readonly number[] = [400, 800, 1600];
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
  /** Una página de cada comprador (el pedido): no se indexa. */
  privada?: boolean;
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
<meta name="viewport" content="width=device-width, initial-scale=1">${p.privada ? '\n<meta name="robots" content="noindex">' : ''}
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
<a class="barra-pedido" href="/carrito/" data-pedido hidden>Tu pedido <span class="cifra" data-cantidad>0</span></a>
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
  /**
   * Una foto con sus derivadas (HU-T5.2 CA3): `srcset` de 400, 800 y 1600 px, medidas explícitas
   * para que nada salte al cargar (CLS) y carga diferida, salvo la primera de la página, que pide
   * prioridad. Sin host de fotos o sin derivadas, el marco vacío de siempre.
   */
  const urlDeFoto = (f: FotoParaHornear, ancho: number) =>
    `https://${t.medios}/${t.org}/${f.huella}/${ancho}.${f.formato ?? 'webp'}`;
  const imagen = (
    f: FotoParaHornear | undefined,
    clase: string,
    sizes: string,
    prioridad: boolean,
    alt: string,
  ) => {
    const anchos = [...(f?.anchos ?? [])]
      .filter((a) => ANCHOS_DE_FOTO.includes(a))
      .sort((a, b) => a - b);
    if (!f || !t.medios || !t.org || anchos.length === 0) {
      return `<span class="${clase}" aria-hidden="true"></span>`;
    }
    const principal = anchos.filter((a) => a <= 800).at(-1) ?? (anchos[0] as number);
    return `<span class="${clase}"><img src="${escaparHtml(urlDeFoto(f, principal))}" srcset="${anchos
      .map((a) => `${escaparHtml(urlDeFoto(f, a))} ${a}w`)
      .join(', ')}" sizes="${sizes}" width="${f.ancho}" height="${f.alto}" alt="${escaparHtml(
      presente(f.alt) ? f.alt : alt,
    )}"${prioridad ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></span>`;
  };
  const TAMANO_TARJETA = '(min-width: 64rem) 22rem, (min-width: 40rem) 33vw, 50vw';
  const TAMANO_FICHA = '(min-width: 64rem) 36rem, 100vw';
  const TAMANO_PORTADA = '(min-width: 64rem) 72rem, 100vw';

  const tarjeta = (p: ProductoParaHornear, prioridad = false) =>
    `<li class="tarjeta"><a href="/p/${escaparHtml(p.slug)}/">${imagen(p.fotos?.[0], 'tarjeta__foto', TAMANO_TARJETA, prioridad, p.nombre)}<span class="tarjeta__nombre">${escaparHtml(p.nombre)}</span><span class="precio">${variaElPrecio(p) ? 'Desde ' : ''}${formatearPesos(precioDesde(p))}</span></a></li>`;
  const rejilla = (lista: readonly ProductoParaHornear[], primeraConPrioridad: boolean) =>
    `<ul class="productos">${lista.map((p, i) => tarjeta(p, primeraConPrioridad && i === 0)).join('')}</ul>`;
  const lineaMd = (p: ProductoParaHornear) =>
    `- [${markdownPlano(p.nombre)}](/p/${p.slug}/): ${variaElPrecio(p) ? 'desde ' : ''}${formatearPesos(precioDesde(p))}`;

  /**
   * Las tres portadas de `apariencia` (HU-T5.2 CA1), sobre el mismo contenido:
   * - `catalogo`: el nombre, la frase y todos los productos;
   * - `editorial`: un producto grande arriba (el destacado, o el primero) y los demás debajo;
   * - `colecciones`: las colecciones primero, cada una con la foto de su primer producto; sin
   *   colecciones, es la de catálogo.
   */
  const colecciones = [...(t.colecciones ?? [])].sort((a, b) => (a.slug < b.slug ? -1 : 1));
  const encabezado = [
    `<h1>${escaparHtml(t.nombre)}</h1>`,
    presente(t.frase) ? `<p class="frase">${escaparHtml(t.frase)}</p>` : '',
  ];
  const cuerpoDeLaPortada = (): string[] => {
    if (productos.length === 0) {
      return [...encabezado, '<p class="estado">Esta tienda todavía no tiene productos.</p>'];
    }
    if (t.apariencia.portada === 'editorial') {
      const grande = productos.find((p) => p.destacado) ?? (productos[0] as ProductoParaHornear);
      const resto = productos.filter((p) => p !== grande);
      return [
        `<section class="portada-editorial"><a class="portada-editorial__producto" href="/p/${escaparHtml(grande.slug)}/">${imagen(grande.fotos?.[0], 'portada-editorial__foto', TAMANO_PORTADA, true, grande.nombre)}<div class="portada-editorial__texto">${encabezado.filter(Boolean).join('')}<span class="portada-editorial__ver">Ver ${escaparHtml(grande.nombre)}</span></div></a></section>`,
        ...(resto.length > 0 ? ['<h2>Más productos</h2>', rejilla(resto, false)] : []),
      ];
    }
    if (t.apariencia.portada === 'colecciones' && colecciones.length > 0) {
      return [
        ...encabezado,
        `<ul class="colecciones">${colecciones
          .map((c, i) => {
            const primero = productos.find((p) => c.productos.includes(p.slug));
            return `<li class="coleccion"><a href="/c/${escaparHtml(c.slug)}/">${imagen(primero?.fotos?.[0], 'coleccion__foto', TAMANO_TARJETA, i === 0, c.nombre)}<span class="coleccion__nombre">${escaparHtml(c.nombre)}</span></a></li>`;
          })
          .join('')}</ul>`,
        '<h2>Todos los productos</h2>',
        rejilla(productos, false),
      ];
    }
    return [...encabezado, rejilla(productos, true)];
  };

  // La portada.
  pagina({
    ruta: '/',
    titulo: t.nombre,
    ...(presente(t.frase) ? { descripcion: t.frase } : {}),
    cuerpo: cuerpoDeLaPortada().filter(Boolean).join('\n'),
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
      ...(t.apariencia.portada === 'colecciones' && colecciones.length > 0
        ? [
            '\n## Colecciones\n',
            ...colecciones.map((c) => `- [${markdownPlano(c.nombre)}](/c/${c.slug}/)`),
          ]
        : []),
      '\n## Productos\n',
      ...productos.map(lineaMd),
      '',
    ]
      .filter((l) => l !== '')
      .join('\n')
      .concat('\n'),
  });

  /**
   * Lo que la ley pide decir antes de comprar (HU-T5.2 CA2; Ley 1480 art. 50 lit. b y c, art. 47 y
   * art. 52): el precio final, el plazo y el costo de cada envío, el retracto o por qué no aplica,
   * y si es solo para mayores de edad. En HTML y en el gemelo, con las mismas palabras.
   */
  const envios = t.legal?.envios ?? [];
  const condiciones = (p: ProductoParaHornear): string[] => {
    const plazo = (e: (typeof envios)[number]) =>
      e.diasMin !== null && e.diasMax !== null && e.diasMin !== e.diasMax
        ? `llega en ${e.diasMin} a ${e.diasMax} días`
        : e.diasMax !== null || e.diasMin !== null
          ? `llega en ${e.diasMax ?? e.diasMin} ${(e.diasMax ?? e.diasMin) === 1 ? 'día' : 'días'}`
          : 'el plazo te lo confirma la tienda';
    return [
      ...(envios.length > 0
        ? envios.map(
            (e) =>
              `Envío ${e.nombre}: ${e.precioCop === 0 ? 'gratis' : formatearPesos(e.precioCop)}${e.gratisDesdeCop !== null && e.precioCop > 0 ? `, gratis desde ${formatearPesos(e.gratisDesdeCop)}` : ''}; ${plazo(e)}.`,
          )
        : ['El envío, su costo y su plazo los acuerdas con la tienda antes de pagar.']),
      p.retracto?.aplica === false
        ? `No admite retracto: ${p.retracto.motivo}.`
        : 'Puedes retractarte de la compra en los 5 días hábiles siguientes a recibirla.',
      ...(p.soloMayores ? ['Solo para mayores de edad.'] : []),
    ];
  };
  const notaDelPrecio = t.legal?.responsableIva
    ? 'Precio final, con IVA incluido.'
    : 'Precio final.';

  /**
   * La ficha (HU-T3.4 y HU-T5.2): las fotos, el precio, la elección de la variante y las
   * condiciones. Sin JavaScript se lee entera; con él, el botón dice qué falta (`vitrina.ts`). Las
   * variantes van como datos, no como código: `<script type="application/json">` no se ejecuta.
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
    const mayoria = p.soloMayores
      ? '<label class="mayoria"><input type="checkbox" name="mayor-de-edad" data-mayoria><span>Confirmo que soy mayor de edad</span></label>'
      : '';
    const fotos = p.fotos ?? [];
    const galeria =
      fotos.length > 0 && t.medios
        ? `<div class="ficha__fotos">${fotos.map((f, i) => imagen(f, 'ficha__foto', TAMANO_FICHA, i === 0, p.nombre)).join('')}</div>`
        : '<div class="ficha__foto" aria-hidden="true"></div>';
    return [
      `<article class="ficha"${p.soloMayores ? ' data-solo-mayores' : ''}>`,
      galeria,
      '<div class="ficha__datos">',
      `<h1>${escaparHtml(p.nombre)}</h1>`,
      `<p class="precio" data-precio>${variaElPrecio(p) ? 'Desde ' : ''}${formatearPesos(precioDesde(p))}</p>`,
      `<p class="precio__nota">${notaDelPrecio}</p>`,
      `<form class="eleccion" data-eleccion>${grupos}${mayoria}<div class="avisame" data-avisame hidden><p>Esta combinación está agotada.</p><button class="boton boton--secundario" type="button" data-avisame-boton>Avísame cuando haya</button><p class="aviso" data-avisame-estado role="status" hidden></p></div><p class="aviso" data-aviso role="status" hidden></p><button class="boton boton--principal" type="submit" data-boton aria-disabled="${inicial.tipo !== 'lista'}">${escaparHtml(inicial.texto)}</button></form>`,
      `<ul class="condiciones">${condiciones(p)
        .map((c) => `<li>${escaparHtml(c)}</li>`)
        .join(
          '',
        )}<li><a href="/legal/envios/">Envíos y devoluciones</a> · <a href="/legal/retracto/">Retracto</a> · <a href="/legal/garantia/">Garantía</a></li></ul>`,
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
    const imagenes =
      t.medios && t.org
        ? (p.fotos ?? []).flatMap((f) => {
            const mayor = [...f.anchos]
              .filter((a) => ANCHOS_DE_FOTO.includes(a))
              .sort((a, b) => b - a)[0];
            return mayor ? [urlDeFoto(f, mayor)] : [];
          })
        : [];
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
          image: imagenes.length > 0 ? imagenes : undefined,
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
        `Precio: ${variaElPrecio(p) ? 'desde ' : ''}${formatearPesos(precioDesde(p))}. ${notaDelPrecio}`,
        ...(p.opciones.length > 0
          ? ['', ...p.opciones.map((o) => `- ${o.nombre}: ${o.valores.join(', ')}`)]
          : []),
        '',
        '## Antes de comprar',
        '',
        ...condiciones(p).map((c) => `- ${markdownPlano(c)}`),
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
      cuerpo: `<h1>${escaparHtml(c.nombre)}</h1>\n${rejilla(suyos, true)}`,
      ld: [
        migas([
          [t.nombre, '/'],
          [c.nombre, `/c/${c.slug}/`],
        ]),
      ],
      gemelo: `# ${markdownPlano(c.nombre)}\n\n${suyos.map(lineaMd).join('\n')}\n`,
    });
  }

  // Los textos legales (HU-T7.1): el carrito necesita la huella de los términos que muestra.
  const legales = t.legal ? textosLegales(t.legal) : [];
  const terminos = legales.find((x) => x.id === 'terminos');
  const huellaDeLosTerminos = terminos ? await huella(terminos.markdown) : '';

  /**
   * El carrito (HU-T5.4 y HU-T6.1, TIENDA §5.4): se arma en el teléfono del comprador; la isla pinta
   * sus líneas, cotiza y registra el pedido antes de abrir WhatsApp. Lo que la isla necesita va como
   * datos: las formas de pago que ofrece la tienda (solo sus nombres: los datos de la transferencia
   * nunca se hornean, HU-T6.2 CA2), los envíos con su id y la huella de los términos que se aceptan.
   * Sin la isla, la página ofrece el WhatsApp de la tienda.
   */
  const whatsapp = presente(t.whatsapp) ? t.whatsapp.replace(/\D/g, '') : '';
  const formas = (t.legal?.formas ?? []).filter((f) => f.forma !== 'en_linea');
  const enviosConId = (t.legal?.envios ?? []).filter((e) => presente(e.id));
  const plazoDelEnvio = (e: (typeof enviosConId)[number]) =>
    e.diasMin !== null && e.diasMax !== null && e.diasMin !== e.diasMax
      ? `llega en ${e.diasMin} a ${e.diasMax} días`
      : e.diasMax !== null || e.diasMin !== null
        ? `llega en ${e.diasMax ?? e.diasMin} ${(e.diasMax ?? e.diasMin) === 1 ? 'día' : 'días'}`
        : 'el plazo te lo confirma la tienda';
  const tarjetaDeForma = (f: (typeof formas)[number]) =>
    `<label class="opcion-grande"><input type="radio" name="forma" value="${f.forma}"><span class="opcion-grande__nombre">${escaparHtml(NOMBRE_DE_LA_FORMA[f.forma])}</span><span class="opcion-grande__nota">${escaparHtml(NOTA_DE_LA_FORMA[f.forma])}</span></label>`;
  const tarjetaDeEnvio = (e: (typeof enviosConId)[number]) =>
    `<label class="opcion-grande"><input type="radio" name="envio" value="${escaparHtml(e.id ?? '')}"><span class="opcion-grande__nombre">${escaparHtml(e.nombre)} · ${e.precioCop === 0 ? 'gratis' : formatearPesos(e.precioCop)}</span><span class="opcion-grande__nota">${escaparHtml(`${e.gratisDesdeCop !== null && e.precioCop > 0 ? `Gratis desde ${formatearPesos(e.gratisDesdeCop)}; ` : ''}${plazoDelEnvio(e)}.`)}</span></label>`;
  const datosDeVenta = {
    formas: formas.map((f) => ({ forma: f.forma, nombre: NOMBRE_DE_LA_FORMA[f.forma] })),
    envios: enviosConId.map((e) => ({ id: e.id, nombre: e.nombre, plazo: plazoDelEnvio(e) })),
    terminos: huellaDeLosTerminos,
  };
  pagina({
    ruta: '/carrito/',
    titulo: `Tu pedido · ${t.nombre}`,
    privada: true,
    cuerpo: [
      '<h1>Tu pedido</h1>',
      '<div class="pedido" data-pedido-pagina>',
      '<p class="aviso" data-aviso-carrito role="status" hidden></p>',
      '<p class="pedido__codigo" data-codigo-bloque hidden>Código de tu pedido: <span class="cifra" data-codigo></span></p>',
      '<p class="estado" data-vacio>Aquí ves lo que agregas a tu pedido desde cada producto. <a href="/">Mira los productos</a>.</p>',
      '<ul class="lineas" data-lineas></ul>',
      '<div class="resumen" data-resumen hidden><p class="resumen__fila">Subtotal <span class="cifra" data-subtotal></span></p><p class="resumen__fila" data-fila-envio hidden>Envío <span class="cifra" data-envio></span></p><p class="resumen__fila" data-fila-descuento hidden>Descuento <span class="cifra" data-descuento></span></p><p class="resumen__fila resumen__total">Total <span class="cifra" data-total></span></p><p class="aviso aviso--fuerte" data-aviso-total role="alert" hidden></p><p class="resumen__nota" data-nota>El envío se confirma antes de enviar el pedido.</p></div>',
      `<form class="venta" data-venta hidden novalidate>`,
      formas.length > 0
        ? `<fieldset class="grupo"><legend>¿Cómo quieres pagar?</legend>${formas.map(tarjetaDeForma).join('')}</fieldset>`
        : '',
      enviosConId.length > 0
        ? `<fieldset class="grupo"><legend>¿Cómo te llega?</legend>${enviosConId.map(tarjetaDeEnvio).join('')}</fieldset>`
        : '',
      '<label class="campo">Ciudad de entrega (si te lo envían)<input name="ciudad" maxlength="60" autocomplete="address-level2"></label>',
      '<label class="acepto"><input type="checkbox" name="acepta" data-acepta><span>Acepto los <a href="/legal/terminos/">términos y condiciones</a> y la <a href="/legal/privacidad/">política de datos</a>.</span></label>',
      '<p class="aviso" data-aviso-venta role="status" hidden></p>',
      '<button class="boton boton--principal" type="submit" data-enviar aria-disabled="true">Elige cómo pagar</button>',
      '<p class="resumen__nota">Te llevamos a WhatsApp con tu pedido escrito. Los datos de entrega se los das a la tienda allí.</p>',
      '</form>',
      `<script type="application/json" id="venta">${jsonEstable(datosDeVenta).replace(/</g, '\\u003c')}</script>`,
      whatsapp
        ? `<p class="pedido__whatsapp">¿Prefieres escribir? <a href="https://wa.me/${whatsapp}" rel="nofollow">Pide por WhatsApp</a></p>`
        : '',
      '</div>',
    ]
      .filter(Boolean)
      .join('\n'),
    ld: [],
    gemelo: `# Tu pedido\n\nEl pedido se arma en el teléfono de cada comprador, desde las fichas de los productos, y se envía por WhatsApp. El catálogo está en [/catalogo.md](/catalogo.md).\n`,
  });

  /**
   * El pedido enviado (HU-T6.2 y HU-T6.3, TIENDA §8.4 y §8.5): `/pedido/#c=<código>&s=<secreto>`. El
   * fragmento no llega a ningún servidor; la isla lo lee y pregunta por POST. Muestra el acuse
   * (código, número, total, plazo, forma de pago y el enlace) y el estado, y se puede imprimir.
   */
  pagina({
    ruta: '/pedido/',
    titulo: `Tu pedido enviado · ${t.nombre}`,
    privada: true,
    cuerpo: [
      '<h1>Tu pedido</h1>',
      '<div class="seguimiento" data-seguimiento>',
      '<p class="estado" data-seguimiento-vacio>Abre esta página con el enlace de seguimiento que te llegó con tu pedido.</p>',
      '<p class="aviso" data-seguimiento-aviso role="status" hidden></p>',
      '<section class="acuse" data-acuse hidden>',
      '<p class="acuse__codigo">Pedido <span class="cifra" data-acuse-codigo></span> · <span data-acuse-numero></span></p>',
      '<p class="acuse__estado" data-acuse-estado></p>',
      '<dl class="acuse__datos"><dt>Total</dt><dd class="cifra" data-acuse-total></dd><dt>Forma de pago</dt><dd data-acuse-forma></dd><dt>Entrega</dt><dd data-acuse-plazo></dd><dt>Guía</dt><dd data-acuse-guia>Te la damos al despachar.</dd></dl>',
      '<ul class="lineas lineas--acuse" data-acuse-lineas></ul>',
      '<ol class="pasos" data-acuse-pasos></ol>',
      '<a class="boton boton--principal" data-acuse-whatsapp hidden>Enviar por WhatsApp</a>',
      '<p class="acuse__enlace">Guarda este enlace para seguir tu pedido: <a data-acuse-enlace></a></p>',
      '<button class="boton boton--secundario" type="button" data-imprimir>Imprimir o guardar como PDF</button>',
      '</section>',
      '</div>',
    ].join('\n'),
    ld: [],
    gemelo: `# Tu pedido\n\nEl estado de un pedido se ve con su enlace de seguimiento, que solo tiene quien lo hizo.\n`,
  });

  /**
   * La solicitud con radicado (HU-T6.4, TIENDA §8.6): el formulario va debajo del texto de
   * `/solicitud/`. La isla crea el secreto del enlace en el teléfono, radica por POST y muestra el
   * radicado; con `#r=…&s=…` muestra en qué va. Sin JavaScript queda el texto, con el correo y el
   * WhatsApp de la tienda.
   */
  const formularioDeSolicitud = [
    '<section class="solicitud" data-solicitud>',
    '<h2 id="hacerla">Hazla aquí</h2>',
    '<form class="venta" data-solicitud-form hidden novalidate>',
    `<label class="campo">¿Qué necesitas?<select name="tipo" required><option value="">Elige una opción</option>${TIPOS_DE_SOLICITUD.map((x) => `<option value="${x}">${escaparHtml(NOMBRE_DEL_TIPO[x])}</option>`).join('')}</select></label>`,
    '<label class="campo">Código de tu pedido (si tienes uno)<input name="pedido" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>',
    '<label class="campo">Cuéntanos qué pasa<textarea name="texto" rows="5" minlength="10" maxlength="2000" required></textarea></label>',
    '<label class="campo">¿Cómo te respondemos? (correo o WhatsApp)<input name="contacto" maxlength="120" autocomplete="email" required></label>',
    '<label class="acepto"><input type="checkbox" name="acepta" data-acepta><span>Autorizo usar estos datos para atender mi solicitud, como dice la <a href="/legal/privacidad/">política de datos</a>.</span></label>',
    '<p class="aviso" data-solicitud-aviso role="status" hidden></p>',
    '<button class="boton boton--principal" type="submit" data-solicitud-enviar aria-disabled="true">Elige qué necesitas</button>',
    '</form>',
    '<section class="acuse" data-radicado hidden>',
    '<p class="acuse__codigo">Solicitud <span class="cifra" data-radicado-numero></span></p>',
    '<p class="acuse__estado" data-radicado-estado></p>',
    '<dl class="acuse__datos"><dt>Tipo</dt><dd data-radicado-tipo></dd><dt>Recibida</dt><dd data-radicado-creada></dd><dt>Te respondemos a más tardar</dt><dd data-radicado-vence></dd></dl>',
    '<p class="acuse__enlace">Guarda este enlace para seguir tu solicitud: <a data-radicado-enlace></a></p>',
    '<button class="boton boton--secundario" type="button" data-imprimir>Imprimir o guardar como PDF</button>',
    '</section>',
    '</section>',
  ].join('\n');

  // Los textos legales (HU-T7.1), cada uno con su gemelo.
  for (const texto of legales) {
    pagina({
      ruta: texto.ruta,
      titulo: `${texto.titulo} · ${t.nombre}`,
      cuerpo: texto.id === 'solicitud' ? `${texto.html}\n${formularioDeSolicitud}` : texto.html,
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
 *
 * HU-T8.2 CA3: `redirecciones` lleva cada dirección vieja de un producto a la nueva (301). Entra en
 * la huella del conjunto: cambiar solo una redirección también es publicar. Sin redirecciones, la
 * huella es la de siempre.
 */
export async function manifiesto(
  archivos: Map<string, ArchivoHorneado>,
  redirecciones: Readonly<Record<string, string>> = {},
): Promise<{
  archivos: Record<string, { huella: string; tipo: string; bytes: number }>;
  redirecciones?: Record<string, string>;
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
  // Una dirección que es un archivo de esta versión no se redirige: la tomó otro producto.
  const saltos = Object.entries(redirecciones)
    .filter(([desde]) => !archivos.has(`${desde}index.html`))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    archivos: Object.fromEntries(entradas),
    ...(saltos.length > 0 ? { redirecciones: Object.fromEntries(saltos) } : {}),
    huella: await huella(
      [
        ...entradas.map(([r, e]) => `${r} ${e.huella}`),
        ...saltos.map(([desde, hacia]) => `${desde} -> ${hacia}`),
      ].join('\n'),
    ),
  };
}
