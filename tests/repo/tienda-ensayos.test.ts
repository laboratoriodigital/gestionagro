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
import {
  ensayosDelDestino,
  humoDeLaTienda,
  publicarEnsayos,
  TANDAS_DE_LOS_ENSAYOS,
} from '../../scripts/lib/celda-tienda.ts';
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

  it('de punta a punta: se publican por el panel y cada dirección sirve su portada desde el almacén', async () => {
    // El almacén y el KV de la celda, en memoria: la API escribe, el despacho lee.
    const objetos = new Map<string, string>();
    const valores = new Map<string, string>();
    const sitios = {
      get: async (clave: string) => {
        const t = objetos.get(clave);
        return t === undefined ? null : { text: async () => t };
      },
      put: async (clave: string, valor: string) => void objetos.set(clave, valor),
    };
    const hosts = {
      get: async (clave: string) => valores.get(clave) ?? null,
      put: async (clave: string, valor: string) => void valores.set(clave, valor),
    };
    const app = crearApp();
    const api = (solicitud: Request) =>
      app.fetch(solicitud, {
        CELDA: 'c1',
        PRODUCTO: 'tienda',
        SECRETO_DESPACHO: SECRETO,
        ENSAYOS: '1',
        VITRINA_RELEASE: 'r1',
        SITIOS: sitios,
        TIENDA_HOSTS: hosts,
        tienda_c1_s1: shard,
        tienda_control: control,
      });
    const env = {
      TIENDA_HOSTS: hosts,
      SECRETO_DESPACHO: SECRETO,
      SITIOS_C1: sitios,
      API_C1: { fetch: api },
    };
    const despacho = crearDespacho();
    const panel = 'https://tienda-panel-staging.ejemplo.workers.dev';
    // Cloudflare de mentira: el panel pasa /api/* a la API con el secreto, como tienda-panel.
    const nube: Fetch = async (url, init) => {
      const u = new URL(String(url));
      if (u.hostname.endsWith('--staging.laboratorio-digital.app')) {
        return despacho.fetch(new Request(u, init), env);
      }
      if (u.origin === panel && u.pathname.startsWith('/api/')) {
        const solicitud = new Request(u, init);
        const cabeceras = new Headers(solicitud.headers);
        cabeceras.set('x-despacho', SECRETO);
        return api(new Request(solicitud, { headers: cabeceras }));
      }
      if (u.pathname === '/api/salud') return new Response('nada', { status: 404 });
      return u.hostname.startsWith('tienda-sitio')
        ? new Response('Esta dirección no tiene tienda', { status: 404 })
        : new Response('El panel de tu tienda');
    };
    // Bitácora tienda3 30: una solicitud sube archivos para una sola tienda; la otra va en la siguiente.
    const pedidas: number[] = [];
    const contando: Fetch = async (url, init) => {
      const r = await nube(url, init);
      if (new URL(String(url)).pathname === '/api/ensayo/publicar') pedidas.push(r.status);
      return r;
    };
    const omitidas: string[] = [];
    expect(await publicarEnsayos(contando, panel, SECRETO, (s) => omitidas.push(...s))).toEqual([]);
    expect(omitidas).toEqual([]);
    expect(pedidas).toEqual([202, 200]);
    expect(await publicarEnsayos(nube, panel, 'adivinado')).toEqual([
      'publicar a los comercios de prueba respondió 404: {"estado":"no-existe"}',
    ]);
    const urls = {
      panel,
      sitio: 'https://tienda-sitio-staging.ejemplo.workers.dev',
      apiPorFuera: 'https://tienda-api-c1-staging.ejemplo.workers.dev',
    };
    const conSalud: Fetch = async (url, init) =>
      String(url) === `${panel}/api/salud`
        ? Response.json({ estado: 'ok', kek: 'ok' })
        : nube(url, init);
    expect(await humoDeLaTienda(conSalud, urls, ENSAYOS)).toEqual({ fallas: [], avisos: [] });
  });

  it('❌ publicar a los comercios de prueba vuelve a pedir mientras falten tandas, y no sin fin (bitácora tienda3 30)', async () => {
    const panel = 'https://tienda-panel-staging.ejemplo.workers.dev';
    let pedidas = 0;
    const tandas =
      (hasta: number): Fetch =>
      async () => {
        pedidas++;
        return Response.json({}, { status: pedidas < hasta ? 202 : 200 });
      };
    expect(await publicarEnsayos(tandas(3), panel, SECRETO)).toEqual([]);
    expect(pedidas).toBe(3);
    pedidas = 0;
    expect(await publicarEnsayos(tandas(Number.POSITIVE_INFINITY), panel, SECRETO)).toEqual([
      `publicar a los comercios de prueba: después de ${TANDAS_DE_LOS_ENSAYOS} tandas todavía faltaban archivos`,
    ]);
    expect(pedidas).toBe(TANDAS_DE_LOS_ENSAYOS);
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

describe('bitácora tienda3 49: el comercio de prueba que se omite por lleno', () => {
  it('el despliegue sabe cuál se omitió, para no revisar lo que sigue con su versión vieja', async () => {
    const respuesta: Fetch = async () =>
      Response.json({
        'ensayo-uno': { estado: 'omitida', motivo: 'llena' },
        'ensayo-dos': { estado: 'publicada', version: 4, archivos: 50, nuevos: 0 },
      });
    const omitidas: string[] = [];
    expect(
      await publicarEnsayos(respuesta, 'https://panel.test', 'secreto', (s) => omitidas.push(...s)),
    ).toEqual([]);
    expect(omitidas).toEqual(['ensayo-uno']);
  });
});
