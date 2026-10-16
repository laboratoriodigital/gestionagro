/**
 * Bitácora tienda3 28: las versiones viejas del sitio y los objetos que ya nadie usa, purgados de
 * R2 sin romper ninguna vitrina. Contra el shard local, con los dos comercios de prueba y un R2 de
 * mentira que guarda cuándo se subió cada objeto.
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
import { volverA } from './publicar.ts';
import {
  barrerObjetos,
  claveDelIndice,
  type Indice,
  MANIFIESTOS_POR_CORRIDA,
  mantenerSitio,
  purgables,
} from './purga-de-sitios.ts';
import type { AlmacenDeRespaldos } from './respaldos.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-14T15:00:00.000Z';
/** La corrida: el 17 de octubre. Lo de abril tiene más de 90 días; lo de octubre, no. */
const T = Date.parse('2026-10-17T05:00:00.000Z');
const VIEJA = (v: number) => `2026-04-${String(v).padStart(2, '0')}T15:00:00.000Z`;
const UNO = ENSAYO_UNO.org;
const DOS = ENSAYO_DOS.org;
const H = (letra: string) => letra.repeat(64);

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
beforeEach(async () => {
  await shard.prepare('DELETE FROM publicacion').run();
  await shard.prepare('UPDATE tienda SET version_publicada = NULL').run();
});

/** Un R2 en memoria que guarda cuándo se subió cada objeto, y lista por carpetas. */
function almacen() {
  const objetos = new Map<string, { valor: string; subido: Date }>();
  const a: AlmacenDeRespaldos & {
    objetos: typeof objetos;
    subir(clave: string, valor: string, subido: string): void;
  } = {
    objetos,
    subir: (clave, valor, subido) => void objetos.set(clave, { valor, subido: new Date(subido) }),
    put: async (k, v) => void objetos.set(k, { valor: v, subido: new Date(T) }),
    get: async (k) => {
      const o = objetos.get(k);
      return o === undefined ? null : { text: async () => o.valor };
    },
    list: async ({ prefix, delimiter }) => {
      const claves = [...objetos.keys()].filter((k) => k.startsWith(prefix)).sort();
      if (!delimiter)
        return {
          objects: claves.map((key) => ({ key, uploaded: objetos.get(key)?.subido ?? new Date() })),
          truncated: false,
        };
      const carpetas = new Set(
        claves
          .map((k) => k.slice(prefix.length))
          .filter((r) => r.includes(delimiter))
          .map((r) => `${prefix}${r.slice(0, r.indexOf(delimiter) + 1)}`),
      );
      return { objects: [], delimitedPrefixes: [...carpetas], truncated: false };
    },
    delete: async (k) => {
      for (const x of Array.isArray(k) ? k : [k]) objetos.delete(x);
    },
  };
  return a;
}

/** Una versión con su fila en la base y su manifiesto en R2, que nombra esas huellas. */
async function sembrar(
  r2: ReturnType<typeof almacen>,
  org: string,
  v: number,
  estado: string,
  pedida: string,
  huellas: string[],
) {
  await shard
    .prepare(
      `INSERT INTO publicacion (org_id, version, estado, pedida_por, pedida, publicada)
       VALUES (?, ?, ?, 'usuario:prueba', ?, ?)`,
    )
    .bind(org, v, estado, pedida, pedida)
    .run();
  const archivos = Object.fromEntries(
    huellas.map((h, i) => [`/p${i}/index.html`, { huella: h, bytes: 10 }]),
  );
  r2.subir(`sitios/${org}/${v}/manifiesto.json`, JSON.stringify({ huella: 'm', archivos }), pedida);
  r2.subir(`sitios/${org}/${v}/datos.json`, '{}', pedida);
  for (const h of huellas)
    if (!r2.objetos.has(`objetos/${h.slice(0, 2)}/${h}`))
      r2.subir(`objetos/${h.slice(0, 2)}/${h}`, h, pedida);
}
const vigente = (org: string, v: number) =>
  shard.prepare('UPDATE tienda SET version_publicada = ? WHERE org_id = ?').bind(v, org).run();
const purgadas = async (org: string) =>
  (
    await shard
      .prepare(
        'SELECT version FROM publicacion WHERE org_id = ? AND purgada IS NOT NULL ORDER BY version',
      )
      .bind(org)
      .all<{ version: number }>()
  ).results.map((f) => f.version);
const indiceDe = (r2: ReturnType<typeof almacen>, org: string) =>
  JSON.parse(r2.objetos.get(claveDelIndice(org))?.valor ?? 'null') as Indice | null;
const objeto = (h: string) => `objetos/${h.slice(0, 2)}/${h}`;

describe('bitácora tienda3 28 · cuáles versiones se purgan (TIENDA §351)', () => {
  const fila = (version: number, pedida: string, estado = 'reemplazada') => ({
    version,
    estado,
    pedida,
    vigente: 9,
  });
  it('❌ más de 90 días y debajo de la quinta anterior; la vigente nunca', () => {
    const viejas = Array.from({ length: 9 }, (_, i) => fila(i + 1, VIEJA(i + 1)));
    // La vigente es la 9: las 5 anteriores son de la 4 a la 8.
    expect(purgables(viejas, T)).toEqual([1, 2, 3]);
    // Con la 3 de hace un mes, la 3 y todo lo de después tiene menos de 90 días.
    const conReciente = viejas.map((f) => (f.version >= 3 ? { ...f, pedida: AHORA } : f));
    expect(purgables(conReciente, T)).toEqual([1, 2]);
    // Con solo cinco anteriores, no se purga nada.
    expect(purgables(viejas.slice(3), T)).toEqual([]);
    // Las que no salieron no cuentan entre las 5 anteriores, pero también se purgan.
    const conFallidas = viejas.map((f) =>
      f.version === 5 || f.version === 2 ? { ...f, estado: 'fallida' } : f,
    );
    expect(purgables(conFallidas, T)).toEqual([1, 2]);
  });

  it('❌ después de «Volver a esta», la vigente vieja se queda y las 5 más nuevas también', () => {
    const viejas = Array.from({ length: 9 }, (_, i) => ({
      ...fila(i + 1, VIEJA(i + 1)),
      vigente: 2,
    }));
    expect(purgables(viejas, T)).toEqual([1, 3, 4]);
  });
});

describe('bitácora tienda3 28 · cada día, las versiones viejas de cada tienda', () => {
  it('❌ borra su manifiesto y lo horneado, las marca y ya no se puede volver a ellas', async () => {
    const r2 = almacen();
    for (let v = 1; v <= 9; v++)
      await sembrar(r2, UNO, v, v === 9 ? 'publicada' : 'reemplazada', VIEJA(v), [
        H('c'),
        ...(v === 1 ? [H('a'), H('b')] : []),
        ...(v === 9 ? [H('b')] : []),
      ]);
    await vigente(UNO, 9);
    expect(await mantenerSitio(shard, UNO, r2, T)).toEqual({ leidas: 9, purgadas: 3, alDia: true });
    expect(await purgadas(UNO)).toEqual([1, 2, 3]);
    for (const v of [1, 2, 3]) {
      expect(r2.objetos.has(`sitios/${UNO}/${v}/manifiesto.json`)).toBe(false);
      expect(r2.objetos.has(`sitios/${UNO}/${v}/datos.json`)).toBe(false);
    }
    expect(r2.objetos.has(`sitios/${UNO}/4/manifiesto.json`)).toBe(true);
    // La «a» solo la usaba la 1; la «b» vuelve en la 9.
    expect(indiceDe(r2, UNO)).toEqual({
      hasta: 9,
      alDia: new Date(T).toISOString(),
      huellas: { [H('b')]: 9, [H('c')]: 9 },
    });
    const r = await volverA(
      {
        shard,
        shardNombre: 'tienda_c1_s1',
        control,
        sitios: r2,
        hosts: { put: async () => undefined },
        celda: 'c1',
        release: 'r1',
        org: UNO,
        pedidaPor: 'usuario:prueba',
        ahora: new Date(T).toISOString(),
      },
      3,
    );
    expect(r).toEqual({ estado: 'no-existe' });
    // Al día siguiente no hay nada más que leer ni que purgar.
    expect(await mantenerSitio(shard, UNO, r2, T + 86_400_000)).toEqual({
      leidas: 0,
      purgadas: 0,
      alDia: true,
    });
  });

  it('❌ la vigente vieja conserva sus huellas aunque la última versión que las usaba se purgue', async () => {
    const r2 = almacen();
    for (let v = 1; v <= 9; v++)
      await sembrar(r2, UNO, v, v === 2 ? 'publicada' : 'reemplazada', VIEJA(v), [
        ...(v === 2 || v === 4 ? [H('d')] : []),
        H('c'),
      ]);
    await vigente(UNO, 2);
    expect((await mantenerSitio(shard, UNO, r2, T)).purgadas).toBe(3);
    expect(await purgadas(UNO)).toEqual([1, 3, 4]);
    expect(indiceDe(r2, UNO)?.huellas[H('d')]).toBe(2);
  });

  it('❌ sin el índice al día no purga: leer cuesta, y se pone al día en varias corridas', async () => {
    const r2 = almacen();
    const n = MANIFIESTOS_POR_CORRIDA + 7;
    for (let v = 1; v <= n; v++)
      await sembrar(r2, UNO, v, v === n ? 'publicada' : 'reemplazada', VIEJA(1), [H('c')]);
    await vigente(UNO, n);
    expect(await mantenerSitio(shard, UNO, r2, T)).toEqual({
      leidas: MANIFIESTOS_POR_CORRIDA,
      purgadas: 0,
      alDia: false,
    });
    expect(indiceDe(r2, UNO)).toMatchObject({ hasta: MANIFIESTOS_POR_CORRIDA, alDia: null });
    expect(await mantenerSitio(shard, UNO, r2, T + 86_400_000)).toEqual({
      leidas: 7,
      purgadas: n - 6,
      alDia: true,
    });
  });

  it('la publicación que se está horneando queda para mañana, sin atrasar el índice', async () => {
    const r2 = almacen();
    await sembrar(r2, UNO, 1, 'publicada', VIEJA(1), [H('c')]);
    await vigente(UNO, 1);
    await sembrar(r2, UNO, 2, 'horneando', new Date(T - 60_000).toISOString(), [H('e')]);
    expect(await mantenerSitio(shard, UNO, r2, T)).toEqual({ leidas: 1, purgadas: 0, alDia: true });
    expect(indiceDe(r2, UNO)).toMatchObject({ hasta: 1, huellas: { [H('c')]: 1 } });
  });
});

describe('bitácora tienda3 28 · cada semana, los objetos que ya no usa ninguna tienda', () => {
  /** Ensayo Uno con la «a» solo en su versión purgada; Ensayo Dos usa la «a» en la vigente. */
  async function celda() {
    const r2 = almacen();
    for (let v = 1; v <= 7; v++)
      await sembrar(r2, UNO, v, v === 7 ? 'publicada' : 'reemplazada', VIEJA(v), [
        H('c'),
        ...(v === 1 ? [H('a'), H('f')] : []),
      ]);
    await vigente(UNO, 7);
    await sembrar(r2, DOS, 1, 'publicada', VIEJA(1), [H('a')]);
    await vigente(DOS, 1);
    // Lo que sube una publicación en curso, sin manifiesto todavía.
    r2.subir(objeto(H('e')), 'e', new Date(T - 60_000).toISOString());
    return r2;
  }

  it('❌ borra solo lo que no nombra ningún índice y se subió antes del más viejo', async () => {
    const r2 = await celda();
    await mantenerSitio(shard, UNO, r2, T);
    await mantenerSitio(shard, DOS, r2, T);
    expect(await barrerObjetos(r2, T + 3_600_000)).toEqual({
      estado: 'barrido',
      revisados: 4,
      borrados: 1,
      incompleto: false,
    });
    // La «f» solo la usaba la versión purgada de Ensayo Uno; la «a» la usa Ensayo Dos.
    expect(r2.objetos.has(objeto(H('f')))).toBe(false);
    for (const h of ['a', 'c', 'e']) expect(r2.objetos.has(objeto(H(h))), h).toBe(true);
  });

  it('❌ si a una tienda con sitio le falta su índice, o lo tiene atrasado, no borra nada', async () => {
    const r2 = await celda();
    await mantenerSitio(shard, UNO, r2, T);
    expect(await barrerObjetos(r2, T + 3_600_000)).toEqual({
      estado: 'sin-barrer',
      motivo: `a la tienda ${DOS} le falta su índice`,
    });
    // Tres días después, el de Ensayo Dos se puso al día y el de Ensayo Uno no.
    await mantenerSitio(shard, DOS, r2, T + 3 * 86_400_000);
    expect(await barrerObjetos(r2, T + 3 * 86_400_000)).toEqual({
      estado: 'sin-barrer',
      motivo: `el índice de la tienda ${UNO} está atrasado`,
    });
    expect(r2.objetos.has(objeto(H('f')))).toBe(true);
  });

  it('nunca toca los textos legales, los respaldos ni las exportaciones', async () => {
    const r2 = await celda();
    r2.subir(`legal/${UNO}/${H('a')}.md`, 'términos', VIEJA(1));
    r2.subir(`respaldos/${UNO}/2026-04-01.json`, '{}', VIEJA(1));
    r2.subir(`exportaciones/${UNO}/x.json`, '{}', VIEJA(1));
    await mantenerSitio(shard, UNO, r2, T);
    await mantenerSitio(shard, DOS, r2, T);
    await barrerObjetos(r2, T + 3_600_000);
    expect(r2.objetos.has(`legal/${UNO}/${H('a')}.md`)).toBe(true);
    expect(r2.objetos.has(`respaldos/${UNO}/2026-04-01.json`)).toBe(true);
    expect(r2.objetos.has(`exportaciones/${UNO}/x.json`)).toBe(true);
  });
});
