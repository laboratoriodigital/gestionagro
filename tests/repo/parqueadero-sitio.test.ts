import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RUTA_WRANGLER_PARQUEADERO,
  textoWranglerDelParqueadero,
  WORKER_PARQUEADERO,
  wranglerDelParqueadero,
} from '../../scripts/generar-wrangler.ts';
import {
  CSP_DEL_PARQUEADERO,
  textoDeCabecerasDelParqueadero,
} from '../../scripts/lib/cabeceras-parqueadero.ts';
import { humoParqueadero } from '../../scripts/lib/humo-parqueadero.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

/** El sitio del parqueadero en staging (BACKLOG-PARKING_MVP HU-Q5.1, HU-Q3.1). */
describe('el sitio del parqueadero', () => {
  it('wrangler.jsonc es exactamente el generado, solo assets y con su staging (P2)', () => {
    expect(readFileSync(RUTA_WRANGLER_PARQUEADERO, 'utf8')).toBe(textoWranglerDelParqueadero());
    const config = wranglerDelParqueadero();
    expect(config['main']).toBeUndefined();
    expect(config['env']).toEqual({
      staging: { name: `${WORKER_PARQUEADERO}-staging`, workers_dev: true },
    });
  });

  it('la CSP solo deja código, estilos y conexiones propios, sin unsafe-inline', () => {
    expect(CSP_DEL_PARQUEADERO).not.toContain('unsafe-inline');
    expect(CSP_DEL_PARQUEADERO).not.toContain('unsafe-eval');
    for (const d of ['script-src', 'style-src', 'connect-src', 'worker-src']) {
      expect(CSP_DEL_PARQUEADERO).toContain(`${d} 'self'`);
    }
    expect(CSP_DEL_PARQUEADERO).toMatch(/connect-src 'self';/);
  });

  it('staging no se indexa; producción lleva HSTS', () => {
    expect(textoDeCabecerasDelParqueadero('staging')).toContain('X-Robots-Tag: noindex');
    expect(textoDeCabecerasDelParqueadero('staging')).not.toContain('Strict-Transport-Security');
    expect(textoDeCabecerasDelParqueadero('produccion')).toContain('Strict-Transport-Security');
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

  describe('la prueba de humo de staging (HU-Q5.1 CA3)', () => {
    const URL_STAGING = 'https://ed1-parqueadero-staging.ejemplo.workers.dev';
    function sitio(cambios: { csp?: string | null; sw?: number } = {}): typeof fetch {
      return (async (entrada: string | URL | Request) => {
        const ruta = new URL(String(entrada)).pathname;
        if (ruta === '/caja/sw.js') {
          return new Response('self;', {
            status: cambios.sw ?? 200,
            headers: { 'content-type': 'application/javascript' },
          });
        }
        const cabeceras: Record<string, string> = { 'x-robots-tag': 'noindex' };
        const csp = cambios.csp === undefined ? CSP_DEL_PARQUEADERO : cambios.csp;
        if (csp !== null) cabeceras['content-security-policy'] = csp;
        return new Response('<title>Caja del parqueadero</title>', { headers: cabeceras });
      }) as typeof fetch;
    }

    it('pasa con la caja, su CSP y su service worker', async () => {
      expect(await humoParqueadero(sitio(), URL_STAGING)).toEqual([]);
    });

    it('falla sin la CSP, con otra más laxa o sin service worker', async () => {
      expect(await humoParqueadero(sitio({ csp: null }), URL_STAGING)).toHaveLength(1);
      expect(
        await humoParqueadero(sitio({ csp: "default-src 'self' 'unsafe-inline'" }), URL_STAGING),
      ).toHaveLength(1);
      expect(await humoParqueadero(sitio({ sw: 404 }), URL_STAGING)).toEqual([
        expect.stringContaining('sin service worker'),
      ]);
    });
  });
});
