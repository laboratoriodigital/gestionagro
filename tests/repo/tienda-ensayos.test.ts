/**
 * HU-T2.6: los dos comercios de prueba, de un solo fixture (P4). Su siembra entra en el shard y en
 * la base de control, dos veces sin cambiar nada; sus direcciones de staging tienen el formato que
 * lee el despacho (P2); y de punta a punta, el despacho resuelve cada dirección y la API responde
 * con la tienda correcta. En producción no se siembra nada (CA3).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../apps/tienda-api/src/worker.ts';
import { crearDespacho, destinoDe } from '../../apps/tienda-sitio/src/worker.ts';
import type { BaseD1 } from '../../packages/d1/src/index.ts';
import { baseLocal } from '../../packages/d1/src/local.ts';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  ENSAYOS,
  hostDeStaging,
  hostsDeStaging,
  siembraDelControl,
  siembraDelShard,
} from '../../packages/tienda-schema/src/ensayos.ts';
import { TOPES } from '../../packages/tienda-schema/src/index.ts';
import { ensayosDelDestino, humoDeLaTienda } from '../../scripts/lib/celda-tienda.ts';
import type { Fetch } from '../../scripts/lib/despliegue.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-13T15:00:00.000Z';
const SECRETO = 'secreto-de-prueba-del-despacho';

describe('el fixture (HU-T2.6 CA1, P4)', () => {
  it('son dos comercios distintos en lo que importa', () => {
    expect(ENSAYOS.map((e) => [e.slug, e.plan])).toEqual([
      ['ensayo-uno', 'entrada'],
      ['ensayo-dos', 'gratis'],
    ]);
    expect(ENSAYO_UNO.productos[0]?.opciones).toHaveLength(2);
    expect(ENSAYO_UNO.productos[0]?.variantes.every((v) => v.stock !== null)).toBe(true);
    expect(ENSAYO_DOS.productos[0]?.variantes.every((v) => v.stock === null)).toBe(true);
    expect(ENSAYO_DOS.productos[0]?.retracto).not.toBe('aplica');
  });

  it('cabe en los topes de tienda-import/1', () => {
    for (const p of ENSAYOS.flatMap((e) => e.productos)) {
      expect(p.opciones.length).toBeLessThanOrEqual(TOPES.grupos);
      expect(p.variantes.length).toBeLessThanOrEqual(TOPES.variantes);
    }
  });

  it('cada dirección de staging lleva «--», que ninguna tienda puede tomar', () => {
    expect(hostDeStaging('ensayo-uno')).toBe('ensayo-uno--staging.laboratorio-digital.app');
  });

  it('❌ en producción no se siembra ningún comercio de prueba (CA3)', () => {
    expect(ensayosDelDestino('produccion')).toEqual([]);
    expect(ensayosDelDestino('staging')).toBe(ENSAYOS);
  });
});

describe('la siembra, en las bases locales', () => {
  let shard: BaseD1;
  let control: BaseD1;
  const cerrar: (() => Promise<void>)[] = [];
  const correr = async (db: BaseD1, sentencias: readonly string[]) => {
    for (const s of sentencias) await db.prepare(s.replace(/;$/, '')).run();
  };

  beforeAll(async () => {
    const s = await baseLocal({
      configuracion: CONFIGURACION,
      binding: 'tienda_c1_s1',
      base: 'tienda',
    });
    const c = await baseLocal({
      configuracion: CONFIGURACION,
      binding: 'tienda_control',
      base: 'tienda-control',
    });
    shard = s.db;
    control = c.db;
    cerrar.push(s.cerrar, c.cerrar);
  }, 60_000);
  afterAll(async () => {
    for (const c of cerrar) await c();
  });

  it('entra en el shard y en el control, y dos veces no cambia nada', async () => {
    for (let vez = 0; vez < 2; vez++) {
      await correr(shard, siembraDelShard(ENSAYOS, AHORA));
      await correr(control, siembraDelControl(ENSAYOS, 'c1', AHORA));
    }
    const n = async (db: BaseD1, sql: string) => (await db.prepare(sql).first<{ n: number }>())?.n;
    expect(await n(shard, 'SELECT COUNT(*) AS n FROM tienda')).toBe(2);
    expect(await n(shard, 'SELECT COUNT(*) AS n FROM variante')).toBe(4);
    expect(await n(control, "SELECT COUNT(*) AS n FROM dominio WHERE estado = 'activo'")).toBe(2);
    expect(await n(shard, "SELECT COUNT(*) AS n FROM producto WHERE retracto = 'no_aplica'")).toBe(
      1,
    );
  });

  it('las direcciones de TIENDA_HOSTS son las que lee el despacho (P2)', () => {
    for (const [clave, valor] of hostsDeStaging(ENSAYOS, 'c1', 'tienda_c1_s1')) {
      expect(clave).toMatch(/^h:ensayo-(uno|dos)--staging\.laboratorio-digital\.app$/);
      expect(destinoDe(valor)).toMatchObject({ celda: 'c1', shard: 'tienda_c1_s1' });
    }
  });

  it('de punta a punta: cada dirección llega a su tienda por el despacho y la API', async () => {
    const valores = Object.fromEntries(hostsDeStaging(ENSAYOS, 'c1', 'tienda_c1_s1'));
    const app = crearApp();
    const env = {
      TIENDA_HOSTS: { get: async (clave: string) => valores[clave] ?? null },
      SECRETO_DESPACHO: SECRETO,
      API_C1: {
        fetch: async (solicitud: Request) =>
          app.fetch(solicitud, {
            CELDA: 'c1',
            PRODUCTO: 'tienda',
            SECRETO_DESPACHO: SECRETO,
            tienda_c1_s1: shard,
          }),
      },
    };
    const despacho = crearDespacho();
    // La prueba de humo del despliegue, contra el despacho local en vez de Cloudflare.
    const nube: Fetch = async (url) => {
      const u = new URL(String(url));
      if (u.hostname.endsWith('--staging.laboratorio-digital.app')) {
        return despacho.fetch(new Request(u), env);
      }
      if (u.pathname === '/api/salud') {
        return u.hostname.startsWith('tienda-api')
          ? new Response('nada', { status: 404 })
          : Response.json({ estado: 'ok', kek: 'ok' });
      }
      return u.hostname.startsWith('tienda-sitio')
        ? new Response('Esta dirección no tiene tienda', { status: 404 })
        : new Response('El panel de tu tienda');
    };
    const r = await humoDeLaTienda(
      nube,
      {
        panel: 'https://tienda-panel-staging.ejemplo.workers.dev',
        sitio: 'https://tienda-sitio-staging.ejemplo.workers.dev',
        apiPorFuera: 'https://tienda-api-c1-staging.ejemplo.workers.dev',
      },
      ENSAYOS,
    );
    expect(r).toEqual({ fallas: [], avisos: [] });
  });

  it('❌ sin la cabecera del despacho, o con un shard ajeno, la tienda no existe', async () => {
    const app = crearApp();
    const env = { CELDA: 'c1', PRODUCTO: 'tienda', SECRETO_DESPACHO: SECRETO, tienda_c1_s1: shard };
    const pedir = (tienda?: string) =>
      app.request(
        '/api/v1/tienda',
        { headers: { 'x-despacho': SECRETO, ...(tienda ? { 'x-tienda': tienda } : {}) } },
        env,
      );
    expect((await pedir()).status).toBe(404);
    expect((await pedir(JSON.stringify({ org: ENSAYO_UNO.org, shard: 'agro_c0_s1' }))).status).toBe(
      404,
    );
    expect((await pedir(JSON.stringify({ org: 'otra', shard: 'tienda_c1_s1' }))).status).toBe(404);
    expect(
      (await pedir(JSON.stringify({ org: ENSAYO_UNO.org, shard: 'tienda_c1_s1' }))).status,
    ).toBe(200);
  });
});
