/**
 * Los runbooks del parqueadero no mienten (HU-Q6.2 CA3, P18): cada texto de la caja que nombran
 * en negrita y entre comillas (**«Guardar»**) existe en la caja, y cada archivo que citan existe.
 * Un botón renombrado sin tocar el runbook pone esto en rojo.
 *
 * Los de la celda (HU-Q10.4 CA2) además nombran solo rutas de la API, claves de kill switch,
 * namespaces de KV y direcciones que existen en el código y en `infrastructure/`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import { nombreKvFlags } from '../../scripts/lib/kv-flags.ts';
import { listarArchivos, RAIZ } from '../../scripts/lib/repo.ts';

/** Los cinco de HU-Q6.2 CA1, la hoja del cajero y el retiro de una caja. */
const RUNBOOKS = [
  'parqueadero-puesta-en-marcha.md',
  'parqueadero-impresora-no-imprime.md',
  'parqueadero-cambio-de-topes.md',
  'parqueadero-restaurar-caja.md',
  'parqueadero-arreglos-en-congelamiento.md',
  // La hoja de una página para el cajero (BACKLOG-PARKING_MVP §8.1, D-3).
  'parqueadero-hoja-del-cajero.md',
  // Retirar una caja perdida o robada (HU-Q7.7, WI-Q7.7.4).
  'parqueadero-retirar-caja.md',
  // Los kill switches de la celda (HU-Q10.4).
  'parqueadero-kill-switches.md',
] as const;

/** Los de la celda (HU-Q10.4 CA1): lo que nombran tiene que existir en el código (CA2). */
const DE_LA_CELDA = ['parqueadero-retirar-caja.md', 'parqueadero-kill-switches.md'] as const;

const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');

/** Todo el texto que la caja puede mostrar: su código, sin pruebas. */
const textoDeLaCaja = listarArchivos(
  (r) => /^apps\/parqueadero-sitio\/src\/.+\.tsx?$/.test(r) && !/\.test\.tsx?$/.test(r),
)
  .map(leer)
  .join('\n');

/** Lo que un runbook dice que se ve en la caja: `**«…»**`. */
function textosDePantalla(md: string): string[] {
  return [...md.matchAll(/\*\*«([^»]+)»\*\*/g)].map((m) => m[1] ?? '');
}

/** Los archivos del repositorio que cita entre acentos graves. */
function archivosCitados(md: string): string[] {
  return [
    ...md.matchAll(/`((?:apps|packages|content|docs|scripts|tests|infrastructure)\/[^`\s]+)`/g),
  ].map((m) => m[1] ?? '');
}

/** Las capturas (CA2): imágenes relativas a `docs/runbooks/`. */
function imagenesCitadas(md: string): string[] {
  return [...md.matchAll(/!\[[^\]]*\]\((img\/[^)\s]+)\)/g)].map((m) => `docs/runbooks/${m[1]}`);
}

const faltantes = (md: string) => ({
  textos: textosDePantalla(md).filter((t) => !textoDeLaCaja.includes(t)),
  archivos: [...archivosCitados(md), ...imagenesCitadas(md)].filter(
    (a) => !existsSync(join(RAIZ, a)),
  ),
});

/** Lo que existe de verdad: rutas del Worker, kill switches, KV y direcciones de las celdas. */
function loQueExiste() {
  const worker = leer('apps/parqueadero-api/src/worker.ts');
  const rutas = new Set(
    [...worker.matchAll(/app\.(?:get|post)\('([^']+)'/g)].map((m) => m[1] ?? ''),
  );
  const productos = JSON.parse(leer('infrastructure/productos.json')) as {
    productos: { id: string; kill_switches?: string[] }[];
  };
  const claves = new Set([
    'ks:core',
    'ks:core:pagos',
    ...productos.productos.flatMap((p) => [`ks:core:${p.id}`, ...(p.kill_switches ?? [])]),
  ]);
  const config = cargarCeldas();
  const kv = new Set(
    config.celdas.flatMap((c) =>
      (['staging', 'produccion'] as const).map((d) => nombreKvFlags(c.id, d, c.producto)),
    ),
  );
  const urls = new Set(
    [
      ...config.celdas.flatMap((c) => [c.api, c.api_staging]),
      config.core.url,
      config.core.url_staging,
      config.sitio.url_staging,
    ].filter((u): u is string => typeof u === 'string'),
  );
  return { rutas, claves, kv, urls };
}

/** Lo que un runbook de la celda nombra y no existe. */
function sinRespaldo(md: string, existe = loQueExiste()) {
  const rutas = [...md.matchAll(/`(?:GET |POST )?(\/api\/[a-z0-9/_-]+)`/g)].map((m) => m[1] ?? '');
  const claves = [...md.matchAll(/`(ks:[a-z0-9:-]+)`/g)].map((m) => m[1] ?? '');
  const kv = [...md.matchAll(/`([a-z0-9]+-c[0-9]+-flags(?:-staging)?)`/g)].map((m) => m[1] ?? '');
  const urls = [...md.matchAll(/(https:\/\/[a-z0-9.-]+\.workers\.dev)/g)].map((m) => m[1] ?? '');
  return {
    rutas: rutas.filter((r) => !existe.rutas.has(r)),
    claves: claves.filter((c) => !existe.claves.has(c)),
    kv: kv.filter((k) => !existe.kv.has(k)),
    urls: urls.filter((u) => !existe.urls.has(u)),
  };
}

describe('los runbooks del parqueadero (HU-Q6.2)', () => {
  it('están todos (CA1)', () => {
    for (const r of RUNBOOKS) expect(existsSync(join(RAIZ, 'docs', 'runbooks', r)), r).toBe(true);
  });

  it.each(RUNBOOKS)('%s nombra solo textos y archivos que existen (CA3)', (r) => {
    const md = leer(`docs/runbooks/${r}`);
    expect(textosDePantalla(md).length + archivosCitados(md).length).toBeGreaterThan(0);
    expect(faltantes(md)).toEqual({ textos: [], archivos: [] });
  });

  it('control: un botón que no existe y un archivo que no está se ven en rojo (CA3 ❌)', () => {
    const md =
      'Toque **«Botón que nunca existió»**, abra `docs/parking/no-existe.md` y mire ![x](img/no-existe.png).';
    expect(faltantes(md)).toEqual({
      textos: ['Botón que nunca existió'],
      archivos: ['docs/parking/no-existe.md', 'docs/runbooks/img/no-existe.png'],
    });
  });

  it('el de la impresora y el de la puesta en marcha llevan capturas (CA2)', () => {
    for (const r of RUNBOOKS.slice(0, 2)) {
      expect(imagenesCitadas(leer(`docs/runbooks/${r}`)).length, r).toBeGreaterThan(0);
    }
  });
});

describe('los runbooks de la celda, atados al código (HU-Q10.4)', () => {
  it.each(DE_LA_CELDA)('%s nombra solo rutas, claves, KV y direcciones que existen (CA2)', (r) => {
    expect(sinRespaldo(leer(`docs/runbooks/${r}`))).toEqual({
      rutas: [],
      claves: [],
      kv: [],
      urls: [],
    });
  });

  it('el de los kill switches nombra la clave del producto y su KV de staging (CA1)', () => {
    const md = leer('docs/runbooks/parqueadero-kill-switches.md');
    expect(md).toContain('`ks:parqueadero`');
    expect(md).toContain(`\`${nombreKvFlags('c2', 'staging', 'parqueadero')}\``);
  });

  it('control: una clave, una ruta, un KV y una dirección renombrados se ven en rojo (CA3 ❌)', () => {
    const md =
      'Ponga `ks:parqueadero-sync` en `parqueadero-c9-flags-staging` y pida `GET /api/v1/sincronizar` a https://parqueadero-api-c9-staging.laboratoriodigital-la.workers.dev';
    expect(sinRespaldo(md)).toEqual({
      rutas: ['/api/v1/sincronizar'],
      claves: ['ks:parqueadero-sync'],
      kv: ['parqueadero-c9-flags-staging'],
      urls: ['https://parqueadero-api-c9-staging.laboratoriodigital-la.workers.dev'],
    });
  });
});
