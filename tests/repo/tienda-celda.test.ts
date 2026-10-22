/**
 * HU-T2.3: la celda de la Tienda, declarada en `celdas.json` y con las configuraciones de sus tres
 * Workers generadas, nunca escritas a mano (P2). Cada caso malo es su control negativo (P5).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  bindingDeLaApi,
  CRON_DE_LA_TIENDA,
  celdasDeLaTienda,
  DOMINIOS_DE_LA_TIENDA,
  MEDIOS_DE_LA_TIENDA,
  RUTA_WRANGLER_TIENDA_PANEL,
  RUTA_WRANGLER_TIENDA_SITIO,
  rutaWranglerCeldaDeLaTienda,
  textoWranglerDeLaCeldaDeLaTienda,
  textoWranglerDelPanelDeLaTienda,
  textoWranglerDelSitioDeLaTienda,
  wranglerDeLaCeldaDeLaTienda,
  wranglerDelPanelDeLaTienda,
  wranglerDelSitioDeLaTienda,
} from '../../scripts/generar-wrangler.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import { cargarProductos } from '../../scripts/lib/registro-productos.ts';

const config = cargarCeldas();
const celdas = celdasDeLaTienda(config);

interface Config {
  name: string;
  workers_dev: boolean;
  routes?: unknown[];
  assets?: { run_worker_first: string[] };
  services?: { binding: string; service: string }[];
  d1_databases?: { binding: string; database_name: string; migrations_dir: string }[];
  env: { staging: Omit<Config, 'env'> };
}

describe('la celda c1 de la Tienda en celdas.json (HU-T2.3)', () => {
  it('es una, en el plan gratuito, con su shard y la base de control del producto', () => {
    expect(celdas.map((c) => [c.id, c.plan, c.shards, c.control])).toEqual([
      ['c1', 'free', ['tienda_c1_s1'], 'tienda_control'],
    ]);
  });

  it('su API es el panel: el único camino a la API (TIENDA §3.1), el mismo origen del producto', () => {
    const origenes = cargarProductos().productos.find((p) => p.id === 'tienda')?.app.origenes;
    for (const c of celdas) {
      expect(origenes).toEqual({ produccion: c.api, staging: c.api_staging });
    }
  });

  it('❌ un shard que no sigue tienda_c<N>_s<k> no carga', () => {
    const datos = structuredClone(JSON.parse(JSON.stringify(config)));
    datos.celdas.find((c: { id: string }) => c.id === 'c1').shards = ['tienda_c2_s1'];
    expect(() => cargarCeldas(datos)).toThrow(/c1: tienda_c2_s1/);
  });

  it('❌ una base de control con el nombre de otro producto no carga', () => {
    const datos = JSON.parse(JSON.stringify(config));
    datos.celdas.find((c: { id: string }) => c.id === 'c1').control = 'agro_control';
    expect(() => cargarCeldas(datos)).toThrow(/debe ser tienda_control/);
  });
});

describe('las configuraciones de sus Workers (HU-T2.3 CA2)', () => {
  it.each([
    ...celdas.map((c) => [rutaWranglerCeldaDeLaTienda(c.id), textoWranglerDeLaCeldaDeLaTienda(c)]),
    [RUTA_WRANGLER_TIENDA_SITIO, textoWranglerDelSitioDeLaTienda(config)],
    [RUTA_WRANGLER_TIENDA_PANEL, textoWranglerDelPanelDeLaTienda(config)],
  ])('%s es la generada, sin ids de cuenta ni de bases', (ruta, generada) => {
    const texto = readFileSync(ruta, 'utf8');
    expect(texto).toBe(generada);
    expect(texto).not.toMatch(/database_id|account_id|"id":/);
  });

  it.each(celdas.map((c) => [c.id, c] as const))(
    'la API de %s no tiene rutas ni workers.dev, en ningún destino (TIENDA §14.1)',
    (_id, celda) => {
      const api = wranglerDeLaCeldaDeLaTienda(celda) as unknown as Config;
      expect(api.name).toBe(`tienda-api-${celda.id}`);
      expect(api.env.staging.name).toBe(`tienda-api-${celda.id}-staging`);
      for (const destino of [api, api.env.staging]) {
        expect(destino.workers_dev).toBe(false);
        expect(destino.routes).toBeUndefined();
      }
      expect(api.d1_databases?.map((d) => [d.binding, d.migrations_dir])).toEqual([
        ['tienda_c1_s1', '../../infrastructure/migraciones/tienda'],
        ['tienda_control', '../../infrastructure/migraciones/tienda-control'],
      ]);
      expect(api.env.staging.d1_databases?.map((d) => d.database_name)).toEqual([
        'tienda_c1_s1_staging',
        'tienda_control_staging',
      ]);
    },
  );

  it('el despacho y el panel llegan a la API de cada celda por su binding, la de su destino', () => {
    for (const generada of [
      wranglerDelSitioDeLaTienda(config),
      wranglerDelPanelDeLaTienda(config),
    ]) {
      const c = generada as unknown as Config;
      expect(c.services).toEqual([{ binding: bindingDeLaApi('c1'), service: 'tienda-api-c1' }]);
      expect(c.env.staging.services).toEqual([
        { binding: 'API_C1', service: 'tienda-api-c1-staging' },
      ]);
    }
  });

  it('el panel ejecuta el Worker solo en /api/* y en el MCP del comercio: una pantalla nunca gasta una invocación', () => {
    const panel = wranglerDelPanelDeLaTienda(config) as unknown as Config;
    // HU-T15.7: el MCP del comercio y sus metadatos (RFC 9728).
    expect(panel.assets?.run_worker_first).toEqual(['/api/*', '/mcp', '/.well-known/*']);
  });

  it('staging vive en workers.dev; producción, solo en panel., mcp. y origen., sin el comodín todavía (HU-T2.9)', () => {
    const sitio = wranglerDelSitioDeLaTienda(config) as unknown as Config;
    const panel = wranglerDelPanelDeLaTienda(config) as unknown as Config;
    expect(sitio.routes).toEqual([{ pattern: DOMINIOS_DE_LA_TIENDA.origen, custom_domain: true }]);
    expect(panel.routes).toEqual([
      { pattern: DOMINIOS_DE_LA_TIENDA.panel, custom_domain: true },
      // HU-T15.7: el MCP del comercio, el recurso que nombra productos.json.
      { pattern: DOMINIOS_DE_LA_TIENDA.mcp, custom_domain: true },
    ]);
    for (const c of [sitio, panel]) {
      expect(c.workers_dev).toBe(false);
      expect(c.env.staging.workers_dev).toBe(true);
      expect(JSON.stringify(c)).not.toContain('*.laboratorio-digital.app');
    }
    // El panel de producción es el que celdas.json da a la celda: el humo lo compara.
    for (const c of celdas) expect(c.api).toBe(`https://${DOMINIOS_DE_LA_TIENDA.panel}`);
    expect((wranglerDelPanelDeLaTienda(config) as unknown as Config).env.staging.routes).toEqual(
      [],
    );
  });

  it('❌ solo staging deja publicar a los comercios de prueba; producción no lleva ENSAYOS', () => {
    for (const celda of celdas) {
      const api = wranglerDeLaCeldaDeLaTienda(celda) as unknown as Config & {
        vars: Record<string, string>;
      };
      expect(api.vars['ENSAYOS']).toBeUndefined();
      expect(api.vars['AMBIENTE']).toBe('produccion');
      expect(
        (api.env.staging as unknown as { vars: Record<string, string> }).vars['AMBIENTE'],
      ).toBe('staging');
      expect((api.env.staging as unknown as { vars: Record<string, string> }).vars['ENSAYOS']).toBe(
        '1',
      );
    }
  });

  it('❌ un solo cron por hora y solo en producción: el quinto de la cuenta (HU-T17.1, D-T10)', () => {
    for (const celda of celdas) {
      const api = wranglerDeLaCeldaDeLaTienda(celda) as unknown as Config & {
        triggers: { crons: string[] };
      };
      expect(api.triggers.crons).toEqual([CRON_DE_LA_TIENDA]);
      expect(
        (api.env.staging as unknown as { triggers: { crons: string[] } }).triggers.crons,
      ).toEqual([]);
    }
    for (const otra of [wranglerDelSitioDeLaTienda(config), wranglerDelPanelDeLaTienda(config)]) {
      expect(JSON.stringify(otra)).not.toContain('crons');
    }
  });

  it('la API limita por IP cotizar y avísame, con su propio contador por destino (HU-T5.5 y HU-T6.5)', () => {
    for (const celda of celdas) {
      type Limite = {
        name: string;
        namespace_id: string;
        simple: { limit: number; period: number };
      };
      const api = wranglerDeLaCeldaDeLaTienda(celda) as unknown as {
        ratelimits: Limite[];
        env: { staging: { ratelimits: Limite[] } };
      };
      expect(api.ratelimits.map((l) => [l.name, l.simple.limit, l.simple.period])).toEqual([
        ['LIMITE_COTIZAR', 30, 60],
        ['LIMITE_AVISAME', 10, 60],
        ['LIMITE_PEDIDOS', 10, 60],
        ['LIMITE_SEGUIMIENTO', 20, 60],
        ['LIMITE_SOLICITUDES', 5, 60],
        ['LIMITE_COBROS', 3, 60],
        ['LIMITE_AVISOS', 60, 60],
        ['LIMITE_MEDICION', 60, 60],
        // HU-T15.4: el MCP público y, aparte, preparar un pedido.
        ['LIMITE_MCP', 60, 60],
        ['LIMITE_MCP_PEDIDOS', 1, 60],
      ]);
      const ids = [...api.ratelimits, ...api.env.staging.ratelimits].map((l) => l.namespace_id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('el despacho de staging atiende las direcciones de los dos comercios de prueba (HU-T2.6) y las del alta', () => {
    const sitio = wranglerDelSitioDeLaTienda(config) as unknown as Config;
    expect(sitio.env.staging.routes).toEqual([
      { pattern: 'ensayo-uno--staging.mitiendapro.co', custom_domain: true },
      { pattern: 'ensayo-dos--staging.mitiendapro.co', custom_domain: true },
      // HU-T13.4: y las tiendas nuevas del alta, con el comodín de staging (D-T14).
      { pattern: '*--staging.mitiendapro.co/*', zone_name: 'mitiendapro.co' },
      // HU-T18.1 CA2: las de antes siguen llegando, para llevarlas a mitiendapro.co.
      { pattern: 'ensayo-uno--staging.laboratorio-digital.app', custom_domain: true },
      { pattern: 'ensayo-dos--staging.laboratorio-digital.app', custom_domain: true },
      { pattern: '*--staging.laboratorio-digital.app/*', zone_name: 'laboratorio-digital.app' },
    ]);
  });

  it('HU-T18.1 y HU-T18.2: producción en las dos zonas de la marca, y ❌ ninguna tienda en tiendapro.co', () => {
    const sitio = wranglerDelSitioDeLaTienda(config) as unknown as Config;
    const panel = wranglerDelPanelDeLaTienda(config) as unknown as Config;
    expect(panel.routes).toEqual([
      { pattern: 'app.tiendapro.co', custom_domain: true },
      { pattern: 'mcp.tiendapro.co', custom_domain: true },
    ]);
    expect(sitio.routes).toContainEqual({ pattern: 'origen.mitiendapro.co', custom_domain: true });
    const delDespacho = JSON.stringify([sitio.routes, sitio.env.staging.routes]);
    expect(delDespacho).not.toMatch(/[".*]tiendapro\.co/);
  });

  it('bitácora tienda3 52: staging declara cada variable de producción, también con Cloudflare for SaaS', () => {
    const [c1] = celdas;
    if (!c1) throw new Error('sin celda c1');
    for (const celda of [c1, { ...c1, saas: true }]) {
      const api = wranglerDeLaCeldaDeLaTienda(celda) as unknown as {
        vars: Record<string, string>;
        env: { staging: { vars: Record<string, string> } };
      };
      const faltan = Object.keys(api.vars).filter((k) => !(k in api.env.staging.vars));
      expect(faltan, `saas: ${Boolean(celda.saas)}`).toEqual([]);
      // ❌ Staging nunca manda con Resend ni conecta dominios propios.
      expect(api.env.staging.vars['AMBIENTE']).toBe('staging');
      expect(api.env.staging.vars['ZONA_TIENDAS'] ?? '').toBe('');
    }
  });

  it('❌ una celda de la Tienda sin base de control no genera su API', () => {
    const [c1] = celdas;
    if (!c1) throw new Error('sin celda c1');
    const { control: _, ...sinControl } = c1;
    expect(() => wranglerDeLaCeldaDeLaTienda(sinControl)).toThrow(/no declara su control/);
  });
});

describe('las fotos sin Worker y en su propio bucket (HU-T5.6)', () => {
  it('el bucket público de las fotos nunca es el almacén, que guarda datos personales', () => {
    for (const c of celdas) {
      expect(c.medios).toMatch(/-medios$/);
      expect(c.medios).not.toBe(c.almacen);
    }
  });

  it('HU-T8.3: la API enlaza el bucket de las fotos solo donde el dueño ya lo creó', () => {
    const [c1] = celdas;
    if (!c1) throw new Error('sin celda c1');
    const buckets = (c: typeof c1) => {
      const w = wranglerDeLaCeldaDeLaTienda(c) as {
        r2_buckets: { binding: string; bucket_name: string }[];
        env: { staging: { r2_buckets: { binding: string; bucket_name: string }[] } };
      };
      return [w.r2_buckets, w.env.staging.r2_buckets].map((l) =>
        l.filter((b) => b.binding === 'FOTOS').map((b) => b.bucket_name),
      );
    };
    // ❌ Sin crear, ningún ambiente lo enlaza: enlazar un bucket que no existe tumba el despliegue.
    expect(buckets({ ...c1, medios_creados: [] })).toEqual([[], []]);
    expect(buckets({ ...c1, medios_creados: ['staging'] })).toEqual([
      [],
      ['tienda-c1-medios-staging'],
    ]);
    expect(buckets({ ...c1, medios_creados: ['produccion', 'staging'] })).toEqual([
      ['tienda-c1-medios'],
      ['tienda-c1-medios-staging'],
    ]);
  });

  it('❌ un bucket de fotos igual al almacén no carga', () => {
    const datos = JSON.parse(JSON.stringify(config));
    const c1 = datos.celdas.find((c: { id: string }) => c.id === 'c1');
    c1.medios = c1.almacen;
    expect(() => cargarCeldas(datos)).toThrow(/datos personales/);
  });

  it('❌ ninguna configuración de Worker toma img. como ruta: ver una foto no ejecuta código (CA2)', () => {
    const rutas = (c: Record<string, unknown>) => {
      const staging = (c['env'] as { staging?: Record<string, unknown> } | undefined)?.staging;
      return JSON.stringify([c['routes'] ?? [], staging?.['routes'] ?? []]);
    };
    const configs = [
      ...celdas.map((c) => wranglerDeLaCeldaDeLaTienda(c)),
      wranglerDelSitioDeLaTienda(config),
      wranglerDelPanelDeLaTienda(config),
    ];
    for (const c of configs)
      expect(rutas(c)).not.toMatch(/img(--staging)?\.laboratorio-digital\.app/);
  });

  it('la API hornea las fotos con el host de su destino, y el despacho solo lo permite a él (HU-T5.2)', () => {
    const [c1] = celdas;
    if (!c1) throw new Error('sin celda c1');
    const api = wranglerDeLaCeldaDeLaTienda(c1) as unknown as {
      vars: Record<string, string>;
      env: { staging: { vars: Record<string, string> } };
    };
    const sitio = wranglerDelSitioDeLaTienda(config) as unknown as typeof api;
    for (const c of [api, sitio]) {
      expect(c.vars['MEDIOS']).toBe(MEDIOS_DE_LA_TIENDA.produccion);
      expect(c.env.staging.vars['MEDIOS']).toBe(MEDIOS_DE_LA_TIENDA.staging);
    }
  });
});
