/**
 * HU-T18.5 y HU-T18.6 CA2: la landing de TiendaPro y lo legal con lo que hay.
 *
 * - Los planes de la landing son los de `planes.json` (P2), con su precio y lo que se ahorra en un
 *   año.
 * - Cada ambiente lleva al panel suyo, con sus cabeceras: staging no se indexa, y ninguno deja
 *   entrar algo en línea o de un tercero (CA3).
 * - Los términos y la política salen con los datos del encargado que hay; lo que falta se omite y
 *   queda en la lista para completar.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  llmsTxt,
  PANEL,
  pesos,
  planesDeLaLanding,
  TIENDAS_DE_EJEMPLO,
} from '../../apps/tiendapro-sitio/src/contenido.ts';
import plantilla from '../../content/tienda/comercio/terminos.json' with { type: 'json' };
import politica from '../../content/tienda/privacidad/politica.json' with { type: 'json' };
import {
  datosQueFaltan,
  datosQueHay,
  llenarConLoQueHay,
  textoParaAceptar,
} from '../../packages/tienda-schema/src/comercio.ts';
import {
  RUTA_WRANGLER_TIENDAPRO,
  textoWranglerDeLaLanding,
  wranglerDeLaLanding,
} from '../../scripts/generar-wrangler.ts';
import {
  armarLaLandingPara,
  CSP_DE_LA_LANDING,
  cabecerasDeLaLanding,
  panelDelAmbiente,
} from '../../scripts/lib/cabeceras-tiendapro.ts';

describe('la landing de TiendaPro (HU-T18.5)', () => {
  it('los planes son los de planes.json: Gratis, Pro e IA Pro, con su precio y el ahorro de un año', () => {
    const planes = planesDeLaLanding();
    expect(planes.map((p) => [p.id, p.precioMes, p.anual])).toEqual([
      ['gratis', 0, null],
      ['pro', 24900, { total: 249000, ahorro: 49800 }],
      ['ia-pro', 49000, { total: 490000, ahorro: 98000 }],
    ]);
    expect(planes.find((p) => p.id === 'gratis')?.productos).toBe(10);
  });

  it('los precios con el punto de miles de Colombia, sin Intl', () => {
    expect([pesos(0), pesos(1500), pesos(24900), pesos(1258000)]).toEqual([
      '$0',
      '$1.500',
      '$24.900',
      '$1.258.000',
    ]);
  });

  it('las tiendas del teléfono son de ejemplo, en mitiendapro.co y con cuatro productos', () => {
    for (const t of TIENDAS_DE_EJEMPLO) {
      expect(t.direccion).toMatch(/^[a-z-]+\.mitiendapro\.co$/);
      expect(t.productos).toHaveLength(4);
    }
  });

  it('llms.txt dice qué es, los tres planes y dónde crear la tienda (CA2)', () => {
    const texto = llmsTxt();
    expect(texto).toMatch(/^# TiendaPro/);
    expect(texto).toContain('- Pro: $24.900 al mes.');
    expect(texto).toContain(`[Crear una tienda](${PANEL})`);
    expect(texto).toContain('https://tiendapro.co/legal/terminos/');
  });

  it('su configuración es la generada: solo la marca en producción y workers.dev en staging', () => {
    expect(readFileSync(RUTA_WRANGLER_TIENDAPRO, 'utf8')).toBe(textoWranglerDeLaLanding());
    const config = wranglerDeLaLanding() as {
      routes: { pattern: string }[];
      env: { staging: { routes: unknown[]; workers_dev: boolean } };
    };
    expect(config.routes.map((r) => r.pattern)).toEqual(['tiendapro.co', 'www.tiendapro.co']);
    expect(config.env.staging).toMatchObject({ routes: [], workers_dev: true });
  });
});

describe('la landing por ambiente (HU-T18.5 CA3)', () => {
  it('cada ambiente lleva a su panel, el de celdas.json', () => {
    expect(panelDelAmbiente('produccion')).toBe('https://app.tiendapro.co/');
    expect(panelDelAmbiente('staging')).toBe(
      'https://tienda-panel-staging.laboratoriodigital-la.workers.dev/',
    );
  });

  it('❌ la CSP no deja nada en línea ni de un tercero', () => {
    expect(CSP_DE_LA_LANDING).not.toMatch(/unsafe-inline|unsafe-eval|https?:/);
    expect(CSP_DE_LA_LANDING).toContain("script-src 'self'");
    expect(CSP_DE_LA_LANDING).toContain("frame-ancestors 'none'");
  });

  it('staging no se indexa; producción lleva HSTS', () => {
    expect(cabecerasDeLaLanding('staging')).toContain('X-Robots-Tag: noindex, nofollow');
    expect(cabecerasDeLaLanding('staging')).not.toContain('Strict-Transport-Security');
    expect(cabecerasDeLaLanding('produccion')).toContain('Strict-Transport-Security');
    expect(cabecerasDeLaLanding('produccion')).not.toContain('noindex');
  });

  it('armarla cambia el panel de «Crear tienda» por el del ambiente, de ida y de vuelta', () => {
    const dist = mkdtempSync(join(tmpdir(), 'tiendapro-'));
    mkdirSync(join(dist, 'legal'));
    const html = `<a href="${PANEL}" data-panel>Crear tienda</a>`;
    writeFileSync(join(dist, 'index.html'), html);
    writeFileSync(join(dist, 'legal', 'index.html'), html);
    writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');
    armarLaLandingPara(dist, 'staging');
    const staging = panelDelAmbiente('staging');
    expect(readFileSync(join(dist, 'legal', 'index.html'), 'utf8')).toContain(`href="${staging}"`);
    expect(readFileSync(join(dist, 'robots.txt'), 'utf8')).toBe('User-agent: *\nDisallow: /\n');
    armarLaLandingPara(dist, 'produccion');
    expect(readFileSync(join(dist, 'index.html'), 'utf8')).toBe(html);
    expect(readFileSync(join(dist, '_headers'), 'utf8')).toContain('Strict-Transport-Security');
  });
});

describe('lo legal con lo que hay (HU-T18.6 CA2)', () => {
  it('una frase con un dato que falta se omite; las demás quedan, con su punto', () => {
    const plantillaEncargado =
      '{encargado}, identificación {identificacion}, domicilio {domicilio}, teléfono {telefono}.';
    expect(
      llenarConLoQueHay(plantillaEncargado, {
        encargado: 'Laboratorio Digital',
        identificacion: null,
        domicilio: 'Medellín, Colombia',
        telefono: null,
      }),
    ).toBe('Laboratorio Digital, domicilio Medellín, Colombia.');
    expect(llenarConLoQueHay('Sin datos que llenar.', {})).toBe('Sin datos que llenar.');
  });

  it('❌ los términos de hoy no dejan «por completar» ni un {campo} a la vista', () => {
    for (const cual of ['terminos', 'custodia'] as const) {
      const t = textoParaAceptar(plantilla, politica.responsable, cual).texto;
      expect(t).not.toMatch(/por completar|\{\w+\}/);
    }
    const encargado = textoParaAceptar(plantilla, politica.responsable, 'terminos').secciones.find(
      ([titulo]) => titulo === 'Encargado',
    );
    expect(encargado?.[1]).toBe(
      `Laboratorio Digital, domicilio ${politica.responsable.domicilio}, correo ${politica.responsable.correo}.`,
    );
  });

  it('la política muestra solo lo que hay, y la lista dice lo que falta completar', () => {
    const r = politica.responsable;
    expect(datosQueHay(r).map(([etiqueta]) => etiqueta)).toEqual(['Domicilio', 'Correo']);
    expect(datosQueFaltan(r)).toEqual(['razón social', 'identificación', 'teléfono']);
  });
});
