/**
 * Las e2e de lo afectado (HU-C11.8, que sigue a HU-C11.3): un PR corre solo las e2e de las apps
 * que su cambio puede tocar. En la corrida del 12 oct 2026, las del cuaderno sumaban 220 s de 430,
 * y un sprint del parqueadero que toca un paquete que el cuaderno no usa las corría igual.
 *
 * Cuatro grupos, uno por origen que sirven las e2e (`playwright.config.ts`): **agro** (el sitio con
 * el cuaderno adentro), **cuenta**, **parqueadero** y **tienda** (la vitrina de Ensayo Uno, HU-T5.4). Quién usa a quién se lee del código (P2):
 * los `@ed1/…`, las rutas `packages/…`, `content/…` y `scripts/…` que nombra cada archivo, y sus
 * importaciones relativas. Los nodos son las carpetas de `apps/`, `packages/` y `content/`, y cada
 * archivo de `scripts/` y de `tests/e2e/`; un uso llega hasta una app, una e2e o
 * `playwright.config.ts` (que corre todas).
 *
 * La regla es cerrada (P1): lo que no se sabe clasificar (la raíz, `infrastructure/`, los flujos,
 * `tests/fixtures/`, una app o un contenido nuevos) corre todas. Si el mapa ve un uso de más, corre
 * e2e de más, nunca de menos. La corrida semanal de `main` corre todas siempre.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { esDocumento } from './alcance.ts';
import { listarArchivos, RAIZ } from './repo.ts';

export type GrupoE2e = 'agro' | 'cuenta' | 'parqueadero' | 'tienda';
const GRUPOS: readonly GrupoE2e[] = ['agro', 'cuenta', 'parqueadero', 'tienda'];

/**
 * El grupo de e2e de cada app; `null`, una app que las e2e no sirven (sus Workers se prueban con
 * pruebas unitarias y de integración). Una app que no está aquí corre todas:
 * `e2e-afectado.test.ts` exige que cada carpeta de `apps/` esté.
 */
export const E2E_DE_LA_APP: Readonly<Record<string, GrupoE2e | null>> = {
  sitio: 'agro',
  cuaderno: 'agro',
  cuenta: 'cuenta',
  'parqueadero-sitio': 'parqueadero',
  // Las e2e de la cuenta y de las dos cajas del parqueadero la levantan en el mismo proceso.
  'parqueadero-api': 'parqueadero',
  core: null,
  'api-celda': null,
  ensayo: null,
  // La Tienda: sus Workers se prueban con pruebas de integración; la vitrina que sirve el
  // despacho, horneada por el build de `tienda-sitio`, tiene sus e2e (HU-T5.4). El panel, con
  // HU-T8.1.
  'tienda-api': null,
  'tienda-panel': null,
  'tienda-sitio': 'tienda',
};

/**
 * El grupo de e2e de cada carpeta de `content/`: el contenido también se lee por rutas armadas en
 * el build, que no se ven como un uso. Una carpeta que no está corre todas.
 */
const E2E_DEL_CONTENIDO: Readonly<Record<string, GrupoE2e>> = {
  agro: 'agro',
  cuenta: 'cuenta',
  parqueadero: 'parqueadero',
  tienda: 'tienda',
};

/**
 * El grupo de una e2e por su nombre: `parqueadero-…`, `tienda-…`, `cuenta…` y la galería (que sirve
 * la cuenta).
 */
export function grupoDelSpec(nombre: string): GrupoE2e {
  if (nombre.startsWith('parqueadero-')) return 'parqueadero';
  if (nombre.startsWith('tienda-')) return 'tienda';
  if (nombre.startsWith('cuenta') || nombre === 'galeria') return 'cuenta';
  return 'agro';
}

/** De cada nodo, los nodos que nombra. */
export type Usos = ReadonlyMap<string, ReadonlySet<string>>;

export type SeleccionE2e =
  | { readonly todas: true; readonly motivo: string }
  | { readonly todas: false; readonly grupos: readonly GrupoE2e[]; readonly motivo: string };

const todas = (motivo: string): SeleccionE2e => ({ todas: true, motivo });

const CONFIG_DE_PLAYWRIGHT = 'playwright.config.ts';

/** El nodo de una ruta del repositorio, o `null` si no es de ninguno. */
export function nodoDe(ruta: string): string | null {
  const r = ruta.replaceAll('\\', '/');
  const carpeta = r.match(/^(apps|packages|content)\/[^/]+(?=\/)/)?.[0];
  if (carpeta) return carpeta;
  if (/^(scripts|tests\/e2e)\/.+\.ts$/.test(r) || r === CONFIG_DE_PLAYWRIGHT) return r;
  // Los datos de prueba: las e2e que los importan o los leen por su ruta.
  if (/^tests\/fixtures\/.+\.(ts|json)$/.test(r)) return r;
  return null;
}

/**
 * Lo que no cambia lo que sirve un navegador: el lint, lo que git ignora y los flujos que no son
 * el CI (el CI sí: dice cómo corren las e2e).
 */
function noTocaLasE2e(r: string): boolean {
  return (
    ['biome.json', '.gitignore', '.gitattributes', '.editorconfig'].includes(r) ||
    (r.startsWith('.github/') && r !== '.github/workflows/ci.yml')
  );
}

/**
 * A qué conduce un nodo: el grupo de una app o de una e2e, `null` si no conduce a ninguno, o
 * `undefined` si no se sabe (una app nueva, `playwright.config.ts`: todas).
 */
function grupoDelNodo(nodo: string): GrupoE2e | null | undefined | 'seguir' {
  if (nodo === CONFIG_DE_PLAYWRIGHT) return undefined;
  if (nodo.startsWith('apps/')) return E2E_DE_LA_APP[nodo.slice('apps/'.length)];
  const spec = nodo.match(/^tests\/e2e\/([^/]+)\.spec\.ts$/)?.[1];
  if (spec) return grupoDelSpec(spec);
  return 'seguir';
}

/**
 * Los grupos a los que llega un nodo por quienes lo usan, directa o indirectamente; `undefined` si
 * alguno de los caminos llega a algo que no se sabe clasificar.
 */
function gruposQueAlcanza(
  nodo: string,
  usos: Usos,
): { grupos: Set<GrupoE2e>; desconocido?: string } {
  const grupos = new Set<GrupoE2e>();
  const vistos = new Set<string>([nodo]);
  const pendientes = [nodo];
  while (pendientes.length > 0) {
    const actual = pendientes.pop() as string;
    const propio = grupoDelNodo(actual);
    if (propio === undefined) return { grupos, desconocido: actual };
    if (propio !== 'seguir') {
      if (propio) grupos.add(propio);
      continue;
    }
    for (const [quien, nombra] of usos) {
      if (!nombra.has(actual) || vistos.has(quien)) continue;
      vistos.add(quien);
      pendientes.push(quien);
    }
  }
  return { grupos };
}

/** `archivos` es la lista cambiada, o `null` si no se pudo calcular. */
export function e2eDelCambio(archivos: readonly string[] | null, usos: Usos): SeleccionE2e {
  if (archivos === null) return todas('no se pudo calcular qué cambió');
  if (archivos.length === 0) return todas('no hay archivos cambiados');
  const grupos = new Set<GrupoE2e>();
  for (const original of archivos) {
    const r = original.replaceAll('\\', '/');
    // Ni un documento ni una prueba que no es e2e cambian lo que sirve un navegador.
    if (
      esDocumento(r) ||
      noTocaLasE2e(r) ||
      /\.test\.tsx?$/.test(r) ||
      /^tests\/(repo|integracion)\//.test(r)
    ) {
      continue;
    }
    // Las instantáneas de una e2e son de su grupo.
    const instantanea = r.match(/^tests\/e2e\/([^/]+)\.spec\.ts-instantaneas\//)?.[1];
    if (instantanea) {
      grupos.add(grupoDelSpec(instantanea));
      continue;
    }
    // La migración de la celda del parqueadero la cargan las e2e que levantan su API.
    if (r.startsWith('infrastructure/migraciones/parqueadero/')) {
      grupos.add('parqueadero');
      continue;
    }
    const nodo = nodoDe(r);
    if (!nodo) return todas(`${r} no es de una app, un paquete, un contenido, un guion ni una e2e`);
    if (nodo.startsWith('content/')) {
      const grupo = E2E_DEL_CONTENIDO[nodo.slice('content/'.length)];
      if (!grupo) return todas(`el contenido ${nodo} no tiene grupo de e2e`);
      grupos.add(grupo);
    }
    const alcanza = gruposQueAlcanza(nodo, usos);
    if (alcanza.desconocido) {
      return todas(`${r} llega a ${alcanza.desconocido}, que no tiene grupo de e2e`);
    }
    for (const g of alcanza.grupos) grupos.add(g);
  }
  if (grupos.size === GRUPOS.length) return todas('el cambio toca todos los grupos');
  const lista = GRUPOS.filter((g) => grupos.has(g));
  return {
    todas: false,
    grupos: lista,
    motivo:
      lista.length === 0
        ? 'el cambio no toca nada que sirvan las e2e'
        : `el cambio solo toca ${lista.join(' y ')}`,
  };
}

/** Lo que un archivo nombra sin importarlo con ruta relativa: paquetes, contenidos y guiones. */
const NOMBRA =
  /@ed1\/([a-z0-9-]+)|\b(packages|content)\/([a-z0-9-]+)\/|\b(scripts\/[A-Za-z0-9_/.-]+?\.ts|tests\/fixtures\/[A-Za-z0-9_/.-]+?\.(?:ts|json))\b/g;
/** Una importación relativa: `from './x.ts'`, `import('../y.ts')`, `import './z.css'`. */
const IMPORTA = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"](\.{1,2}\/[^'"]+)['"]/g;
/** Una línea que es solo comentario (`//`, `/*`, ` * …`): nombrar algo ahí no es usarlo. */
const SOLO_COMENTARIO = /^\s*(\/\/|\/\*|\*)/;

/** El archivo al que apunta una importación relativa, con o sin extensión. */
function resolver(desde: string, especificador: string, raiz: string): string {
  const ruta = posix.normalize(posix.join(posix.dirname(desde), especificador));
  if (/\.[a-z]+$/.test(ruta)) return ruta;
  for (const candidato of [`${ruta}.ts`, `${ruta}.tsx`, `${ruta}/index.ts`]) {
    if (existsSync(join(raiz, candidato))) return candidato;
  }
  return ruta;
}

/**
 * Lee del repositorio quién nombra a quién. Las pruebas, los Markdown y las líneas de comentario no
 * cuentan.
 */
export function leerUsos(raiz = RAIZ): Usos {
  const usos = new Map<string, Set<string>>();
  const archivos = listarArchivos(
    (r) =>
      ((/^(apps|packages|content)\/[^/]+\//.test(r) &&
        /\.(tsx?|astro|m?js|css|json|html)$/.test(r)) ||
        /^(scripts|tests\/e2e|tests\/fixtures)\/.+\.ts$/.test(r) ||
        r === CONFIG_DE_PLAYWRIGHT) &&
      !/\.test\.tsx?$/.test(r),
    raiz,
  );
  for (const r of archivos) {
    const quien = nodoDe(r) as string;
    const nombra = usos.get(quien) ?? new Set<string>();
    const codigo = readFileSync(join(raiz, r), 'utf8')
      .split('\n')
      .filter((l) => !SOLO_COMENTARIO.test(l))
      .join('\n');
    for (const m of codigo.matchAll(NOMBRA)) {
      const nodo = m[1] ? `packages/${m[1]}` : m[2] ? `${m[2]}/${m[3]}` : (m[4] as string);
      if (nodo !== quien) nombra.add(nodo);
    }
    for (const m of codigo.matchAll(IMPORTA)) {
      const nodo = nodoDe(resolver(r, m[1] as string, raiz));
      if (nodo && nodo !== quien) nombra.add(nodo);
    }
    usos.set(quien, nombra);
  }
  return usos;
}

/** Los archivos de e2e de esos grupos, para pasárselos a Playwright. */
export function specsDe(grupos: readonly GrupoE2e[], raiz = RAIZ): string[] {
  return listarArchivos((r) => /^tests\/e2e\/[^/]+\.spec\.ts$/.test(r), raiz).filter((r) =>
    grupos.includes(grupoDelSpec(r.slice('tests/e2e/'.length, -'.spec.ts'.length))),
  );
}
