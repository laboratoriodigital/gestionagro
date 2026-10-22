/**
 * HU-T4.6: una release nueva de la vitrina nunca tumba todas las tiendas a la vez. Con dos releases:
 * la página horneada con la anterior sigue cargando sus archivos por el despacho (CA3), las tiendas
 * se re-hornean por anillos (CA1) y la release vieja se borra a los 90 días si nadie la usa (CA2).
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearDespacho } from '../../tienda-sitio/src/worker.ts';
import { type Contexto, publicar } from './publicar.ts';
import {
  type AlmacenDeReleases,
  leerDatos,
  REHORNEAR_POR_RELEASE,
  RELEASES_VIEJAS,
} from './releases.ts';
import type { EntornoDeTareas } from './tareas.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-de-las-releases';
const T0 = Date.parse('2026-10-19T15:00:00.000Z');
const AHORA = new Date(T0).toISOString();
const VIEJA = 'aaaaaaaaaaaa';
const NUEVA = 'bbbbbbbbbbbb';
const HOST = 'ensayo-uno--staging.mitiendapro.co';

/** Un R2 de mentira, con bytes, listas por prefijo y carpetas. */
function r2() {
  const datos = new Map<string, Uint8Array>();
  let fallarCon: RegExp | null = null;
  const almacen: AlmacenDeReleases = {
    put: async (k, v) => {
      if (fallarCon?.test(k)) throw new Error('R2 no respondió');
      datos.set(
        k,
        typeof v === 'string' ? new TextEncoder().encode(v) : new Uint8Array(v as ArrayBuffer),
      );
    },
    get: async (k) => {
      const b = datos.get(k);
      return b
        ? {
            text: async () => new TextDecoder().decode(b),
            arrayBuffer: async () => b.slice().buffer,
          }
        : null;
    },
    list: async ({ prefix, delimiter }) => {
      const claves = [...datos.keys()].filter((k) => k.startsWith(prefix)).sort();
      if (!delimiter) return { objects: claves.map((key) => ({ key })), truncated: false };
      const carpetas = new Set(
        claves
          .map((k) => k.slice(prefix.length).split(delimiter)[0])
          .map((c) => `${prefix}${c}${delimiter}`),
      );
      return { objects: [], delimitedPrefixes: [...carpetas], truncated: false };
    },
    delete: async (k) => {
      for (const x of Array.isArray(k) ? k : [k]) datos.delete(x);
    },
  };
  const fallar = (r: RegExp | null) => {
    fallarCon = r;
  };
  return { datos, almacen, fallar };
}

let shard: BaseD1;
let control: BaseD1;
const cerrar: (() => Promise<void>)[] = [];
const almacen = r2();
const telegramas: string[] = [];
const hosts = new Map<string, string>();

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
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl([ENSAYO_UNO, ENSAYO_DOS], 'c1', AHORA))
    await control.prepare(sql.replace(/;$/, '')).run();
  // Ensayo Uno es piloto (anillo 1); Ensayo Dos, del resto.
  await shard.prepare('UPDATE tienda SET anillo = 1 WHERE org_id = ?').bind(ENSAYO_UNO.org).run();
}, 120_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const contexto = (org: string, release: string): Contexto => ({
  shard,
  shardNombre: 'tienda_c1_s1',
  control,
  sitios: almacen.almacen,
  hosts: { put: async (k: string, v: string) => void hosts.set(k, v) },
  celda: 'c1',
  release,
  org,
  pedidaPor: 'usuario:prueba',
  ahora: AHORA,
  omitir: ['sin-foto'],
});
const entorno = (release: string): EntornoDeTareas => ({
  celda: 'c1',
  shards: [['tienda_c1_s1', shard]],
  control,
  hosts: { get: async (k) => hosts.get(k) ?? null, put: async (k, v) => void hosts.set(k, v) },
  flags: { get: async () => null, put: async () => undefined },
  telegram: { token: 't', chat: 'c' },
  almacen: almacen.almacen,
  release,
  fetch: (async (_u: string, init?: RequestInit) => {
    telegramas.push(String(JSON.parse(String(init?.body ?? '{}')).text));
    return new Response('{}');
  }) as unknown as typeof fetch,
});
const releaseDe = async (org: string) =>
  (
    await shard
      .prepare(
        `SELECT p.release FROM tienda t JOIN publicacion p ON p.org_id = t.org_id
           AND p.version = t.version_publicada WHERE t.org_id = ?`,
      )
      .bind(org)
      .first<{ release: string }>()
  )?.release;

/** Los archivos de una release, como los manda el despliegue: en base64. */
const archivosDe = (release: string) => ({
  'vitrina.css': btoa(`/* vitrina ${release} */ body{margin:0}`),
  'vitrina.js': btoa(`export const release = '${release}';`),
  'fuentes/geist.woff2': btoa('wOF2-de-mentira'),
});
const subir = async (release: string, secreto = SECRETO) =>
  crearApp({ ahora: () => T0 }).request(
    '/api/despliegue/vitrina',
    {
      method: 'POST',
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        'x-despliegue': secreto,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ release, archivos: archivosDe(release) }),
    },
    { SECRETO_DESPACHO: SECRETO, SITIOS: almacen.almacen } as Env,
  );

describe('las releases de la vitrina (HU-T4.6)', () => {
  it('CA2: el despliegue sube su release al almacén una vez, y sin el secreto no existe', async () => {
    expect((await subir(VIEJA, 'adivinado')).status).toBe(404);
    const r = await subir(VIEJA);
    expect(await r.json()).toEqual({ estado: 'guardada', archivos: 3 });
    expect(await (await subir(VIEJA)).json()).toEqual({ estado: 'ya-estaba', archivos: 3 });
    expect((await leerDatos(almacen.almacen, VIEJA))?.subida).toBe(AHORA);
  });

  it('❌ CA3: una página horneada con la release anterior sigue cargando sus archivos después del despliegue nuevo', async () => {
    // Las dos tiendas publican con la release vieja.
    for (const org of [ENSAYO_UNO.org, ENSAYO_DOS.org]) {
      const r = await publicar(contexto(org, VIEJA));
      expect(r.estado, org).toBe('publicada');
    }
    expect(await releaseDe(ENSAYO_UNO.org)).toBe(VIEJA);
    // Se despliega la nueva: los assets del despacho solo traen la nueva; la vieja, en el almacén.
    const texto = (clave: string) => new TextDecoder().decode(almacen.datos.get(clave));
    const { huella } = JSON.parse(texto(`sitios/${ENSAYO_UNO.org}/1/manifiesto.json`)).archivos[
      '/index.html'
    ] as { huella: string };
    const portada = texto(`objetos/${huella.slice(0, 2)}/${huella}`);
    const rutas = [...portada.matchAll(/(?:href|src)="(\/_t\/[^"]+)"/g)].map((m) => m[1] ?? '');
    expect(rutas.length).toBeGreaterThanOrEqual(2);
    expect(rutas.every((r) => r.startsWith(`/_t/${VIEJA}/`))).toBe(true);
    const despacho = crearDespacho();
    const env = {
      TIENDA_HOSTS: { get: async (k: string) => hosts.get(k) ?? null },
      SITIOS_C1: almacen.almacen,
    };
    for (const ruta of rutas) {
      const r = await despacho.fetch(new Request(`https://${HOST}${ruta}`), env);
      expect(r.status, ruta).toBe(200);
      expect(r.headers.get('cache-control'), ruta).toBe('public, max-age=31536000, immutable');
      expect(await r.text(), ruta).toContain(VIEJA);
    }
    // ❌ Una release que nunca se subió no existe, y una ruta rara tampoco.
    for (const ruta of [`/_t/${'c'.repeat(12)}/vitrina.css`, `/_t/${VIEJA}/../secreto.json`]) {
      expect((await despacho.fetch(new Request(`https://${HOST}${ruta}`), env)).status, ruta).toBe(
        404,
      );
    }
  });

  it('CA1: la release nueva re-hornea primero el anillo 1; el resto espera 24 h', async () => {
    await subir(NUEVA);
    const r = await REHORNEAR_POR_RELEASE.correr(entorno(NUEVA), T0 + 60_000);
    expect(r).toBe(`1 tiendas con la release ${NUEVA}; 1 esperan las 24 h del anillo 1`);
    expect(await releaseDe(ENSAYO_UNO.org)).toBe(NUEVA);
    expect(await releaseDe(ENSAYO_DOS.org)).toBe(VIEJA);
    // A las 24 h, sin fallas, el resto.
    const despues = await REHORNEAR_POR_RELEASE.correr(entorno(NUEVA), T0 + 25 * 3_600_000);
    expect(despues).toBe(`1 tiendas con la release ${NUEVA}`);
    expect(await releaseDe(ENSAYO_DOS.org)).toBe(NUEVA);
    // Ya están todas: la siguiente vuelta no hace nada.
    expect(await REHORNEAR_POR_RELEASE.correr(entorno(NUEVA), T0 + 26 * 3_600_000)).toBe(
      `0 tiendas con la release ${NUEVA}`,
    );
  });

  it('❌ CA1: si una tienda del anillo 1 falla, el resto no recibe la release y se avisa', async () => {
    const OTRA = 'cccccccccccc';
    await subir(OTRA);
    almacen.fallar(new RegExp(`sitios/${ENSAYO_UNO.org}/`));
    try {
      await expect(REHORNEAR_POR_RELEASE.correr(entorno(OTRA), T0 + 2 * 3_600_000)).rejects.toThrow(
        /falló en 1 tienda/,
      );
    } finally {
      almacen.fallar(null);
    }
    expect(telegramas.at(-1)).toContain(`la release ${OTRA} de la vitrina falló`);
    expect((await leerDatos(almacen.almacen, OTRA))?.fallas.map((f) => f.org)).toEqual([
      ENSAYO_UNO.org,
    ]);
    // Pasadas las 24 h, con la falla anotada, el resto sigue en la release de antes.
    await REHORNEAR_POR_RELEASE.correr(entorno(OTRA), T0 + 30 * 3_600_000).catch(() => undefined);
    expect(await releaseDe(ENSAYO_DOS.org)).toBe(NUEVA);
  });

  it('CA2: a los 90 días se borra la release que nadie usa; la que se usa y la de ahora, no', async () => {
    const r = await RELEASES_VIEJAS.correr(entorno(NUEVA), T0 + 91 * 24 * 3_600_000);
    expect(r).toBe('2 releases viejas borradas de 3');
    expect([...almacen.datos.keys()].filter((k) => k.startsWith(`vitrina/${VIEJA}/`))).toEqual([]);
    expect(almacen.datos.has(`vitrina/${NUEVA}/vitrina.css`)).toBe(true);
  });
});
