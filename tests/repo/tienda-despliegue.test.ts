/**
 * HU-T2.4: lo que el despliegue hace con la celda de la Tienda, sin tocar Cloudflare. Los
 * reservados contra la base de control de verdad, los secretos, los ids fuera de git y la prueba de
 * humo con un `fetch` de mentira. Cada caso malo es su control negativo (P5).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BaseD1 } from '../../packages/d1/src/index.ts';
import { baseLocal } from '../../packages/d1/src/local.ts';
import {
  celdasDeLaTienda,
  wranglerDeLaCeldaDeLaTienda,
  wranglerDelSitioDeLaTienda,
} from '../../scripts/generar-wrangler.ts';
import {
  configDeLaApi,
  configDelSitio,
  humoDeLaTienda,
  nombreKvHosts,
  preparaLaTienda,
  reservadosDeDominios,
  secretosDeLaTienda,
  sentenciasDeReservados,
  urlQueNoDebeResponder,
} from '../../scripts/lib/celda-tienda.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import type { Fetch } from '../../scripts/lib/despliegue.ts';

const [c1] = celdasDeLaTienda(cargarCeldas());
if (!c1) throw new Error('sin la celda c1 de la Tienda');

describe('cuándo se prepara', () => {
  it('en staging siempre; en producción solo cuando la Tienda sale (HU-T2.9)', () => {
    expect(preparaLaTienda('staging', new Set())).toBe(true);
    expect(preparaLaTienda('produccion', new Set(['core', 'agro']))).toBe(false);
    expect(preparaLaTienda('produccion', new Set(['tienda']))).toBe(true);
  });

  it('el KV del despacho lleva la celda y el destino', () => {
    expect(nombreKvHosts('c1', 'staging')).toBe('tienda-c1-hosts-staging');
    expect(nombreKvHosts('c1', 'produccion')).toBe('tienda-c1-hosts');
  });
});

describe('los reservados de dominios.json en la base de control (HU-T2.2 CA3)', () => {
  let ctl: BaseD1;
  let cerrar: () => Promise<void>;
  const correr = async (sentencias: readonly string[]) => {
    for (const s of sentencias) await ctl.prepare(s.replace(/;$/, '')).run();
  };

  beforeAll(async () => {
    ({ db: ctl, cerrar } = await baseLocal({
      configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
      binding: 'tienda_control',
      base: 'tienda-control',
    }));
  }, 60_000);
  afterAll(async () => cerrar?.());

  it('entran con su motivo, y aplicarlos dos veces no cambia nada', async () => {
    const sentencias = sentenciasDeReservados(reservadosDeDominios());
    await correr(sentencias);
    await correr(sentencias);
    const fila = await ctl
      .prepare("SELECT motivo FROM slug_reservado WHERE slug = 'parqueadero'")
      .first<{ motivo: string }>();
    expect(fila?.motivo).toBe('proyecto');
    const { results } = await ctl
      .prepare("SELECT slug FROM slug_reservado WHERE motivo IN ('proyecto', 'marca')")
      .all<{ slug: string }>();
    const { proyecto, marca } = reservadosDeDominios();
    expect(results.map((r) => r.slug).sort()).toEqual([...proyecto, ...marca].sort());
  });

  it('un nombre con comilla queda escapado', () => {
    expect(sentenciasDeReservados({ proyecto: ["o'a"], marca: [] })).toEqual([
      "INSERT INTO slug_reservado (slug, motivo) VALUES ('o''a', 'proyecto') ON CONFLICT (slug) DO NOTHING;",
    ]);
  });

  it('❌ reservar el nombre de una tienda que ya existe falla con el nombre (P1)', async () => {
    await ctl
      .prepare(
        "INSERT INTO slug (slug, org_id, celda_id, creado) VALUES ('mercado-ensayo', 'A', 'c1', 'x')",
      )
      .run();
    await expect(
      correr(sentenciasDeReservados({ proyecto: ['mercado-ensayo'], marca: [] })),
    ).rejects.toThrow(/slug-en-uso/);
  });
});

describe('los secretos de la Tienda', () => {
  it('el del despacho va a los tres Workers y la KEK solo a la API', () => {
    expect(secretosDeLaTienda({ SECRETO_DESPACHO: 'd', TIENDA_KEK_V1: 'k' })).toEqual({
      ok: true,
      api: { SECRETO_DESPACHO: 'd', TIENDA_KEK_V1: 'k' },
      frente: { SECRETO_DESPACHO: 'd' },
      conKek: true,
    });
  });

  it('sin la KEK se despliega: nada cifra todavía (HU-T11.1)', () => {
    expect(secretosDeLaTienda({ SECRETO_DESPACHO: 'd' })).toMatchObject({
      ok: true,
      conKek: false,
    });
  });

  it('❌ sin el secreto del despacho no se despliega, y dice cómo generarlo', () => {
    const r = secretosDeLaTienda({ SECRETO_DESPACHO: '  ', TIENDA_KEK_V1: 'k' });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/scripts\/tienda\/generar-secretos\.ts/);
  });
});

describe('los ids del despliegue, fuera de git (ADR-6)', () => {
  const generada = wranglerDeLaCeldaDeLaTienda(c1);
  const ids = {
    bases: { tienda_c1_s1: 'id-shard', tienda_control: 'id-control' },
    flagsId: 'kv-flags',
    hostsId: 'kv-hosts',
    clavesCore: [{ kid: 'k1' }],
  };

  it('staging recibe los ids de sus bases y sus dos KV; producción queda como estaba', () => {
    const config = configDeLaApi(generada, 'staging', ids) as {
      d1_databases: unknown[];
      env: {
        staging: {
          d1_databases: { database_id: string }[];
          kv_namespaces: { binding: string }[];
          vars: Record<string, string>;
        };
      };
    };
    // HU-T2.8: las claves públicas del CORE de staging, para verificar sus tokens sin llamarlo.
    expect(config.env.staging.vars['CORE_CLAVES']).toBe('[{"kid":"k1"}]');
    expect(config.env.staging.vars['CELDA']).toBe('c1');
    expect(config.env.staging.d1_databases.map((d) => d.database_id)).toEqual([
      'id-shard',
      'id-control',
    ]);
    expect(config.env.staging.kv_namespaces.map((k) => k.binding)).toEqual([
      'FLAGS',
      'TIENDA_HOSTS',
    ]);
    expect(JSON.stringify(config.d1_databases)).not.toContain('database_id');
  });

  it('❌ una base sin su id no arma la configuración', () => {
    expect(() =>
      configDeLaApi(generada, 'staging', { ...ids, bases: { tienda_c1_s1: 'id-shard' } }),
    ).toThrow(/tienda_control/);
  });
});

describe('el despacho lee los kill switches (HU-T2.7)', () => {
  it('su configuración de staging lleva el KV de hosts y el de flags', () => {
    const config = configDelSitio(wranglerDelSitioDeLaTienda(cargarCeldas()), 'staging', {
      hostsId: 'kv-hosts',
      flagsId: 'kv-flags',
    }) as { env: { staging: { kv_namespaces: { binding: string; id: string }[] } } };
    expect(config.env.staging.kv_namespaces).toEqual([
      { binding: 'TIENDA_HOSTS', id: 'kv-hosts' },
      { binding: 'FLAGS', id: 'kv-flags' },
    ]);
  });
});

describe('la prueba de humo', () => {
  const urls = {
    panel: 'https://tienda-panel-staging.ejemplo.workers.dev',
    sitio: 'https://tienda-sitio-staging.ejemplo.workers.dev',
    apiPorFuera: urlQueNoDebeResponder(c1, 'staging'),
  };

  /** Cloudflare de mentira: cada URL responde lo que diga la tabla. */
  const nube =
    (tabla: Record<string, () => Response>): Fetch =>
    async (url) => {
      const r = tabla[String(url)];
      if (!r) throw new Error(`sin respuesta para ${String(url)}`);
      return r();
    };
  const sana = {
    [`${urls.panel}/api/salud`]: () =>
      Response.json({ estado: 'ok', celda: 'c1', shards: 1, control: true, kek: 'ok' }),
    [`${urls.panel}/`]: () => new Response('<h1>El panel de tu tienda</h1>'),
    [`${urls.sitio}/`]: () =>
      new Response('<h1>Esta dirección no tiene tienda</h1>', { status: 404 }),
    [`${urls.apiPorFuera}/api/salud`]: () => new Response('nada', { status: 404 }),
  };

  it('la API sin workers.dev se busca en el subdominio de la cuenta, con el nombre de su Worker', () => {
    expect(urlQueNoDebeResponder(c1, 'staging')).toBe(
      'https://tienda-api-c1-staging.laboratoriodigital-la.workers.dev',
    );
  });

  it('con todo en su sitio no hay fallas ni avisos', async () => {
    expect(await humoDeLaTienda(nube(sana), urls)).toEqual({ fallas: [], avisos: [] });
  });

  it('la KEK que falta es un aviso, no una falla', async () => {
    const r = await humoDeLaTienda(
      nube({
        ...sana,
        [`${urls.panel}/api/salud`]: () => Response.json({ estado: 'ok', kek: 'falta' }),
      }),
      urls,
    );
    expect(r).toEqual({
      fallas: [],
      avisos: ['la KEK de la Tienda: falta (nada se cifra todavía)'],
    });
  });

  it('❌ la API que responde por workers.dev es una falla (CA4)', async () => {
    const r = await humoDeLaTienda(
      nube({ ...sana, [`${urls.apiPorFuera}/api/salud`]: () => Response.json({ estado: 'ok' }) }),
      urls,
    );
    expect(r.fallas).toEqual([
      `${urls.apiPorFuera} respondió 200: la API de la Tienda no puede tener workers.dev (CA4)`,
    ]);
  });

  it('❌ una base caída o un despacho que responde 200 a un host sin tienda son fallas', async () => {
    const r = await humoDeLaTienda(
      nube({
        ...sana,
        [`${urls.panel}/api/salud`]: () =>
          Response.json(
            { estado: 'base-con-falla', motivo: 'tienda_control: la base no respondió' },
            { status: 503 },
          ),
        [`${urls.sitio}/`]: () => new Response('hola'),
      }),
      urls,
    );
    expect(r.fallas).toHaveLength(2);
    expect(r.fallas[0]).toContain('tienda_control: la base no respondió');
  });
});
