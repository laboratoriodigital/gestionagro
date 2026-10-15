/**
 * HU-T5.7 CA1 y CA3, la aceptación de M1 en proceso: los dos comercios de prueba llegan como llegará
 * una tienda de verdad, con su archivo `tienda-import/1` (HU-T12.2), se publican (HU-T4.4) y el
 * despacho los sirve por su dirección (HU-T5.1). Contra el shard y la base de control locales, con
 * un almacén y un KV de mentira. Una visita no le habla a la base ni a la API (CA3).
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  type ComercioDeEnsayo,
  cargaDeEnsayo,
  ENSAYOS,
  hostDeStaging,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearDespacho, type Env } from '../../tienda-sitio/src/worker.ts';
import { aplicarParte, revisarLaCarga } from './importar.ts';
import { type Almacen, publicar } from './publicar.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-15T15:00:00.000Z';

let shard: BaseD1;
let control: BaseD1;
const cerrar: (() => Promise<void>)[] = [];

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
  // Solo lo que existe al crear una tienda: su fila y su dirección. El catálogo llega por la carga.
  for (const e of ENSAYOS) {
    const [fila] = siembraDelShard([e], AHORA);
    await shard.prepare((fila ?? '').replace(/;$/, '')).run();
  }
  for (const sql of siembraDelControl(ENSAYOS, 'c1', AHORA))
    await control.prepare(sql.replace(/;$/, '')).run();
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const objetos = new Map<string, string>();
const hosts = new Map<string, string>();
const sitios: Almacen = {
  get: async (clave) => {
    const t = objetos.get(clave);
    return t === undefined ? null : { text: async () => t };
  },
  put: async (clave, valor) => void objetos.set(clave, valor),
};

async function cargar(e: ComercioDeEnsayo) {
  const r = await revisarLaCarga(shard, e.org, cargaDeEnsayo(e), AHORA);
  if (!r.ok) throw new Error(JSON.stringify(r.problemas));
  for (const parte of r.plan.partes) await aplicarParte(shard, parte);
}

/** El catálogo de una tienda como lo deja la carga, para compararlo con el fixture. */
async function catalogo(org: string) {
  const { results } = await shard
    .prepare(
      `SELECT p.slug, p.nombre, p.estado, p.retracto, v.clave, v.precio_cop AS precio, v.stock
         FROM producto p JOIN variante v ON v.org_id = p.org_id AND v.producto_id = p.id
        WHERE p.org_id = ? ORDER BY p.slug, v.clave`,
    )
    .bind(org)
    .all();
  return results;
}

describe('la aceptación de M1 en proceso (HU-T5.7)', () => {
  it('CA1: el archivo de cada comercio pasa la revisión, sin un solo problema', async () => {
    for (const e of ENSAYOS) {
      const r = await revisarLaCarga(shard, e.org, cargaDeEnsayo(e), AHORA);
      expect(r.ok ? [] : r.problemas, e.slug).toEqual([]);
    }
  });

  it('CA1: cargados por el archivo, sus productos son los del fixture; cargar dos veces no cambia nada', async () => {
    for (const e of ENSAYOS) {
      await cargar(e);
      await cargar(e);
      const esperado = e.productos
        .flatMap((p) =>
          p.variantes.map((v) => ({
            slug: p.slug,
            nombre: p.nombre,
            estado: 'activo',
            retracto: p.retracto === 'aplica' ? 'aplica' : 'no_aplica',
            clave: v.clave,
            precio: v.precioCop,
            stock: v.stock,
          })),
        )
        .sort((a, b) => `${a.slug}${a.clave}`.localeCompare(`${b.slug}${b.clave}`));
      expect(await catalogo(e.org), e.slug).toEqual(esperado);
    }
  });

  it('CA1: se publican y el despacho los sirve en su dirección; CA3: la visita no toca la base ni la API', async () => {
    for (const e of ENSAYOS) {
      const r = await publicar({
        shard,
        shardNombre: 'tienda_c1_s1',
        control,
        sitios,
        hosts: { put: async (k: string, v: string) => void hosts.set(k, v) },
        celda: 'c1',
        release: 'r1',
        org: e.org,
        pedidaPor: 'usuario:prueba',
        ahora: AHORA,
        omitir: ['sin-foto'],
      });
      expect(r, e.slug).toMatchObject({ estado: 'publicada', version: 1 });
    }

    const alaApi: string[] = [];
    const trampa = new Proxy(
      {},
      {
        get() {
          throw new Error('el despacho le habló a la base');
        },
      },
    );
    const env: Env = {
      TIENDA_HOSTS: { get: async (clave: string) => hosts.get(clave) ?? null },
      SITIOS_C1: sitios,
      SECRETO_DESPACHO: 'secreto',
      API_C1: {
        fetch: async (r: Request) => {
          alaApi.push(r.url);
          return Response.json({});
        },
      },
      tienda_c1_s1: trampa,
      tienda_control: trampa,
    };
    const despacho = crearDespacho();
    for (const e of ENSAYOS) {
      const host = hostDeStaging(e.slug);
      const portada = await despacho.fetch(new Request(`https://${host}/`), env);
      expect(portada.status, host).toBe(200);
      expect(await portada.text()).toContain(e.nombre);
      for (const p of e.productos) {
        const ficha = await despacho.fetch(new Request(`https://${host}/p/${p.slug}/`), env);
        expect(ficha.status, `${host}/p/${p.slug}/`).toBe(200);
        expect(await ficha.text()).toContain(p.nombre);
      }
    }
    expect(alaApi).toEqual([]);
  });
});
