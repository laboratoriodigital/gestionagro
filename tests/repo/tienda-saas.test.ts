/**
 * HU-T13.1 CA1 y HU-C11.5: Cloudflare for SaaS en el despliegue, sin la cuenta. El token se prueba
 * con lo que la API va a hacer antes de cargarlo, y la configuración solo cambia cuando el dueño
 * marca la celda con `saas` (después de activar SaaS en la zona). Staging nunca.
 */
import { describe, expect, it } from 'vitest';
import {
  wranglerDeLaCeldaDeLaTienda,
  wranglerDelSitioDeLaTienda,
  ZONA_DE_LAS_TIENDAS,
} from '../../scripts/generar-wrangler.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import { verificarTokenDeSaas } from '../../scripts/lib/credenciales.ts';
import type { Fetch } from '../../scripts/lib/despliegue.ts';

/** Una API de Cloudflare de mentira: 200 en lo que el token puede, 403 en lo demás. */
function cloudflare(puede: readonly string[]) {
  const pedidos: string[] = [];
  const fn = (async (entrada: string | URL | Request) => {
    const url = String(entrada);
    pedidos.push(url);
    if (url.includes('/zones?name=')) {
      return puede.includes('zona')
        ? Response.json({ success: true, result: [{ id: 'zona-1', name: ZONA_DE_LAS_TIENDAS }] })
        : Response.json({ success: true, result: [] });
    }
    const permitido = puede.some((p) => p !== 'zona' && url.includes(p));
    return new Response('{}', { status: permitido ? 200 : 403 });
  }) as Fetch;
  return { fn, pedidos };
}

describe('el token de Cloudflare for SaaS (HU-T13.1 CA1)', () => {
  it('se carga si ve la zona y lee sus hostnames, sin nada de más', async () => {
    const { fn, pedidos } = cloudflare(['zona', 'custom_hostnames']);
    expect(await verificarTokenDeSaas(fn, 'token', 'cuenta-1', ZONA_DE_LAS_TIENDAS)).toEqual({
      cargar: true,
      avisos: [],
    });
    expect(pedidos).toContain(
      'https://api.cloudflare.com/client/v4/zones/zona-1/custom_hostnames?per_page=1',
    );
    // Solo lecturas: nunca crea un hostname para probar (P11).
    expect(pedidos.every((u) => !u.includes('POST'))).toBe(true);
  });

  it('❌ sin token, o si no lee los hostnames, no se carga y lo dice', async () => {
    const sin = await verificarTokenDeSaas(cloudflare([]).fn, undefined, 'c', ZONA_DE_LAS_TIENDAS);
    expect(sin).toEqual({ cargar: false, avisos: [expect.stringMatching(/sin CF_SAAS_TOKEN/)] });
    const corto = await verificarTokenDeSaas(
      cloudflare(['zona']).fn,
      'token',
      'c',
      ZONA_DE_LAS_TIENDAS,
    );
    expect(corto.cargar).toBe(false);
    expect(corto.avisos[0]).toMatch(/no puede leer los hostnames personalizados/);
  });

  it('❌ un permiso de más avisa, en observación: no detiene ni impide cargarlo todavía', async () => {
    const { fn } = cloudflare(['zona', 'custom_hostnames', 'r2/buckets']);
    const r = await verificarTokenDeSaas(fn, 'token', 'c', ZONA_DE_LAS_TIENDAS);
    expect(r.cargar).toBe(true);
    expect(r.avisos).toEqual([
      expect.stringMatching(
        /CF_SAAS_TOKEN tiene un permiso de más: «Account → Workers R2 Storage».*en observación/,
      ),
    ]);
  });
});

describe('la configuración con SaaS activo', () => {
  const config = cargarCeldas();
  const tienda = config.celdas.find((c) => c.producto === 'tienda');
  if (!tienda) throw new Error('sin la celda de la Tienda');

  it('hoy, sin la marca, nada cambia: ni la zona en la API ni la ruta de toda la zona', () => {
    expect(tienda.saas).toBeUndefined();
    const api = wranglerDeLaCeldaDeLaTienda(tienda) as { vars: Record<string, string> };
    expect(api.vars['ZONA_TIENDAS']).toBeUndefined();
    const sitio = wranglerDelSitioDeLaTienda(config) as { routes: unknown[] };
    expect(sitio.routes).toHaveLength(1);
  });

  it('con la marca: la API de producción sabe su zona y el despacho recibe los dominios propios', () => {
    const conSaas = {
      ...config,
      celdas: config.celdas.map((c) => (c === tienda ? { ...c, saas: true } : c)),
    };
    const api = wranglerDeLaCeldaDeLaTienda({ ...tienda, saas: true }) as {
      vars: Record<string, string>;
      env: { staging: { vars: Record<string, string> } };
    };
    expect(api.vars['ZONA_TIENDAS']).toBe(ZONA_DE_LAS_TIENDAS);
    // ❌ Staging nunca: el origen de respaldo de la zona es el de producción.
    expect(api.env.staging.vars['ZONA_TIENDAS']).toBeUndefined();
    const sitio = wranglerDelSitioDeLaTienda(conSaas) as {
      routes: unknown[];
      env: { staging: { routes: unknown[] } };
    };
    expect(sitio.routes).toContainEqual({ pattern: '*/*', zone_name: ZONA_DE_LAS_TIENDAS });
    expect(sitio.env.staging.routes).not.toContainEqual(
      expect.objectContaining({ pattern: '*/*' }),
    );
  });
});

describe('las tiendas nuevas del alta (HU-T13.4)', () => {
  const config = cargarCeldas();
  it('con el comodín, el despacho recibe sus direcciones en cada ambiente; sin él, nada cambia', () => {
    const sin = wranglerDelSitioDeLaTienda({
      ...config,
      celdas: config.celdas.map((c) => {
        const { comodin: _, ...resto } = c;
        return resto;
      }),
    }) as { routes: { pattern: string }[]; env: { staging: { routes: { pattern: string }[] } } };
    expect(sin.env.staging.routes.some((r) => r.pattern.startsWith('*'))).toBe(false);
    expect(sin.routes.some((r) => r.pattern.startsWith('*.'))).toBe(false);
    const con = wranglerDelSitioDeLaTienda({
      ...config,
      celdas: config.celdas.map((c) => (c.producto === 'tienda' ? { ...c, comodin: true } : c)),
    }) as { routes: unknown[]; env: { staging: { routes: unknown[] } } };
    expect(con.routes).toContainEqual({
      pattern: `*.${ZONA_DE_LAS_TIENDAS}/*`,
      zone_name: ZONA_DE_LAS_TIENDAS,
    });
    expect(con.env.staging.routes).toContainEqual({
      pattern: `*--staging.${ZONA_DE_LAS_TIENDAS}/*`,
      zone_name: ZONA_DE_LAS_TIENDAS,
    });
  });

  it('D-T14: con «staging», solo staging recibe las tiendas nuevas; producción sigue igual', () => {
    const solo = wranglerDelSitioDeLaTienda({
      ...config,
      celdas: config.celdas.map((c) =>
        c.producto === 'tienda' ? { ...c, comodin: 'staging' as const } : c,
      ),
    }) as { routes: { pattern: string }[]; env: { staging: { routes: unknown[] } } };
    expect(solo.routes.some((r) => r.pattern.startsWith('*.'))).toBe(false);
    expect(solo.env.staging.routes).toContainEqual({
      pattern: `*--staging.${ZONA_DE_LAS_TIENDAS}/*`,
      zone_name: ZONA_DE_LAS_TIENDAS,
    });
  });

  it('la celda de la Tienda tiene hoy el comodín solo en staging (D-T14)', () => {
    expect(config.celdas.find((c) => c.producto === 'tienda')?.comodin).toBe('staging');
  });
});
