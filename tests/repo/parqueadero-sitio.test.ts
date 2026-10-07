import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { origenDelRecibo } from '../../apps/parqueadero-sitio/src/caja/entorno.ts';
import plantilla from '../../content/parqueadero/privacidad/aviso.json' with { type: 'json' };
import { ORIGEN_DEL_RECIBO } from '../../packages/parqueadero-recibos/src/enlace.ts';
import {
  DOMINIO_DEL_PARQUEADERO,
  RUTA_WRANGLER_PARQUEADERO,
  textoWranglerDelParqueadero,
  WORKER_PARQUEADERO,
  wranglerDelParqueadero,
} from '../../scripts/generar-wrangler.ts';
import {
  CSP_DEL_PARQUEADERO,
  textoDeCabecerasDelParqueadero,
  textoDeRobotsDelParqueadero,
} from '../../scripts/lib/cabeceras-parqueadero.ts';
import { zonaActivaDe } from '../../scripts/lib/cuentas-y-dominios.ts';
import { humoParqueadero } from '../../scripts/lib/humo-parqueadero.ts';
import { listarArchivos, RAIZ } from '../../scripts/lib/repo.ts';

/** El sitio del parqueadero en staging (BACKLOG-PARKING_MVP HU-Q5.1, HU-Q3.1). */
describe('el sitio del parqueadero', () => {
  it('wrangler.jsonc es exactamente el generado, solo assets y con su staging (P2)', () => {
    expect(readFileSync(RUTA_WRANGLER_PARQUEADERO, 'utf8')).toBe(textoWranglerDelParqueadero());
    const config = wranglerDelParqueadero();
    expect(config['main']).toBeUndefined();
    expect(config['env']).toEqual({
      staging: { name: `${WORKER_PARQUEADERO}-staging`, workers_dev: true, routes: [] },
    });
  });

  it('producción vive solo en su dominio, con la zona activa y el nombre reservado (HU-Q5.2 CA1)', () => {
    const config = wranglerDelParqueadero();
    expect(config['workers_dev']).toBe(false);
    expect(config['routes']).toEqual([{ pattern: DOMINIO_DEL_PARQUEADERO, custom_domain: true }]);
    expect(zonaActivaDe(DOMINIO_DEL_PARQUEADERO)).toBe(true);
    const dominios = JSON.parse(
      readFileSync(join(RAIZ, 'infrastructure', 'dominios.json'), 'utf8'),
    ) as { reservados_app: { proyecto: string[] } };
    expect(dominios.reservados_app.proyecto).toContain(DOMINIO_DEL_PARQUEADERO.split('.')[0]);
  });

  it('ningún recibo de producción enlaza a workers.dev (HU-Q5.2 CA3 ❌)', () => {
    const enProduccion = origenDelRecibo({
      hostname: DOMINIO_DEL_PARQUEADERO,
      origin: `https://${DOMINIO_DEL_PARQUEADERO}`,
    });
    expect(enProduccion).toBe(ORIGEN_DEL_RECIBO);
    expect(new URL(ORIGEN_DEL_RECIBO).host).toBe(DOMINIO_DEL_PARQUEADERO);
    expect(enProduccion).not.toContain('workers.dev');
  });

  it('una zona que no está activa no se puede desplegar (HU-Q5.2 CA3 ❌)', () => {
    expect(zonaActivaDe('parqueadero.no-declarado.app')).toBe(false);
    const fuente = readFileSync(join(RAIZ, 'scripts', 'desplegar.ts'), 'utf8');
    expect(fuente).toMatch(/if \(!zonaActivaDe\(DOMINIO_DEL_PARQUEADERO\)\)/);
  });

  it('la CSP solo deja código, estilos y conexiones propios, sin unsafe-inline', () => {
    expect(CSP_DEL_PARQUEADERO).not.toContain('unsafe-inline');
    expect(CSP_DEL_PARQUEADERO).not.toContain('unsafe-eval');
    for (const d of ['script-src', 'style-src', 'connect-src', 'worker-src']) {
      expect(CSP_DEL_PARQUEADERO).toContain(`${d} 'self'`);
    }
    expect(CSP_DEL_PARQUEADERO).toMatch(/connect-src 'self';/);
  });

  it('staging no se indexa; producción lleva HSTS y no indexa la caja ni los recibos', () => {
    expect(textoDeCabecerasDelParqueadero('staging')).toContain('X-Robots-Tag: noindex');
    expect(textoDeCabecerasDelParqueadero('staging')).not.toContain('Strict-Transport-Security');
    const produccion = textoDeCabecerasDelParqueadero('produccion');
    expect(produccion).toContain('Strict-Transport-Security');
    expect(produccion).toContain('/caja/*\n  X-Robots-Tag: noindex');
    expect(produccion).toContain('/r/*\n  X-Robots-Tag: noindex');
    expect(textoDeRobotsDelParqueadero('staging')).toBe('User-agent: *\nDisallow: /\n');
    expect(textoDeRobotsDelParqueadero('produccion')).toContain('Disallow: /r/');
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

  describe('la prueba de humo (HU-Q5.1 CA3, HU-Q5.2 CA2)', () => {
    const URL_STAGING = 'https://ed1-parqueadero-staging.ejemplo.workers.dev';
    function sitio(
      cambios: { csp?: string | null; sw?: number; r?: number; hsts?: boolean } = {},
    ): typeof fetch {
      return (async (entrada: string | URL | Request) => {
        const ruta = new URL(String(entrada)).pathname;
        if (ruta === '/caja/sw.js') {
          return new Response('self;', {
            status: cambios.sw ?? 200,
            headers: { 'content-type': 'application/javascript' },
          });
        }
        if (ruta === '/r/') {
          return new Response('<title>Recibo de parqueadero</title>', { status: cambios.r ?? 200 });
        }
        const cabeceras: Record<string, string> = { 'x-robots-tag': 'noindex' };
        const csp = cambios.csp === undefined ? CSP_DEL_PARQUEADERO : cambios.csp;
        if (csp !== null) cabeceras['content-security-policy'] = csp;
        if (cambios.hsts) cabeceras['strict-transport-security'] = 'max-age=31536000';
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

    it('falla sin la página del recibo, y en producción sin HSTS', async () => {
      expect(await humoParqueadero(sitio({ r: 404 }), URL_STAGING)).toEqual([
        expect.stringContaining('sin la página del recibo'),
      ]);
      const url = `https://${DOMINIO_DEL_PARQUEADERO}`;
      expect(await humoParqueadero(sitio({ hsts: true }), url, 'produccion')).toEqual([]);
      expect(await humoParqueadero(sitio(), url, 'produccion')).toEqual([
        expect.stringContaining('no trae HSTS'),
      ]);
    });
  });
});
