/**
 * HU-T2.3: la celda de la Tienda, declarada en `celdas.json` y con las configuraciones de sus tres
 * Workers generadas, nunca escritas a mano (P2). Cada caso malo es su control negativo (P5).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  bindingDeLaApi,
  celdasDeLaTienda,
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

  it('el panel ejecuta el Worker solo en /api/*: una pantalla nunca gasta una invocación', () => {
    const panel = wranglerDelPanelDeLaTienda(config) as unknown as Config;
    expect(panel.assets?.run_worker_first).toEqual(['/api/*']);
  });

  it('staging vive en workers.dev y producción no toma ningún hostname hasta HU-T2.9 (P1)', () => {
    for (const generada of [
      wranglerDelSitioDeLaTienda(config),
      wranglerDelPanelDeLaTienda(config),
    ]) {
      const c = generada as unknown as Config;
      expect([c.workers_dev, c.routes]).toEqual([false, []]);
      expect(c.env.staging.workers_dev).toBe(true);
    }
    expect((wranglerDelPanelDeLaTienda(config) as unknown as Config).env.staging.routes).toEqual(
      [],
    );
  });

  it('el despacho de staging atiende las direcciones de los dos comercios de prueba (HU-T2.6)', () => {
    const sitio = wranglerDelSitioDeLaTienda(config) as unknown as Config;
    expect(sitio.env.staging.routes).toEqual([
      { pattern: 'ensayo-uno--staging.laboratorio-digital.app', custom_domain: true },
      { pattern: 'ensayo-dos--staging.laboratorio-digital.app', custom_domain: true },
    ]);
  });

  it('❌ una celda de la Tienda sin base de control no genera su API', () => {
    const [c1] = celdas;
    if (!c1) throw new Error('sin celda c1');
    const { control: _, ...sinControl } = c1;
    expect(() => wranglerDeLaCeldaDeLaTienda(sinControl)).toThrow(/no declara su control/);
  });
});
