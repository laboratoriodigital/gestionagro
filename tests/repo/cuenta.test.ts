/**
 * HU-C7.2: la cuenta es estática y la sirve el CORE como assets. Estas pruebas leen la fuente y la
 * configuración generada; lo que sale del build lo revisa `scripts/verificar-cuenta.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { wranglerDelCore } from '../../scripts/generar-wrangler.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import {
  fallasDeLasCabeceras,
  fallasDeUnaPagina,
  RUTAS_DEL_WORKER,
} from '../../scripts/lib/cuenta.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const CUENTA = join(RAIZ, 'apps', 'cuenta');
const leer = (...partes: string[]) => readFileSync(join(CUENTA, ...partes), 'utf8');

/** Las rutas del Worker que no son de la API, de OAuth ni de `.well-known`. */
const fueraDeLoPermitido = (rutas: readonly string[]) =>
  rutas.filter((r) => !(RUTAS_DEL_WORKER as readonly string[]).includes(r));

describe('HU-C7.2 · la cuenta, servida por el CORE', () => {
  const assets = wranglerDelCore(cargarCeldas())['assets'] as {
    directory: string;
    run_worker_first: string[];
    not_found_handling: string;
  };

  it('CA1 · los assets son el build de la cuenta, con su página 404', () => {
    expect(assets.directory).toBe('../cuenta/dist');
    expect(assets.not_found_handling).toBe('404-page');
  });

  it('CA3 ❌ · el Worker corre primero solo en la API, OAuth y .well-known', () => {
    expect(fueraDeLoPermitido(assets.run_worker_first)).toEqual([]);
    // Control negativo: un comodín que mande todas las páginas al Worker se nombra.
    expect(fueraDeLoPermitido([...assets.run_worker_first, '/*'])).toEqual(['/*']);
  });
});

describe('HU-C7.2 · lo que la cuenta promete', () => {
  it('CA2 · la CSP solo deja lo propio, y nada se indexa', () => {
    expect(fallasDeLasCabeceras(leer('public', '_headers'))).toEqual([]);
    expect(leer('public', 'robots.txt')).toMatch(/^Disallow: \/$/m);
    expect(
      fallasDeLasCabeceras(
        leer('public', '_headers').replace("style-src 'self'", "style-src 'self' 'unsafe-inline'"),
      ),
    ).toEqual(['la CSP permite código o estilos en línea']);
  });

  it('ninguna página pide JavaScript: ningún componente lleva client:*', () => {
    const astro = (carpeta: string): string[] =>
      readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? astro(join(carpeta, e.name))
          : e.name.endsWith('.astro')
            ? [join(carpeta, e.name)]
            : [],
      );
    const conCliente = astro(join(CUENTA, 'src')).filter((f) =>
      /\sclient:[a-z]+/.test(readFileSync(f, 'utf8')),
    );
    expect(conCliente).toEqual([]);
  });

  it('el verificador del build nombra lo que la CSP bloquearía', () => {
    const buena = '<html><head><meta name="robots" content="noindex, nofollow"></head></html>';
    expect(fallasDeUnaPagina('index.html', buena)).toEqual([]);
    // Un script propio en archivo (la sesión, HU-C7.3) sí.
    expect(
      fallasDeUnaPagina('index.html', `${buena}<script type="module" src="/_astro/a.js"></script>`),
    ).toEqual([]);
    expect(
      fallasDeUnaPagina('x.html', '<script>1</script><p style="color:red" onclick="x()">'),
    ).toEqual([
      'x.html: trae un <script> en línea; la CSP lo bloquea',
      'x.html: trae un atributo style=; la CSP lo bloquea',
      'x.html: trae un manejador en línea (on…=)',
      'x.html: no dice noindex; la cuenta es personal',
    ]);
  });

  it('HU-C6.6, CA2 ❌: un script o una hoja de un tercero se nombran; un enlace a otra página, no', () => {
    const buena = '<html><head><meta name="robots" content="noindex, nofollow"></head></html>';
    expect(
      fallasDeUnaPagina(
        'x.html',
        `${buena}<script src="https://cdn.ejemplo.test/a.js"></script><link rel="stylesheet" href="//fuentes.ejemplo.test/b.css">`,
      ),
    ).toEqual([
      'x.html: un <script> carga algo de otro origen; la CSP lo bloquea',
      'x.html: un <link> carga algo de otro origen; la CSP lo bloquea',
    ]);
    expect(
      fallasDeUnaPagina('x.html', `${buena}<a href="https://cultivopro.co/">CultivoPro</a>`),
    ).toEqual([]);
  });
});

describe('HU-C7.3 · la política de la cuenta', () => {
  const politica = JSON.parse(
    readFileSync(join(RAIZ, 'content', 'cuenta', 'privacidad', 'politica.json'), 'utf8'),
  );

  it('el CORE pide aceptar esta misma versión (P2)', async () => {
    const { CATALOGO } = await import('../../apps/core/src/productos.ts');
    expect(CATALOGO.politicas['cuenta']).toBe(politica.version);
  });

  it('no pasa a «vigente» sin los datos del responsable ni la revisión del abogado', () => {
    const faltan = Object.entries(politica.responsable).filter(([, v]) => !v);
    if (politica.estado === 'vigente') {
      expect(faltan).toEqual([]);
      expect(politica.revision).not.toContain('requiere');
    } else {
      expect(politica.revision).toBe('requiere revisión de abogado');
    }
  });

  it('no declara nada de terceros que la CSP de la cuenta no deja (P18)', () => {
    expect(politica.scripts_de_terceros).toEqual([]);
    expect(politica.scripts_al_pagar).toEqual([]);
    expect(politica.conexiones_de_terceros).toEqual([]);
  });
});
