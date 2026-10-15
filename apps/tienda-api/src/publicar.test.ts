/**
 * HU-T4.4: publicar es hornear. Contra el shard y la base de control locales, con los dos comercios
 * de prueba sembrados (HU-T2.6) y un almacén y un KV de mentira: se publica, republicar sin cambios
 * no crea versión, y un almacén que falla a la mitad deja la publicación fallida y la tienda como
 * estaba (CA3, prueba de caos).
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Almacen, type Contexto, publicar } from './publicar.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-14T15:00:00.000Z';

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
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl([ENSAYO_UNO, ENSAYO_DOS], 'c1', AHORA))
    await control.prepare(sql.replace(/;$/, '')).run();
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

/** Un R2 en memoria que cuenta lo que escribe y puede fallar en la escritura número `fallaEn`. */
function almacen(fallaEn?: number) {
  const objetos = new Map<string, string>();
  let escrituras = 0;
  const a: Almacen & { objetos: Map<string, string>; escrituras: () => number } = {
    objetos,
    escrituras: () => escrituras,
    get: async (clave) => {
      const t = objetos.get(clave);
      return t === undefined ? null : { text: async () => t };
    },
    put: async (clave, valor) => {
      escrituras++;
      if (fallaEn !== undefined && escrituras === fallaEn) throw new Error('R2 no respondió');
      objetos.set(clave, valor);
    },
  };
  return a;
}
const kv = () => {
  const valores = new Map<string, string>();
  return { valores, put: async (k: string, v: string) => void valores.set(k, v) };
};
const contexto = (org: string, sitios: Almacen, hosts = kv()): Contexto => ({
  shard,
  shardNombre: 'tienda_c1_s1',
  control,
  sitios,
  hosts,
  celda: 'c1',
  release: 'r1',
  org,
  pedidaPor: 'usuario:prueba',
  ahora: AHORA,
  omitir: ['sin-foto'],
});
const versionPublicada = async (org: string) =>
  (
    await shard
      .prepare('SELECT version_publicada AS v FROM tienda WHERE org_id = ?')
      .bind(org)
      .first<{ v: number | null }>()
  )?.v;

beforeEach(async () => {
  await shard.prepare('DELETE FROM publicacion').run();
  await shard.prepare('UPDATE tienda SET version_publicada = NULL').run();
});

describe('publicar (HU-T4.4)', () => {
  it('hornea, sube los objetos, guarda el manifiesto, apunta el KV y marca la versión', async () => {
    const r2 = almacen();
    const hosts = kv();
    const r = await publicar(contexto(ENSAYO_UNO.org, r2, hosts));
    expect(r).toMatchObject({ estado: 'publicada', version: 1 });
    expect(r2.objetos.has(`sitios/${ENSAYO_UNO.org}/1/manifiesto.json`)).toBe(true);
    expect([...r2.objetos.keys()].some((k) => k.startsWith('objetos/'))).toBe(true);
    expect(
      JSON.parse(hosts.valores.get('h:ensayo-uno--staging.laboratorio-digital.app') ?? '{}'),
    ).toMatchObject({
      org: ENSAYO_UNO.org,
      version: 1,
      shard: 'tienda_c1_s1',
    });
    expect(await versionPublicada(ENSAYO_UNO.org)).toBe(1);
  });

  it('❌ los datos de la transferencia del comercio no están en ningún archivo horneado (HU-T6.2 CA2)', async () => {
    const cobro = {
      transferencia: {
        banco: 'Banco de Prueba',
        tipoCuenta: 'ahorros',
        numero: '987-654321-00',
        titular: 'Titular de Prueba',
        documento: '900000001',
      },
    };
    await shard
      .prepare(
        "INSERT INTO ajuste (org_id, seccion, esquema, datos, actualizado, actualizado_por) VALUES (?, 'cobro', 1, ?, ?, 'prueba')",
      )
      .bind(ENSAYO_UNO.org, JSON.stringify(cobro), AHORA)
      .run();
    try {
      const r2 = almacen();
      expect(await publicar(contexto(ENSAYO_UNO.org, r2))).toMatchObject({ estado: 'publicada' });
      const todo = [...r2.objetos.values()].join('\n');
      for (const dato of ['987-654321-00', 'Banco de Prueba', 'Titular de Prueba']) {
        expect(todo).not.toContain(dato);
      }
      // Control: lo horneado sí lleva las formas de pago que ofrece, solo por su nombre.
      expect(todo).toContain('Transferencia');
    } finally {
      await shard
        .prepare("DELETE FROM ajuste WHERE org_id = ? AND seccion = 'cobro'")
        .bind(ENSAYO_UNO.org)
        .run();
    }
  });

  it('cada texto legal queda también en legal/<org>/<huella>.md, el que citará el pedido (HU-T7.1 CA2)', async () => {
    const r2 = almacen();
    await publicar(contexto(ENSAYO_UNO.org, r2));
    const m = JSON.parse(r2.objetos.get(`sitios/${ENSAYO_UNO.org}/1/manifiesto.json`) ?? '{}') as {
      archivos: Record<string, { huella: string }>;
    };
    const legales = [...r2.objetos.keys()].filter((k) => k.startsWith(`legal/${ENSAYO_UNO.org}/`));
    expect(legales).toHaveLength(6);
    const terminos = m.archivos['/legal/terminos/index.md']?.huella;
    expect(r2.objetos.get(`legal/${ENSAYO_UNO.org}/${terminos}.md`)).toContain(
      'Comercio Ensayo Uno, NIT 900000001-1',
    );
  });

  it('sin cambios, «Nada cambió» y ninguna versión nueva (CA2)', async () => {
    const r2 = almacen();
    await publicar(contexto(ENSAYO_DOS.org, r2));
    const antes = r2.escrituras();
    expect(await publicar(contexto(ENSAYO_DOS.org, r2))).toEqual({
      estado: 'nada-cambio',
      version: 1,
    });
    expect(r2.escrituras()).toBe(antes);
    const { results } = await shard
      .prepare('SELECT version, estado FROM publicacion WHERE org_id = ?')
      .bind(ENSAYO_DOS.org)
      .all();
    expect(results).toEqual([{ version: 1, estado: 'publicada' }]);
  });

  it('❌ sin cambios, los punteros vuelven a la versión publicada aunque alguien los haya pisado', async () => {
    // Bitácora tienda3 16: cada despliegue de staging reescribía los hosts con `version: null` y,
    // como nada había cambiado, la publicación no los tocaba: las dos tiendas quedaban en 404.
    const r2 = almacen();
    const hosts = kv();
    await publicar(contexto(ENSAYO_DOS.org, r2, hosts));
    const [clave, valor] = [...hosts.valores].find(([, v]) => v.includes('"canonico"')) ?? [];
    expect(clave).toBeDefined();
    const pisado = { ...JSON.parse(valor ?? '{}'), version: null };
    hosts.valores.set(clave ?? '', JSON.stringify(pisado));

    const r = await publicar(contexto(ENSAYO_DOS.org, r2, hosts));
    expect(r).toMatchObject({ estado: 'nada-cambio' });
    const version = r.estado === 'nada-cambio' ? r.version : null;
    expect(JSON.parse(hosts.valores.get(clave ?? '') ?? '{}')).toEqual({ ...pisado, version });
  });

  it('un cambio sube solo los objetos nuevos, y la versión anterior queda reemplazada', async () => {
    const r2 = almacen();
    await publicar(contexto(ENSAYO_UNO.org, r2));
    const antes = r2.escrituras();
    await shard
      .prepare(
        "UPDATE variante SET precio_cop = 135000, cambio_motivo = 'ajuste' WHERE org_id = ? AND id = 'v-camisa-m-arena'",
      )
      .bind(ENSAYO_UNO.org)
      .run();
    const r = await publicar(contexto(ENSAYO_UNO.org, r2));
    expect(r).toMatchObject({ estado: 'publicada', version: 2 });
    const nuevos = r2.escrituras() - antes;
    expect(nuevos).toBeGreaterThan(1);
    // El precio cambia la portada, la ficha, la colección, el catálogo y llms.txt; no los textos
    // legales, ni la búsqueda, ni el tema.
    expect(nuevos).toBeLessThan(r.estado === 'publicada' ? r.archivos / 2 : 0);
    const { results } = await shard
      .prepare('SELECT version, estado FROM publicacion WHERE org_id = ? ORDER BY version')
      .bind(ENSAYO_UNO.org)
      .all();
    expect(results).toEqual([
      { version: 1, estado: 'reemplazada' },
      { version: 2, estado: 'publicada' },
    ]);
    await shard
      .prepare(
        "UPDATE variante SET precio_cop = 129000, cambio_motivo = 'ajuste' WHERE org_id = ? AND id = 'v-camisa-m-arena'",
      )
      .bind(ENSAYO_UNO.org)
      .run();
  });

  it('❌ un almacén que falla a la mitad: fallida, y la tienda sigue en la versión anterior (CA3)', async () => {
    const bueno = almacen();
    const hosts = kv();
    await publicar(contexto(ENSAYO_UNO.org, bueno, hosts));
    const puntero = hosts.valores.get('h:ensayo-uno--staging.laboratorio-digital.app');
    await shard
      .prepare(
        "UPDATE producto SET nombre = 'Camisa de lino lavado' WHERE org_id = ? AND id = 'p-camisa'",
      )
      .bind(ENSAYO_UNO.org)
      .run();
    const caido = almacen(2);
    for (const [k, v] of bueno.objetos) caido.objetos.set(k, v);
    const r = await publicar(contexto(ENSAYO_UNO.org, caido, hosts));
    expect(r).toEqual({ estado: 'fallida', motivo: 'R2 no respondió' });
    expect(await versionPublicada(ENSAYO_UNO.org)).toBe(1);
    expect(hosts.valores.get('h:ensayo-uno--staging.laboratorio-digital.app')).toBe(puntero);
    expect(
      await shard
        .prepare('SELECT estado FROM publicacion WHERE org_id = ? AND version = 2')
        .bind(ENSAYO_UNO.org)
        .first(),
    ).toEqual({ estado: 'fallida' });
    await shard
      .prepare("UPDATE producto SET nombre = 'Camisa de lino' WHERE org_id = ? AND id = 'p-camisa'")
      .bind(ENSAYO_UNO.org)
      .run();
  });

  it('❌ la compuerta detiene, con todas sus fallas, y nada se sube', async () => {
    const r2 = almacen();
    const r = await publicar({ ...contexto(ENSAYO_DOS.org, r2), omitir: [] });
    expect(r.estado).toBe('compuerta');
    expect(r.estado === 'compuerta' && r.fallas.map((f) => f.codigo)).toEqual(['sin-foto']);
    expect(r2.escrituras()).toBe(0);
  });

  it('❌ una segunda publicación mientras otra está en curso responde «en curso»', async () => {
    await shard
      .prepare(
        "INSERT INTO publicacion (org_id, version, estado, pedida_por, pedida) VALUES (?, 1, 'horneando', 'x', ?)",
      )
      .bind(ENSAYO_DOS.org, AHORA)
      .run();
    expect(await publicar(contexto(ENSAYO_DOS.org, almacen()))).toEqual({ estado: 'en-curso' });
  });
});
