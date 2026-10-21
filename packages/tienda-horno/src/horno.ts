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
  type LimitesDelPlan,
  NOMBRE_DEL_TIPO,
  TIPOS_DE_SOLICITUD,
} from '@ed1/tienda-schema';
import { llmsTxt, manifiestoWeb, robotsDeLaTienda } from './agentes.ts';
import { esDeLaPlataforma, type Tercero } from './csp.ts';
import { escaparHtml, markdownPlano, markdownSeguro } from './escapar.ts';
import { archivosDeLosFeeds, type FeedsEncendidos } from './feeds.ts';
import {
  type DatosLegales,
  type FormaDePago,
  plazoDelEnvio,
  TEXTOS_LEGALES,
  textosLegales,
} from './legal.ts';
import { alPlan } from './plan.ts';
import { type Apariencia, coloresDelTema, cssDelTema, fondoDelTema } from './tema.ts';
import { estadoDeLaEleccion } from './vitrina/seleccion.ts';

export interface VarianteParaHornear {
  id: string;
  clave: string;
  precioCop: number;
  stock: number | null;
  /** El precio de antes, tachado al lado, solo si es mayor que el de ahora (validación del 20 oct). */
  precioAntesCop?: number | null;
}

/** Con estas unidades o menos, la ficha dice «Quedan N» y la tarjeta «Últimas unidades». */
export const POCAS_UNIDADES = 3;

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
  /** HU-T5.9: la combinación de esta foto (su id); sin ella, es una foto general. */
  variante?: string;
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
  /** HU-T5.10: lleva la etiqueta «Nuevo». */
  nuevo?: boolean;
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
  /**
   * La tienda cobra en línea con su Bold (HU-T11.4): el carrito ofrece pagar ahí y pide los datos de
   * entrega. La compuerta pide sus llaves y, para cobrar de verdad, el cobro de prueba (HU-T11.3).
   */
  cobroEnLinea?: boolean;
  /** HU-T11.3 CA2: cobra en el ambiente de pruebas de Bold; una franja lo dice en cada página. */
  cobroEnPruebas?: boolean;
  /** HU-T14.5: los feeds de productos que el comercio encendió en Ajustes › Agentes. */
  feeds?: FeedsEncendidos;
  /**
   * HU-T13.5: lo que permite el plan de la tienda. El horno recorta a él lo publicado (`alPlan`):
   * los productos de más quedan ocultos y lo que el plan no incluye no se ofrece.
   */
  plan?: LimitesDelPlan;
  /**
   * HU-T8.6: la vista previa del comercio. Cada página lo dice en una franja y no se indexa; el
   * despacho la sirve en `/_vista/<huella>/` y no deja pedir, pagar ni medir desde ella.
   */
  vistaPrevia?: boolean;
  /**
   * HU-T14.4 (D-T13): GA4 y el píxel de Meta que el comercio configuró, y su aviso. Nada carga sin
   * el consentimiento del comprador; el píxel, solo con dominio propio.
   */
  terceros?: { ga4?: string; pixelMeta?: string; aviso?: string };
  /** HU-T5.13: el logo de la franja y el ícono de la pestaña y de la app. */
  logo?: FotoParaHornear;
  icono?: FotoParaHornear;
  /** HU-T5.14: el hero de la portada. */
  hero?: { titulo?: string; texto?: string; imagen?: FotoParaHornear; boton?: string };
  /** HU-T10.2: las páginas propias visibles, en Markdown, cada una en `/<slug>/`. */
  paginas?: readonly PaginaParaHornear[];
}

export interface PaginaParaHornear {
  slug: string;
  titulo: string;
  cuerpo: string;
}

const GA4 = /^G-[A-Z0-9]{4,12}$/;
const PIXEL = /^\d{8,20}$/;

/**
 * HU-T14.4: lo que la tienda mide con terceros, para la CSP de su versión: GA4 si su código es
 * válido; el píxel de Meta, además, solo con dominio propio (D-T13).
 */
export function tercerosDe(t: Pick<TiendaParaHornear, 'terceros' | 'dominio'>): Tercero[] {
  const r: Tercero[] = [];
  if (t.terceros?.ga4 && GA4.test(t.terceros.ga4)) r.push('ga4');
  if (t.terceros?.pixelMeta && PIXEL.test(t.terceros.pixelMeta) && !esDeLaPlataforma(t.dominio))
    r.push('meta');
  return r;
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
  csv: 'text/csv; charset=utf-8',
  jsonl: 'application/jsonl; charset=utf-8',
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
/**
 * Cuántos productos caben en una página sin pasar su presupuesto, con foto (HU-T3.7, TIENDA §1.3):
 * la portada muestra los primeros 24; las colecciones y «todos los productos», 48 por página.
 */
export const EN_LA_PORTADA = 24;
/** La lupa de buscar: se dibuja con el color del texto (`.lupa` en la hoja). */
const LUPA =
  '<svg class="lupa" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
export const POR_PAGINA = 48;
const precioDesde = (p: ProductoParaHornear) => Math.min(...p.variantes.map((v) => v.precioCop));
/** «Desde» solo cuando las variantes cuestan distinto. */
const variaElPrecio = (p: ProductoParaHornear) =>
  new Set(p.variantes.map((v) => v.precioCop)).size > 1;
const disponible = (v: VarianteParaHornear) => v.stock === null || v.stock > 0;
/** Cuántas quedan de una combinación, si son pocas; `null` si hay más o no se cuentan. */
const quedanDe = (v: VarianteParaHornear) =>
  v.stock !== null && v.stock > 0 && v.stock <= POCAS_UNIDADES ? v.stock : null;
/** El precio de antes, si de verdad bajó. */
const antesDe = (v: VarianteParaHornear) =>
  typeof v.precioAntesCop === 'number' && v.precioAntesCop > v.precioCop ? v.precioAntesCop : null;
const masBarata = (p: ProductoParaHornear) =>
  p.variantes.reduce((a, b) => (b.precioCop < a.precioCop ? b : a));
/** Todo lo que se puede pedir de un producto se cuenta, y son pocas unidades en total. */
const ultimasUnidades = (p: ProductoParaHornear) => {
  const hay = p.variantes.filter(disponible);
  return (
    hay.length > 0 &&
    hay.every((v) => v.stock !== null) &&
    hay.reduce((suma, v) => suma + (v.stock ?? 0), 0) <= POCAS_UNIDADES
  );
};
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

export async function hornear(publicada: TiendaParaHornear): Promise<Map<string, ArchivoHorneado>> {
  // HU-T13.5: lo que el plan permite, nada más.
  const t = alPlan(publicada).tienda;
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

  // HU-T11.3 CA2: mientras cobre en pruebas, cada página lo dice antes que nada.
  const enPruebas =
    t.cobroEnLinea && t.cobroEnPruebas
      ? '<p class="en-pruebas" role="note">Tienda en pruebas: los pagos en línea de esta tienda todavía no cobran de verdad.</p>\n'
      : '';
  // HU-T10.2 CA1: las páginas propias, enlazadas en el pie de cada página.
  const paginasPropias = [...(t.paginas ?? [])].sort((a, b) => (a.slug < b.slug ? -1 : 1));
  const propias =
    paginasPropias.length > 0
      ? `\n<nav class="pie__enlaces" aria-label="Sobre la tienda">${paginasPropias.map((p) => `<a href="/${escaparHtml(p.slug)}/">${escaparHtml(p.titulo)}</a>`).join('')}</nav>`
      : '';
  // HU-T14.4 CA1: el aviso de consentimiento, oculto hasta que la vitrina sepa si hace falta.
  // Aceptar y rechazar, dos botones iguales; nada de afuera carga antes de aceptar.
  const medidos = tercerosDe(t);
  const nombresDeLaMedicion = medidos
    .map((x) => (x === 'ga4' ? 'Google Analytics' : 'Meta'))
    .join(' y ');
  const avisoDeMedicion =
    medidos.length > 0
      ? `\n<aside class="consentimiento" data-consentimiento${medidos.includes('ga4') ? ` data-ga4="${escaparHtml(t.terceros?.ga4 ?? '')}"` : ''}${medidos.includes('meta') ? ` data-pixel="${escaparHtml(t.terceros?.pixelMeta ?? '')}"` : ''} aria-label="Tus datos de medición" hidden><p>${escaparHtml(
          presente(t.terceros?.aviso)
            ? (t.terceros?.aviso as string)
            : `Con tu permiso, esta tienda mide sus visitas con ${nombresDeLaMedicion} para saber qué funciona y mostrar sus productos a más personas. Si no aceptas, la tienda funciona igual.`,
        )} <a href="/legal/privacidad/">Política de datos</a></p><div class="consentimiento__botones"><button class="boton boton--secundario" type="button" data-rechazar>No acepto</button><button class="boton boton--secundario" type="button" data-aceptar>Acepto</button></div></aside>`
      : '';
  const preferencias =
    medidos.length > 0
      ? '\n<p><button class="enlace" type="button" data-preferencias>Tus datos de medición</button></p>'
      : '';
  // HU-T5.13: el logo en la franja, con el nombre como texto; sin logo, el nombre. Funciones: las
  // direcciones de las fotos se arman más abajo.
  const ALTO_DEL_LOGO = 40;
  const marca = () =>
    t.logo && t.medios && t.org
      ? `<img class="marca__logo" src="${escaparHtml(urlDeFoto(t.logo, 400))}" alt="${escaparHtml(t.nombre)}" width="${Math.max(1, Math.round((ALTO_DEL_LOGO * t.logo.ancho) / t.logo.alto))}" height="${ALTO_DEL_LOGO}">`
      : escaparHtml(t.nombre);
  const icono = () =>
    t.icono && t.medios && t.org
      ? `\n<link rel="icon" href="${escaparHtml(urlDeFoto(t.icono, 400))}">\n<link rel="apple-touch-icon" href="${escaparHtml(urlDeFoto(t.icono, 400))}">`
      : '';
  // HU-T8.6: la vista previa también lo dice antes que nada, en cada página.
  const enVista = t.vistaPrevia
    ? '<p class="en-pruebas" role="note">Vista previa: así se verá tu tienda cuando publiques. Solo la ve quien tenga este enlace, y aquí no se puede pedir ni pagar.</p>\n'
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
<html lang="es-CO" data-estilo="${t.apariencia.estilo}" data-portada="${t.apariencia.portada}" data-modo="${t.apariencia.modo}"${t.vistaPrevia ? ' data-vista-previa' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${p.privada || t.vistaPrevia ? '\n<meta name="robots" content="noindex">' : ''}
<title>${escaparHtml(p.titulo)}</title>${descripcion}
<link rel="canonical" href="${escaparHtml(url(p.ruta))}">
<link rel="alternate" type="text/markdown" href="${escaparHtml(gemelo)}">
<link rel="manifest" href="/manifest.webmanifest">${icono()}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escaparHtml(t.nombre)}">
<meta property="og:title" content="${escaparHtml(p.titulo)}">
<meta property="og:url" content="${escaparHtml(url(p.ruta))}">
<link rel="stylesheet" href="/_t/${escaparHtml(t.release)}/vitrina.css">
<link rel="stylesheet" href="${rutaTema}">${verificacion}
${p.ld.map(jsonLd).join('\n')}
</head>
<body>
${enVista}${enPruebas}<header class="franja"><a class="marca" href="/">${marca()}</a><div class="franja__acciones"><a class="franja__buscar" href="/buscar/" data-ir-a-buscar>${LUPA}<span class="oculto">Buscar</span></a><a class="franja__pedido" href="/carrito/" data-pedido hidden>Pedido <span class="cifra" data-cantidad>0</span></a></div></header>
<main>
${p.cuerpo}
</main>
<footer class="pie">
<p class="pie__nombre">${escaparHtml(t.nombre)}</p>${identidad}${propias}
<nav class="pie__enlaces" aria-label="Información legal">${TEXTOS_LEGALES.map((l) => `<a href="${l.ruta}">${escaparHtml(ENLACE_DEL_PIE[l.id] ?? l.titulo)}</a>`).join('')}</nav>
<p><a href="https://www.sic.gov.co" rel="nofollow">Superintendencia de Industria y Comercio</a></p>
<p><a href="mailto:abuse@laboratorio-digital.app">Reportar esta tienda</a></p>${preferencias}
</footer>${avisoDeMedicion}
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
  /** La derivada más pequeña de una foto, o nada si no la hay (las coincidencias de buscar). */
  const fotoPequena = (f: FotoParaHornear | undefined) => {
    const ancho = [...(f?.anchos ?? [])]
      .filter((a) => ANCHOS_DE_FOTO.includes(a))
      .sort((a, b) => a - b)[0];
    return f && t.medios && t.org && ancho ? urlDeFoto(f, ancho) : undefined;
  };
  const TAMANO_TARJETA = '(min-width: 64rem) 22rem, (min-width: 40rem) 33vw, 50vw';
  const TAMANO_FICHA = '(min-width: 64rem) 36rem, 100vw';
  const TAMANO_PORTADA = '(min-width: 64rem) 72rem, 100vw';

  // Validación del 20 oct 2026: con varias fotos, la tarjeta deja pasarlas con el dedo; las demás
  // cargan solo cuando se ven.
  const fotosDeTarjeta = (p: ProductoParaHornear, prioridad: boolean) => {
    const lista = (p.fotos ?? []).slice(0, 5);
    if (lista.length <= 1)
      return imagen(lista[0], 'tarjeta__foto', TAMANO_TARJETA, prioridad, p.nombre);
    return `<span class="tarjeta__fotos">${lista.map((f, i) => imagen(f, 'tarjeta__foto', TAMANO_TARJETA, prioridad && i === 0, p.nombre)).join('')}</span><span class="tarjeta__cuantas">${lista.length} fotos</span>`;
  };
  const antesEnTarjeta = (p: ProductoParaHornear) => {
    const antes = antesDe(masBarata(p));
    return antes ? ` <span class="precio__antes">Antes <s>${formatearPesos(antes)}</s></span>` : '';
  };
  const tarjeta = (p: ProductoParaHornear, prioridad = false, orden = 0) =>
    `<li class="tarjeta" data-orden="${orden}" data-nombre="${escaparHtml(p.nombre.toLowerCase())}" data-precio="${precioDesde(p)}" data-fecha="${escaparHtml(p.actualizado)}"${p.nuevo ? ' data-nuevo' : ''}><a href="/p/${escaparHtml(p.slug)}/">${fotosDeTarjeta(p, prioridad)}${p.nuevo ? '<span class="etiqueta-nuevo">Nuevo</span>' : ''}<span class="tarjeta__nombre">${escaparHtml(p.nombre)}</span><span class="precio">${variaElPrecio(p) ? 'Desde ' : ''}${formatearPesos(precioDesde(p))}${antesEnTarjeta(p)}</span>${ultimasUnidades(p) ? '<span class="tarjeta__quedan">Últimas unidades</span>' : ''}</a></li>`;
  // HU-T5.12 CA2: «Ordenar por». Sin JavaScript queda escondido y la lista va en el orden
  // recomendado; con él, ordena lo que muestra la página.
  const ordenar =
    '<label class="ordenar" data-ordenar hidden><span>Ordenar por</span><select><option value="recomendado">Recomendado</option><option value="nuevo">Lo más nuevo</option><option value="nombre">Nombre, de la A a la Z</option><option value="menor">Precio, de menor a mayor</option><option value="mayor">Precio, de mayor a menor</option></select></label>';
  /**
   * Validación del 21 oct 2026: buscar va encima de la lista, justo antes de las categorías, y al
   * escribir muestra las coincidencias debajo del campo. Sin JavaScript, lleva a /buscar/.
   */
  const buscador = `<form class="buscador" action="/buscar/" role="search" data-buscador><label class="oculto" for="q-lista">Buscar en la tienda</label>${LUPA}<input id="q-lista" name="q" type="search" placeholder="Buscar en la tienda" autocomplete="off" enterkeyhint="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="coincidencias"><div class="coincidencias" data-coincidencias hidden><ul id="coincidencias" role="listbox" aria-label="Coincidencias"></ul><p class="coincidencias__vacio" data-sin-coincidencias hidden></p></div><p class="oculto" aria-live="polite" data-cuantas></p></form>`;
  /**
   * La lista de productos con sus herramientas encima: buscar, y en una fila las categorías
   * (`categoria`: la de la página, `null` para «Todo», sin ella no van) y «Ordenar por».
   */
  const rejilla = (
    lista: readonly ProductoParaHornear[],
    primeraConPrioridad: boolean,
    categoria?: string | null,
  ) => {
    const fila = `${categoria === undefined ? '' : categorias(categoria)}${lista.length > 1 ? ordenar : ''}`;
    const conBuscador = productos.length > 1;
    const herramientas =
      conBuscador || fila
        ? `<div class="herramientas" data-herramientas>${conBuscador ? buscador : ''}${fila ? `<div class="herramientas__fila">${fila}</div>` : ''}</div>`
        : '';
    return `${herramientas}<ul class="productos">${lista.map((p, i) => tarjeta(p, primeraConPrioridad && i === 0, i)).join('')}</ul>`;
  };
  const lineaMd = (p: ProductoParaHornear) =>
    `- [${markdownPlano(p.nombre)}](/p/${p.slug}/): ${variaElPrecio(p) ? 'desde ' : ''}${formatearPesos(precioDesde(p))}`;

  /**
   * Una lista larga, en páginas (HU-T3.7: con 2.000 productos la portada pesaba 434 KB y la
   * compuerta no la dejaba publicar). La primera vive en `base`; las demás, en `base` + su número.
   */
  const rutaDePagina = (base: string, n: number) => (n === 1 ? base : `${base}${n}/`);
  const enPaginas = <T>(lista: readonly T[]) =>
    Array.from({ length: Math.max(1, Math.ceil(lista.length / POR_PAGINA)) }, (_, k) =>
      lista.slice(k * POR_PAGINA, (k + 1) * POR_PAGINA),
    );
  const navegacion = (base: string, n: number, total: number) =>
    total <= 1
      ? ''
      : `<nav class="paginas" aria-label="Páginas">${n > 1 ? `<a href="${escaparHtml(rutaDePagina(base, n - 1))}" rel="prev">Anteriores</a>` : ''}<span class="paginas__cual">Página ${n} de ${total}</span>${n < total ? `<a href="${escaparHtml(rutaDePagina(base, n + 1))}" rel="next">Siguientes</a>` : ''}</nav>`;
  const navegacionMd = (base: string, n: number, total: number) =>
    total <= 1
      ? ''
      : `\n${[n > 1 ? `[Anteriores](${rutaDePagina(base, n - 1)}index.md)` : '', n < total ? `[Siguientes](${rutaDePagina(base, n + 1)}index.md)` : ''].filter(Boolean).join(' · ')}\n`;
  /**
   * HU-T5.10 y HU-T5.12: el orden recomendado: lo destacado primero, y después el orden del
   * comercio. El sitemap y el catálogo siguen en orden de dirección, para que no cambien solos.
   */
  const recomendados = [
    ...t.productos.filter((p) => p.destacado),
    ...t.productos.filter((p) => !p.destacado),
  ];
  /** La portada muestra los primeros; si hay más, enlaza a todos. */
  const enLaPortada = recomendados.slice(0, EN_LA_PORTADA);
  const hayMas = productos.length > EN_LA_PORTADA;
  const verTodos = hayMas
    ? `<p class="ver-todos"><a href="/productos/">Ver los ${productos.length} productos</a></p>`
    : '';

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
  /** HU-T5.11: las categorías para elegir, con «Todo»; la de esta página, marcada. */
  const categorias = (actual: string | null) =>
    colecciones.length > 0
      ? `<nav class="categorias" aria-label="Categorías"><a href="/"${actual === null ? ' aria-current="page"' : ''}>Todo</a>${colecciones.map((c) => `<a href="/c/${escaparHtml(c.slug)}/"${actual === c.slug ? ' aria-current="page"' : ''}>${escaparHtml(c.nombre)}</a>`).join('')}</nav>`
      : '';
  /**
   * HU-T5.14: el hero de la portada, con su imagen como la más importante de la página (LCP). Con
   * él, la portada abre así en cualquier estilo, y su botón lleva a los productos. Validación del
   * 21 oct 2026: va de lado a lado, con el texto y el botón sobre la foto.
   */
  const hero = (): string | null => {
    const h = t.hero;
    if (!h || (!presente(h.titulo) && !presente(h.texto) && !h.imagen)) return null;
    const titulo = presente(h.titulo) ? h.titulo : t.nombre;
    return `<section class="hero${h.imagen ? ' hero--con-foto' : ''}">${h.imagen ? imagen(h.imagen, 'hero__foto', '100vw', true, titulo) : ''}<div class="hero__texto"><h1>${escaparHtml(titulo)}</h1>${presente(h.texto) ? `<p>${escaparHtml(h.texto)}</p>` : ''}<a class="boton hero__boton" href="#productos">${escaparHtml(presente(h.boton) ? h.boton : 'Ver los productos')}</a></div></section>`;
  };
  const cuerpoDeLaPortada = (): string[] => {
    if (productos.length === 0) {
      return [...encabezado, '<p class="estado">Esta tienda todavía no tiene productos.</p>'];
    }
    const conHero = hero();
    if (conHero) {
      return [
        conHero,
        '<h2 id="productos">Productos</h2>',
        rejilla(enLaPortada, false, null),
        verTodos,
      ];
    }
    if (t.apariencia.portada === 'editorial') {
      const grande = productos.find((p) => p.destacado) ?? (productos[0] as ProductoParaHornear);
      const resto = enLaPortada.filter((p) => p !== grande);
      return [
        `<section class="portada-editorial"><a class="portada-editorial__producto" href="/p/${escaparHtml(grande.slug)}/">${imagen(grande.fotos?.[0], 'portada-editorial__foto', TAMANO_PORTADA, true, grande.nombre)}<div class="portada-editorial__texto">${encabezado.filter(Boolean).join('')}<span class="portada-editorial__ver">Ver ${escaparHtml(grande.nombre)}</span></div></a></section>`,
        ...(resto.length > 0
          ? ['<h2 id="productos">Más productos</h2>', rejilla(resto, false, null)]
          : [categorias(null)]),
        verTodos,
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
        hayMas ? '<h2>Productos</h2>' : '<h2>Todos los productos</h2>',
        rejilla(enLaPortada, false),
        verTodos,
      ];
    }
    return [
      ...encabezado,
      '<h2 id="productos">Productos</h2>',
      rejilla(enLaPortada, true, null),
      verTodos,
    ];
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
      ...enLaPortada.map(lineaMd),
      hayMas ? `\n[Ver los ${productos.length} productos](/productos/index.md)` : '',
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
  // HU-T5.8 CA2: la ficha no repite los envíos; se eligen en el pedido, con su costo y su plazo
  // (Ley 1480 art. 50: antes de pagar), y la ficha enlaza «Envíos y devoluciones».
  const condiciones = (p: ProductoParaHornear): string[] => {
    return [
      envios.length > 0
        ? 'El envío lo eliges en tu pedido, con su costo y su plazo.'
        : 'El envío, su costo y su plazo los acuerdas con la tienda antes de pagar.',
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
        ...(antesDe(v) ? { precioAntesCop: antesDe(v) as number } : {}),
        ...(quedanDe(v) ? { quedan: quedanDe(v) as number } : {}),
        // HU-T5.9: la foto de esta combinación, por su lugar en la galería.
        ...((p.fotos ?? []).findIndex((f) => f.variante === v.id) >= 0
          ? { foto: (p.fotos ?? []).findIndex((f) => f.variante === v.id) }
          : {}),
      }));
    const inicial = estadoDeLaEleccion(p.opciones, variantes, {});
    const antesInicial =
      inicial.tipo === 'lista' || inicial.tipo === 'agotada'
        ? (inicial.variante.precioAntesCop ?? null)
        : antesDe(masBarata(p));
    const quedanInicial = inicial.tipo === 'lista' ? (inicial.variante.quedan ?? null) : null;
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
    // Validación del 20 oct 2026: con varias fotos, miniaturas debajo para elegir, en vez de la barra.
    const miniaturas =
      fotos.length > 1
        ? `<nav class="ficha__miniaturas" aria-label="Fotos de ${escaparHtml(p.nombre)}">${fotos.map((f, i) => `<a href="#foto-${i + 1}" data-miniatura="${i}"${i === 0 ? ' aria-current="true"' : ''} aria-label="Foto ${i + 1} de ${fotos.length}">${imagen(f, 'ficha__miniatura', '4rem', false, '')}</a>`).join('')}</nav>`
        : '';
    const galeria =
      fotos.length > 0 && t.medios
        ? `<div class="ficha__galeria"><div class="ficha__fotos" data-fotos>${fotos.map((f, i) => imagen(f, 'ficha__foto', TAMANO_FICHA, i === 0, p.nombre).replace('<span class="ficha__foto">', `<span class="ficha__foto" id="foto-${i + 1}">`)).join('')}</div>${miniaturas}</div>`
        : '<div class="ficha__foto" aria-hidden="true"></div>';
    return [
      `<article class="ficha"${p.soloMayores ? ' data-solo-mayores' : ''}>`,
      galeria,
      '<div class="ficha__datos">',
      p.nuevo ? '<p class="etiqueta-nuevo">Nuevo</p>' : '',
      `<h1>${escaparHtml(p.nombre)}</h1>`,
      // HU-T5.8 CA1: el precio, el de antes, las existencias y la nota, en un bloque.
      '<div class="ficha__precio">',
      `<p class="precio" data-precio>${variaElPrecio(p) ? 'Desde ' : ''}${formatearPesos(precioDesde(p))}</p>`,
      `<p class="precio__antes" data-antes${antesInicial ? '' : ' hidden'}>Antes <s>${antesInicial ? formatearPesos(antesInicial) : ''}</s></p>`,
      `<p class="quedan" data-quedan${quedanInicial ? '' : ' hidden'}>${quedanInicial ? (quedanInicial === 1 ? 'Queda 1' : `Quedan ${quedanInicial}`) : ''}</p>`,
      `<p class="precio__nota">${notaDelPrecio}</p>`,
      '</div>',
      `<form class="eleccion" data-eleccion>${grupos}${mayoria}<div class="avisame" data-avisame hidden><p>Esta combinación está agotada.</p><button class="boton boton--secundario" type="button" data-avisame-boton>Avísame cuando haya</button><p class="aviso" data-avisame-estado role="status" hidden></p></div><p class="aviso" data-aviso role="status" hidden></p><button class="boton boton--principal" type="submit" data-boton aria-disabled="${inicial.tipo !== 'lista'}">${escaparHtml(inicial.texto)}</button></form>`,
      // HU-T5.8 CA3: compartir. Sin JavaScript, el enlace de WhatsApp; con él, el menú del teléfono.
      `<p class="compartir"><a class="boton boton--secundario" href="https://wa.me/?text=${encodeURIComponent(`${p.nombre} ${url(`/p/${p.slug}/`)}`)}" target="_blank" rel="noopener" data-compartir="${escaparHtml(url(`/p/${p.slug}/`))}" data-compartir-titulo="${escaparHtml(p.nombre)}">Compartir</a></p>`,
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

  // Todos los productos, en páginas, cuando no caben en la portada.
  const todos = enPaginas(recomendados);
  if (hayMas) {
    todos.forEach((lista, k) => {
      const n = k + 1;
      const ruta = rutaDePagina('/productos/', n);
      pagina({
        ruta,
        titulo: `Productos${n > 1 ? `, página ${n}` : ''} · ${t.nombre}`,
        cuerpo: `<h1>Productos</h1>\n${rejilla(lista, true)}\n${navegacion('/productos/', n, todos.length)}`,
        ld: [
          migas([
            [t.nombre, '/'],
            ['Productos', '/productos/'],
          ]),
        ],
        gemelo: `# Productos${n > 1 ? `, página ${n}` : ''}\n\n${lista.map(lineaMd).join('\n')}\n${navegacionMd('/productos/', n, todos.length)}`,
      });
    });
  }

  // Las colecciones, en páginas si son largas.
  const paginasDeColeccion: string[] = [];
  for (const c of [...(t.colecciones ?? [])].sort((a, b) => (a.slug < b.slug ? -1 : 1))) {
    // HU-T5.10: en su colección, lo destacado primero y después el orden de la colección.
    const porSlug = new Map(productos.map((p) => [p.slug, p]));
    const enOrden = c.productos.flatMap((slug) => {
      const p = porSlug.get(slug);
      return p ? [p] : [];
    });
    const suyos = [...enOrden.filter((p) => p.destacado), ...enOrden.filter((p) => !p.destacado)];
    const base = `/c/${c.slug}/`;
    const paginas = enPaginas(suyos);
    paginas.forEach((lista, k) => {
      const n = k + 1;
      if (n > 1) paginasDeColeccion.push(rutaDePagina(base, n));
      pagina({
        ruta: rutaDePagina(base, n),
        titulo: `${c.nombre}${n > 1 ? `, página ${n}` : ''} · ${t.nombre}`,
        cuerpo: `<h1>${escaparHtml(c.nombre)}</h1>\n${rejilla(lista, true, c.slug)}${paginas.length > 1 ? `\n${navegacion(base, n, paginas.length)}` : ''}`,
        ld: [
          migas([
            [t.nombre, '/'],
            [c.nombre, base],
          ]),
        ],
        gemelo: `# ${markdownPlano(c.nombre)}${n > 1 ? `, página ${n}` : ''}\n\n${lista.map(lineaMd).join('\n')}\n${navegacionMd(base, n, paginas.length)}`,
      });
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
  // En línea, primero y solo si la tienda cobra con su Bold (HU-T11.4); las demás, como las declara.
  const otras = (t.legal?.formas ?? []).filter((f) => f.forma !== 'en_linea');
  const formas = t.cobroEnLinea ? [{ forma: 'en_linea' as const }, ...otras] : otras;
  const enviosConId = (t.legal?.envios ?? []).filter((e) => presente(e.id));
  const tarjetaDeForma = (f: (typeof formas)[number]) =>
    `<label class="opcion-grande"><input type="radio" name="forma" value="${f.forma}"><span class="opcion-grande__nombre">${escaparHtml(NOMBRE_DE_LA_FORMA[f.forma])}</span><span class="opcion-grande__nota">${escaparHtml(NOTA_DE_LA_FORMA[f.forma])}</span></label>`;
  const tarjetaDeEnvio = (e: (typeof enviosConId)[number]) =>
    `<label class="opcion-grande"><input type="radio" name="envio" value="${escaparHtml(e.id ?? '')}"><span class="opcion-grande__nombre">${escaparHtml(e.nombre)} · ${e.precioCop === 0 ? 'gratis' : formatearPesos(e.precioCop)}</span><span class="opcion-grande__nota">${escaparHtml(`${e.gratisDesdeCop !== null && e.precioCop > 0 ? `Gratis desde ${formatearPesos(e.gratisDesdeCop)}; ` : ''}${plazoDelEnvio(e.diasMin, e.diasMax)}.`)}</span></label>`;
  const datosDeVenta = {
    formas: formas.map((f) => ({ forma: f.forma, nombre: NOMBRE_DE_LA_FORMA[f.forma] })),
    envios: enviosConId.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      plazo: plazoDelEnvio(e.diasMin, e.diasMax),
    })),
    terminos: huellaDeLosTerminos,
    ...(t.cobroEnLinea ? { enLinea: true } : {}),
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
      '<p class="pedido__vaciar"><button type="button" class="boton boton--secundario" data-vaciar hidden>Vaciar el pedido</button></p>',
      '<div class="resumen" data-resumen hidden><p class="resumen__fila">Subtotal <span class="cifra" data-subtotal></span></p><p class="resumen__fila" data-fila-envio hidden>Envío <span class="cifra" data-envio></span></p><p class="resumen__fila" data-fila-descuento hidden>Descuento <span class="cifra" data-descuento></span></p><p class="resumen__fila resumen__total">Total <span class="cifra" data-total></span></p><p class="aviso aviso--fuerte" data-aviso-total role="alert" hidden></p><p class="resumen__nota" data-nota>El envío se confirma antes de enviar el pedido.</p></div>',
      `<form class="venta" data-venta hidden novalidate>`,
      formas.length > 0
        ? `<fieldset class="grupo"><legend>¿Cómo quieres pagar?</legend>${formas.map(tarjetaDeForma).join('')}</fieldset>`
        : '',
      enviosConId.length > 0
        ? `<fieldset class="grupo"><legend>¿Cómo te llega?</legend>${enviosConId.map(tarjetaDeEnvio).join('')}</fieldset>`
        : '',
      '<label class="campo">Ciudad de entrega (si te lo envían)<input name="ciudad" maxlength="60" autocomplete="address-level2"></label>',
      // HU-T11.4: pagando en línea no hay chat donde dar la entrega; van cifrados a la tienda.
      t.cobroEnLinea
        ? '<fieldset class="grupo" data-entrega hidden><legend>¿A quién se lo entregamos?</legend><label class="campo">Nombre de quien recibe<input name="nombre" maxlength="120" autocomplete="name"></label><label class="campo">Celular<input name="celular" type="tel" inputmode="tel" maxlength="20" autocomplete="tel"></label><label class="campo">Dirección (si te lo envían)<input name="direccion" maxlength="300" autocomplete="street-address"></label><label class="campo">Correo (opcional)<input name="correo" type="email" maxlength="200" autocomplete="email"></label></fieldset>'
        : '',
      '<label class="acepto"><input type="checkbox" name="acepta" data-acepta><span>Acepto los <a href="/legal/terminos/">términos y condiciones</a> y la <a href="/legal/privacidad/">política de datos</a>.</span></label>',
      '<p class="aviso" data-aviso-venta role="status" hidden></p>',
      '<button class="boton boton--principal" type="submit" data-enviar aria-disabled="true">Elige cómo pagar</button>',
      '<p class="resumen__nota" data-nota-venta>Te llevamos a WhatsApp con tu pedido escrito. Los datos de entrega se los das a la tienda allí.</p>',
      t.cobroEnLinea
        ? '<p class="resumen__nota" data-nota-en-linea hidden>Pagas en la página segura de Bold sin salir de la tienda. Tus datos de entrega le llegan cifrados a la tienda.</p><div class="acuse__enlace" data-enlace-del-pago hidden><p>Guarda este enlace para seguir tu pedido, aunque vuelvas desde otro navegador: <a data-enlace-del-pedido></a></p><p class="acuse__acciones"><button type="button" class="boton" data-copiar-enlace>Copiar el enlace</button> <a class="boton" data-enlace-whatsapp rel="nofollow">Mandármelo por WhatsApp</a></p></div>'
        : '',
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
      '<p class="acuse__estado">Estado: <strong data-acuse-estado></strong></p>',
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
   * La vuelta de Bold (HU-T11.4, TIENDA §9.3): `redirectionUrl` del botón. Bold le agrega
   * `?bold-order-id=…&bold-tx-status=…`, que nunca se creen: la isla no los lee. Lleva al pedido con
   * el enlace que la página guardó antes de abrir Bold; el estado lo dice el seguimiento, con lo que
   * confirme Bold (HU-T11.5 y HU-T11.6).
   */
  if (t.cobroEnLinea) {
    pagina({
      ruta: '/pedido/pago/',
      titulo: `Tu pago · ${t.nombre}`,
      privada: true,
      cuerpo: [
        '<h1>Tu pago</h1>',
        '<div class="seguimiento" data-vuelta-del-pago>',
        '<p class="estado">Si pagaste, Bold le avisa a la tienda y tu pedido queda pagado. Lo ves con el enlace de seguimiento que guardaste antes de pagar.</p>',
        '<p class="aviso" data-vuelta-aviso role="status" hidden></p>',
        '<a class="boton boton--principal" data-vuelta-enlace hidden>Ver mi pedido</a>',
        '<a class="boton" href="/carrito/" data-vuelta-carrito hidden>Volver al carrito</a>',
        '</div>',
      ].join('\n'),
      ld: [],
      gemelo: `# Tu pago\n\nEl estado de un pago se ve con el enlace de seguimiento del pedido, que solo tiene quien lo hizo.\n`,
    });
  }

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

  // HU-T10.2: cada página propia, con su gemelo. Su texto es Markdown seguro, como la descripción
  // de un producto: nada de HTML del comercio llega a la página.
  for (const p of paginasPropias) {
    const ruta = `/${p.slug}/`;
    pagina({
      ruta,
      titulo: `${p.titulo} · ${t.nombre}`,
      cuerpo: `<h1>${escaparHtml(p.titulo)}</h1>\n<div class="legal">${markdownSeguro(p.cuerpo)}</div>`,
      ld: [
        migas([
          [t.nombre, '/'],
          [p.titulo, ruta],
        ]),
      ],
      gemelo: `# ${markdownPlano(p.titulo)}\n\n${p.cuerpo.trim()}\n`,
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
        ...(fotoPequena(p.fotos?.[0]) ? { foto: fotoPequena(p.fotos?.[0]) } : {}),
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
    ...paginasDeColeccion.map((r) => [r, ultima] as const),
    ...(hayMas ? todos.map((_, k) => [rutaDePagina('/productos/', k + 1), ultima] as const) : []),
    ...legales.map((x) => [x.ruta, undefined] as const),
    ...paginasPropias.map((p) => [`/${p.slug}/`, undefined] as const),
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
  // HU-T14.5: los feeds encendidos, con la disponibilidad de ahora.
  for (const f of archivosDeLosFeeds(t, t.feeds)) poner(f.ruta, f.tipo, f.contenido);
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
      // HU-T5.13: el ícono de la app, el mismo de la pestaña.
      ...(t.icono && t.medios && t.org
        ? {
            icono: {
              src: urlDeFoto(t.icono, 400),
              tamano: `400x${Math.round((400 * t.icono.alto) / t.icono.ancho)}`,
              tipo: t.icono.formato === 'jpeg' ? 'image/jpeg' : 'image/webp',
            },
          }
        : {}),
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
  /** HU-T14.4: lo que la versión mide con terceros; el despacho suma sus orígenes a la CSP. */
  terceros: readonly Tercero[] = [],
): Promise<{
  archivos: Record<string, { huella: string; tipo: string; bytes: number }>;
  redirecciones?: Record<string, string>;
  terceros?: Tercero[];
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
    ...(terceros.length > 0 ? { terceros: [...terceros].sort() } : {}),
    ...(saltos.length > 0 ? { redirecciones: Object.fromEntries(saltos) } : {}),
    huella: await huella(
      [
        ...entradas.map(([r, e]) => `${r} ${e.huella}`),
        ...saltos.map(([desde, hacia]) => `${desde} -> ${hacia}`),
        ...[...terceros].sort().map((x) => `tercero ${x}`),
      ].join('\n'),
    ),
  };
}
