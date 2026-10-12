import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOST_DE_PRODUCCION } from '../../apps/parqueadero-sitio/src/caja/entorno.ts';
import plantilla from '../../content/parqueadero/privacidad/aviso.json' with { type: 'json' };
import politica from '../../content/parqueadero/privacidad/politica.json' with { type: 'json' };
import { ORIGEN_DEL_RECIBO } from '../../packages/parqueadero-recibos/src/enlace.ts';
import {
  DATASET_PARQUEADERO,
  DOMINIO_PARQUEADERO,
  RUTA_WRANGLER_PARQUEADERO,
  textoWranglerDelParqueadero,
  WORKER_PARQUEADERO,
  wranglerDelParqueadero,
  ZONA_PARQUEADERO,
} from '../../scripts/generar-wrangler.ts';
import {
  conexionesDeLaCaja,
  cspDelParqueadero,
  driveDeLaCaja,
  robotsDelParqueadero,
  textoDeCabecerasDelParqueadero,
} from '../../scripts/lib/cabeceras-parqueadero.ts';
import { humoParqueadero } from '../../scripts/lib/humo-parqueadero.ts';
import { listarArchivos, RAIZ } from '../../scripts/lib/repo.ts';

/** El sitio del parqueadero en staging (BACKLOG-PARKING_MVP HU-Q5.1, HU-Q3.1). */
describe('el sitio del parqueadero', () => {
  it('wrangler.jsonc es exactamente el generado, con su staging (P2)', () => {
    expect(readFileSync(RUTA_WRANGLER_PARQUEADERO, 'utf8')).toBe(textoWranglerDelParqueadero());
    const config = wranglerDelParqueadero();
    expect(config['env']).toEqual({
      staging: {
        name: `${WORKER_PARQUEADERO}-staging`,
        workers_dev: true,
        routes: [],
        analytics_engine_datasets: [
          { binding: 'EVENTOS', dataset: `${DATASET_PARQUEADERO}_staging` },
        ],
      },
    });
  });

  it('el Worker solo corre para `/_m`, los eventos de la caja; lo demás es asset (HU-Q5.3)', () => {
    const config = wranglerDelParqueadero();
    expect(config['main']).toBe('src/worker.ts');
    expect(config['assets']).toEqual({
      directory: './dist',
      binding: 'ASSETS',
      run_worker_first: ['/_m'],
    });
    expect(config['analytics_engine_datasets']).toEqual([
      { binding: 'EVENTOS', dataset: DATASET_PARQUEADERO },
    ]);
  });

  it('producción va a su dominio y nunca a workers.dev (HU-Q5.2 CA1 y CA3)', () => {
    const config = wranglerDelParqueadero();
    expect(config['workers_dev']).toBe(false);
    expect(config['routes']).toEqual([{ pattern: DOMINIO_PARQUEADERO, custom_domain: true }]);
    expect(DOMINIO_PARQUEADERO.endsWith(`.${ZONA_PARQUEADERO}`)).toBe(true);
  });

  it('el dominio, la caja y los recibos dicen el mismo host (HU-Q5.2 CA3 ❌, P2)', () => {
    expect(HOST_DE_PRODUCCION).toBe(DOMINIO_PARQUEADERO);
    expect(new URL(ORIGEN_DEL_RECIBO).host).toBe(DOMINIO_PARQUEADERO);
    expect(ORIGEN_DEL_RECIBO).not.toContain('workers.dev');
    const dominios = JSON.parse(
      readFileSync(join(RAIZ, 'infrastructure', 'dominios.json'), 'utf8'),
    );
    expect(dominios.reservados_app.proyecto).toContain(DOMINIO_PARQUEADERO.split('.')[0]);
    const zona = dominios.dominios.find((d: { dominio: string }) => d.dominio === ZONA_PARQUEADERO);
    expect(zona?.zona_activa).toBe(true);
  });

  it('la CSP solo deja código, estilos y conexiones propios, sin unsafe-inline', () => {
    for (const entorno of ['staging', 'produccion'] as const) {
      const csp = cspDelParqueadero(entorno);
      expect(csp).not.toContain('unsafe-inline');
      expect(csp).not.toContain('unsafe-eval');
      for (const d of ['script-src', 'style-src', 'connect-src', 'worker-src']) {
        expect(csp).toContain(`${d} 'self'`);
      }
    }
  });

  it('la caja se conecta a la API de su celda en staging, y en producción a ninguna (HU-Q7.5)', () => {
    expect(conexionesDeLaCaja('staging')).toEqual([
      'https://parqueadero-api-c2-staging.laboratoriodigital-la.workers.dev',
    ]);
    // Y el CORE de staging, para entrar con la cuenta (HU-Q7.6).
    expect(cspDelParqueadero('staging')).toContain(
      "connect-src 'self' https://parqueadero-api-c2-staging.laboratoriodigital-la.workers.dev https://agro-core-staging.laboratoriodigital-la.workers.dev https://www.googleapis.com;",
    );
    // Hasta que HU-Q7.12 publique la celda, la de producción es la de M0.
    expect(conexionesDeLaCaja('produccion')).toEqual([]);
    expect(cspDelParqueadero('produccion')).toMatch(/connect-src 'self';/);
    // Nunca la API del agro.
    expect(cspDelParqueadero('staging')).not.toContain('agro-api');
  });

  it('el Drive de la copia (HU-Q10.1) es el que declara la política, y solo en staging', () => {
    expect(driveDeLaCaja('staging').length).toBeGreaterThan(0);
    for (const o of driveDeLaCaja('staging')) {
      expect(politica.conexiones_de_terceros).toContain(o);
    }
    expect(driveDeLaCaja('produccion')).toEqual([]);
  });

  it('staging no se indexa; producción lleva HSTS y no deja indexar la caja ni los recibos', () => {
    expect(textoDeCabecerasDelParqueadero('staging')).toContain('X-Robots-Tag: noindex');
    expect(textoDeCabecerasDelParqueadero('staging')).not.toContain('Strict-Transport-Security');
    const prod = textoDeCabecerasDelParqueadero('produccion');
    expect(prod).toContain('Strict-Transport-Security');
    expect(prod).toMatch(/\/caja\/\*\n {2}X-Robots-Tag: noindex/);
    expect(prod).toMatch(/\/r\/\*\n {2}X-Robots-Tag: noindex/);
    expect(robotsDelParqueadero('staging')).toContain('Disallow: /\n');
    expect(robotsDelParqueadero('produccion')).toBe(
      'User-agent: *\nDisallow: /caja/\nDisallow: /r/\n',
    );
  });

  it('el build arma la caja y se detiene si le falta una pieza (P16)', () => {
    const paquete = JSON.parse(
      readFileSync(join(RAIZ, 'apps', 'parqueadero-sitio', 'package.json'), 'utf8'),
    ) as { scripts: { build: string } };
    expect(paquete.scripts.build).toMatch(
      /^astro build && vite build --config src\/caja\/vite\.config\.ts && node \.\.\/\.\.\/scripts\/armar-parqueadero\.ts && wrangler deploy --dry-run/,
    );
    const armar = readFileSync(join(RAIZ, 'scripts', 'armar-parqueadero.ts'), 'utf8');
    expect(armar).toContain("'caja/sw.js'");
    expect(armar).toContain('process.exit(1)');
  });

  it('la frase «sin cuenta» del aviso vive solo en su plantilla (HU-Q4.4 CA3 ❌)', () => {
    const frase = plantilla.sin_cuenta.split(',')[0] ?? '';
    expect(frase.length).toBeGreaterThan(20);
    const conLaFrase = listarArchivos(
      (r) =>
        /^(apps|packages|content|scripts)\//.test(r) && /\.(tsx?|astro|json|m?js|html)$/.test(r),
    ).filter((r) => readFileSync(join(RAIZ, r), 'utf8').includes(frase));
    expect(conLaFrase).toEqual(['content/parqueadero/privacidad/aviso.json']);
  });

  it('el toque de WhatsApp solo navega: ningún await entre el toque y la apertura (HU-Q4.1 CA2)', () => {
    const recibo = readFileSync(
      join(RAIZ, 'apps', 'parqueadero-sitio', 'src', 'caja', 'Recibo.tsx'),
      'utf8',
    );
    const inicio = recibo.indexOf('\n  function porWhatsApp() {');
    expect(inicio).toBeGreaterThan(0);
    const cuerpo = recibo.slice(inicio, recibo.indexOf('\n  }\n', inicio));
    expect(cuerpo).not.toMatch(/\bawait\b/);
    expect(recibo).toMatch(/href=\{enlaceConNumero\(/);
  });

  describe('la prueba de humo de staging (HU-Q5.1 CA3)', () => {
    const URL_STAGING = 'https://ed1-parqueadero-staging.ejemplo.workers.dev';
    function sitio(
      cambios: { csp?: string | null; sw?: number; r?: number; m?: number } = {},
    ): typeof fetch {
      return (async (entrada: string | URL | Request) => {
        const ruta = new URL(String(entrada)).pathname;
        if (ruta === '/_m') return new Response('Solo POST', { status: cambios.m ?? 405 });
        if (ruta === '/r/')
          return new Response('<title>Recibo</title>', { status: cambios.r ?? 200 });
        if (ruta === '/caja/sw.js') {
          return new Response('self;', {
            status: cambios.sw ?? 200,
            headers: { 'content-type': 'application/javascript' },
          });
        }
        const cabeceras: Record<string, string> = { 'x-robots-tag': 'noindex' };
        const csp = cambios.csp === undefined ? cspDelParqueadero('staging') : cambios.csp;
        if (csp !== null) cabeceras['content-security-policy'] = csp;
        return new Response('<title>Caja del parqueadero</title>', { headers: cabeceras });
      }) as typeof fetch;
    }

    it('pasa con la caja, su CSP y su service worker', async () => {
      expect(await humoParqueadero(sitio(), URL_STAGING, 'staging')).toEqual([]);
    });

    it('falla sin la CSP, con otra más laxa o sin service worker', async () => {
      expect(await humoParqueadero(sitio({ csp: null }), URL_STAGING, 'staging')).toHaveLength(1);
      expect(
        await humoParqueadero(
          sitio({ csp: "default-src 'self' 'unsafe-inline'" }),
          URL_STAGING,
          'staging',
        ),
      ).toHaveLength(1);
      // La de producción, sin la API de la celda, en staging deja la caja sin sincronizar.
      expect(
        await humoParqueadero(
          sitio({ csp: cspDelParqueadero('produccion') }),
          URL_STAGING,
          'staging',
        ),
      ).toEqual([expect.stringContaining('no trae la CSP de la caja')]);
      expect(await humoParqueadero(sitio({ sw: 404 }), URL_STAGING, 'staging')).toEqual([
        expect.stringContaining('sin service worker'),
      ]);
    });

    it('falla si `/_m` no lo atiende el Worker de eventos (HU-Q5.3)', async () => {
      expect(await humoParqueadero(sitio({ m: 404 }), URL_STAGING, 'staging')).toEqual([
        expect.stringContaining('sin el Worker de eventos'),
      ]);
    });

    it('falla si la página del recibo no abre (HU-Q5.2 CA2)', async () => {
      expect(await humoParqueadero(sitio({ r: 404 }), URL_STAGING, 'staging')).toEqual([
        expect.stringContaining('/r/ respondió 404'),
      ]);
    });
  });
});
