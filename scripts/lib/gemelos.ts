/**
 * Lo legible por agentes sin JavaScript (HU-C8.2, PLATAFORMA §5.3): un `index.md` junto al
 * `index.html` de cada página pública del sitio, y `/llms.txt` con lo que hay.
 *
 * - **Pública** es lo que se indexa: una página con `noindex` (un borrador, la app, el QR) no tiene
 *   gemelo ni entra a `llms.txt`. Es la misma compuerta de la revisión agronómica que manda sobre
 *   el sitemap: una calculadora en revisión no se ofrece a un agente.
 * - **El gemelo sale del HTML ya construido** (el `<article>` o el `<main>`), no de una segunda
 *   copia del texto (P2): lo que lee el agente es lo que lee la persona. La calculadora, que es una
 *   isla de JavaScript, no está; su cálculo a mano, sí.
 * - **Un enlace de `llms.txt` que no existe en el build lo detiene** (CA3, P1).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// ---------------------------------------------------------------------------------------------
// HTML → Markdown, para el HTML que produce este sitio (no para cualquier HTML).

type Nodo = { tag: string; attrs: string; hijos: Nodo[] } | string;

const VACIOS = new Set(['br', 'img', 'meta', 'link', 'input', 'hr', 'source', 'wbr', 'path']);
const IGNORADOS = new Set([
  'script',
  'style',
  'svg',
  'noscript',
  'nav',
  'header',
  'footer',
  'form',
  'button',
  'astro-island',
  'template',
  'select',
  'textarea',
  'dialog',
]);

const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};
const decodificar = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (todo, e: string) => {
    if (e[0] === '#')
      return String.fromCodePoint(
        e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1)),
      );
    return ENTIDADES[e.toLowerCase()] ?? todo;
  });

function arbol(html: string): Nodo[] {
  const raiz: Nodo = { tag: '#raiz', attrs: '', hijos: [] };
  const pila: Exclude<Nodo, string>[] = [raiz];
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^>]*)>|[^<]+|</g)) {
    const actual = pila[pila.length - 1] as Exclude<Nodo, string>;
    const [todo, cierre, tagCrudo, attrs = ''] = m;
    if (todo.startsWith('<!--')) continue;
    if (!tagCrudo) {
      actual.hijos.push(todo);
      continue;
    }
    const tag = tagCrudo.toLowerCase();
    if (cierre) {
      const i = pila.map((n) => n.tag).lastIndexOf(tag);
      if (i > 0) pila.length = i;
      continue;
    }
    const nodo = { tag, attrs, hijos: [] as Nodo[] };
    actual.hijos.push(nodo);
    if (!VACIOS.has(tag) && !attrs.trimEnd().endsWith('/')) pila.push(nodo);
  }
  return raiz.hijos;
}

const atributo = (attrs: string, nombre: string) =>
  attrs.match(new RegExp(`\\b${nombre}\\s*=\\s*"([^"]*)"`, 'i'))?.[1] ??
  attrs.match(new RegExp(`\\b${nombre}\\s*=\\s*'([^']*)'`, 'i'))?.[1];

function enLinea(nodos: Nodo[]): string {
  return nodos
    .map((n) => {
      if (typeof n === 'string') return decodificar(n).replace(/\s+/g, ' ');
      if (IGNORADOS.has(n.tag)) return '';
      const dentro = enLinea(n.hijos);
      switch (n.tag) {
        case 'strong':
        case 'b':
          return dentro.trim() ? `**${dentro.trim()}**` : '';
        case 'em':
        case 'i':
          return dentro.trim() ? `*${dentro.trim()}*` : '';
        case 'code':
          return `\`${dentro.trim()}\``;
        case 'br':
          return '\n';
        case 'a': {
          const href = atributo(n.attrs, 'href');
          return href && dentro.trim() ? `[${dentro.trim()}](${decodificar(href)})` : dentro;
        }
        default:
          return dentro;
      }
    })
    .join('')
    .replace(/ +/g, ' ');
}

const BLOQUES = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'table',
  'blockquote',
  'pre',
  'details',
  'summary',
  'section',
  'article',
  'main',
  'div',
  'figure',
  'figcaption',
  'aside',
]);
const tieneBloques = (nodos: Nodo[]): boolean =>
  nodos.some((n) => typeof n !== 'string' && (BLOQUES.has(n.tag) || tieneBloques(n.hijos)));

function bloques(nodos: Nodo[], sangria = ''): string[] {
  const salida: string[] = [];
  let suelto: Nodo[] = [];
  const soltar = () => {
    const texto = enLinea(suelto).trim();
    if (texto) salida.push(texto);
    suelto = [];
  };
  for (const n of nodos) {
    if (typeof n === 'string' || (!BLOQUES.has(n.tag) && !tieneBloques(n.hijos))) {
      if (typeof n !== 'string' && IGNORADOS.has(n.tag)) continue;
      suelto.push(n);
      continue;
    }
    soltar();
    if (IGNORADOS.has(n.tag)) continue;
    const h = /^h([1-6])$/.exec(n.tag);
    if (h) {
      const texto = enLinea(n.hijos).trim();
      if (texto) salida.push(`${'#'.repeat(Number(h[1]))} ${texto}`);
      continue;
    }
    switch (n.tag) {
      case 'p':
      case 'figcaption': {
        const texto = enLinea(n.hijos).trim();
        if (texto) salida.push(texto);
        break;
      }
      case 'summary': {
        const texto = enLinea(n.hijos).trim();
        if (texto) salida.push(`**${texto}**`);
        break;
      }
      case 'ul':
      case 'ol': {
        const items = n.hijos.filter(
          (x): x is Exclude<Nodo, string> => typeof x !== 'string' && x.tag === 'li',
        );
        const lineas = items.map((li, i) => {
          const marca = n.tag === 'ol' ? `${i + 1}. ` : '- ';
          const partes = tieneBloques(li.hijos)
            ? bloques(li.hijos, `${sangria}  `)
            : [enLinea(li.hijos).trim()];
          return `${marca}${partes.join(`\n${sangria}  `)}`;
        });
        if (lineas.length > 0) salida.push(lineas.join(`\n${sangria}`));
        break;
      }
      case 'dl': {
        for (const x of n.hijos) {
          if (typeof x === 'string') continue;
          const texto = enLinea(x.hijos).trim();
          if (!texto) continue;
          salida.push(x.tag === 'dt' ? `**${texto}**` : texto);
        }
        break;
      }
      case 'blockquote':
        salida.push(
          bloques(n.hijos)
            .join('\n\n')
            .split('\n')
            .map((l) => `> ${l}`.trimEnd())
            .join('\n'),
        );
        break;
      case 'pre':
        salida.push(`\`\`\`\n${decodificar(textoPlano(n.hijos)).trimEnd()}\n\`\`\``);
        break;
      case 'table': {
        const filas = filasDe(n).map((f) => `| ${f.join(' | ')} |`);
        if (filas.length > 0) {
          const columnas = (filas[0]?.match(/\|/g)?.length ?? 2) - 1;
          filas.splice(1, 0, `|${' --- |'.repeat(columnas)}`);
          salida.push(filas.join('\n'));
        }
        break;
      }
      default:
        salida.push(...bloques(n.hijos, sangria));
    }
  }
  soltar();
  return salida;
}

const textoPlano = (nodos: Nodo[]): string =>
  nodos.map((n) => (typeof n === 'string' ? n : textoPlano(n.hijos))).join('');

function filasDe(tabla: Exclude<Nodo, string>): string[][] {
  const filas: string[][] = [];
  const recorrer = (n: Nodo) => {
    if (typeof n === 'string') return;
    if (n.tag === 'tr') {
      filas.push(
        n.hijos
          .filter((c): c is Exclude<Nodo, string> => typeof c !== 'string')
          .filter((c) => c.tag === 'td' || c.tag === 'th')
          .map((c) => enLinea(c.hijos).trim().replace(/\|/g, '\\|')),
      );
      return;
    }
    for (const h of n.hijos) recorrer(h);
  };
  recorrer(tabla);
  return filas;
}

function buscar(nodos: Nodo[], tag: string): Exclude<Nodo, string> | null {
  for (const n of nodos) {
    if (typeof n === 'string') continue;
    if (n.tag === tag) return n;
    const dentro = buscar(n.hijos, tag);
    if (dentro) return dentro;
  }
  return null;
}

/** El Markdown del contenido de una página: su `<article>`, o su `<main>` si no tiene. */
export function htmlAMarkdown(html: string): string {
  const nodos = arbol(html);
  const raiz = buscar(nodos, 'article') ?? buscar(nodos, 'main');
  if (!raiz) return '';
  return `${bloques(raiz.hijos).join('\n\n')}\n`;
}

// ---------------------------------------------------------------------------------------------
// Las páginas públicas del build, sus gemelos y llms.txt.

export interface PaginaPublica {
  /** `/agro/guia/` */
  ruta: string;
  titulo: string;
  descripcion: string;
}

/** Rutas que nunca son del sitio público, aunque una página olvide su `noindex`. */
const FUERA = ['/agro/app/', '/agro/t/'];

export function paginasPublicas(dist: string, nombreDelSitio: string): PaginaPublica[] {
  const paginas: PaginaPublica[] = [];
  const recorrer = (carpeta: string) => {
    for (const nombre of readdirSync(carpeta)) {
      const ruta = join(carpeta, nombre);
      if (statSync(ruta).isDirectory()) {
        recorrer(ruta);
        continue;
      }
      if (nombre !== 'index.html') continue;
      const rel = relative(dist, carpeta).split(sep).join('/');
      const url = rel ? `/${rel}/` : '/';
      if (FUERA.some((f) => url.startsWith(f))) continue;
      const html = readFileSync(ruta, 'utf8');
      if (/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html)) continue;
      const titulo = decodificar(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '')
        .replace(` | ${nombreDelSitio}`, '')
        .trim();
      const descripcion = decodificar(
        html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? '',
      );
      paginas.push({ ruta: url, titulo, descripcion });
    }
  };
  recorrer(dist);
  return paginas.sort((a, b) => a.ruta.localeCompare(b.ruta));
}

export const rutaDelGemelo = (ruta: string) => `${ruta}index.md`;

/** El gemelo de una página: su título, su dirección y su contenido. */
export function gemeloDe(pagina: PaginaPublica, html: string, sitio: string): string {
  const cuerpo = htmlAMarkdown(html).replace(/^# [^\n]*\n+/, '');
  return `# ${pagina.titulo}\n\n> ${pagina.descripcion}\n\nPágina: ${sitio}${pagina.ruta}\n\n${cuerpo}`;
}

export function llmsTxt(
  paginas: readonly PaginaPublica[],
  datos: { nombre: string; lema: string; sitio: string; correo: string },
): string {
  const enlace = (p: PaginaPublica) =>
    `- [${p.titulo}](${datos.sitio}${rutaDelGemelo(p.ruta)}): ${p.descripcion}`;
  const esHerramienta = (p: PaginaPublica) =>
    p.ruta.startsWith('/herramientas/') && p.ruta !== '/herramientas/agro/';
  const herramientas = paginas.filter(esHerramienta);
  const otras = paginas.filter((p) => !esHerramienta(p));
  return `${[
    `# ${datos.nombre}`,
    `> ${datos.lema}. Calculadoras agronómicas gratuitas y un cuaderno de campo que funciona sin señal, para productores de flores y hortalizas bajo invernadero en Colombia.`,
    'Aquí solo está lo publicado: una herramienta en revisión agronómica aparece cuando se publica. Cada enlace lleva a la versión en Markdown de la página.',
    [
      '## Herramientas',
      ...(herramientas.length > 0
        ? herramientas.map(enlace)
        : ['- Ninguna publicada todavía: las calculadoras están en revisión agronómica.']),
    ].join('\n'),
    ['## Para el productor', ...otras.map(enlace)].join('\n'),
    ['## Contacto', `- Correo: ${datos.correo}`].join('\n'),
  ].join('\n\n')}\n`;
}

/** Los enlaces de `llms.txt` hacia el sitio que no existen en el build (CA3). */
export function enlacesQueFaltan(llms: string, dist: string, sitio: string): string[] {
  return [...llms.matchAll(/\]\(([^)]+)\)/g)]
    .map((m) => m[1] ?? '')
    .filter((url) => url.startsWith(sitio))
    .filter((url) => !existsSync(join(dist, ...url.slice(sitio.length).split('/').filter(Boolean))))
    .map((url) => url.slice(sitio.length));
}
